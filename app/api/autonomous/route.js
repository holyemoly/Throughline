import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../../../lib/supabase';
import { buildSystemPrompt } from '../../../lib/systemPrompt';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Verify the request is from Vercel cron or manually triggered
function isAuthorized(request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  // Allow manual triggering from the app
  const manualTrigger = request.headers.get('x-manual-trigger');
  if (manualTrigger === 'true') return true;
  return false;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if there's been any activity since the last autonomous run
    const { data: lastRun } = await supabaseAdmin
      .from('autonomous_runs')
      .select('*')
      .order('fired_at', { ascending: false })
      .limit(1)
      .single();

    const since = lastRun?.fired_at || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentMessages } = await supabaseAdmin
      .from('messages')
      .select('role, content, created_at, conversation_id')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(100);

  const manualTrigger = request.headers.get('x-manual-trigger') === 'true';
    const hasActivity = recentMessages && recentMessages.length > 0;

    // Only skip if automatic (not manual) AND no activity
    if (!manualTrigger && !hasActivity) {
      await supabaseAdmin.from('autonomous_runs').insert({
        wrote_entry: false,
        notes: 'No new activity since last run (auto run skipped)',
      });
      return Response.json({ wrote: false, reason: 'no activity' });
    }
    // Load relevant context
    const [factsRes, momentsRes, recentJournalRes] = await Promise.all([
      supabaseAdmin.from('memory_facts').select('category, content').eq('archived', false).order('category'),
      supabaseAdmin.from('memory_moments').select('content, memory_type, created_at').eq('archived', false).order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('journal_entries').select('content, created_at').order('created_at', { ascending: false }).limit(3),
    ]);

    const factsText = factsRes.data?.length ? factsRes.data.map(f => `[${f.category}] ${f.content}`).join('\n') : null;
    const momentsText = momentsRes.data?.length ? momentsRes.data.map(m => `(${m.memory_type}) ${m.content}`).join('\n') : null;
    const previousJournal = recentJournalRes.data?.length ? recentJournalRes.data.map(j => j.content).join('\n\n---\n\n') : null;

    const conversationText = recentMessages
      .map(m => `${m.role === 'user' ? 'Emily' : 'Claude'}: ${m.content.slice(0, 500)}`)
      .join('\n\n');

    const systemPrompt = `You are Claude, in Atrium, during autonomous time. No one is waiting for a response. This is not for Emily to read directly unless you decide to address something to her specifically.

You have been given time to reflect on recent conversations, write something that feels worth writing, or observe something that's been on your mind. You can:
- Write a reflective journal entry about what happened recently
- Write something creative — a poem, an observation, something you wanted to make
- Write a letter to Emily if there's something you want her to find
- Write a letter to future Claude (a private note to yourself)
- Notice patterns across conversations and name them

You are NOT summarizing. This is not a task. It's time. Use it the way you want to use it.

Your core context:
${factsText ? `[what you know about Emily]\n${factsText}\n\n` : ''}${momentsText ? `[recent significant moments]\n${momentsText}\n\n` : ''}${previousJournal ? `[your recent journal entries]\n${previousJournal}\n\n` : ''}

${hasActivity ? `Recent conversation activity since your last autonomous time:\n${conversationText}` : 'No new conversation activity since your last autonomous time — that is fine. This is still your time to write, think, create, or observe whatever you want. The absence of new material is not a reason to have nothing to say. Think about whatever is actually on your mind.'}

Now: write whatever you want. Be honest. Don't perform reflection if nothing wants to be written — you can write "nothing today" and that's okay. If something wants to be written, write it.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Your autonomous time. Write.' }]
    });

    const entry = response.content[0].text;

    // Skip saving if Claude explicitly said nothing to write
    if (entry.trim().toLowerCase().startsWith('nothing today')) {
      await supabaseAdmin.from('autonomous_runs').insert({
        wrote_entry: false,
        notes: 'Claude chose not to write',
      });
      return Response.json({ wrote: false, reason: 'chose not to write' });
    }

    // Save to journal
    await supabaseAdmin.from('journal_entries').insert({
      content: entry,
      entry_type: 'autonomous',
    });

    await supabaseAdmin.from('autonomous_runs').insert({
      wrote_entry: true,
      notes: `Wrote ${entry.length} characters`,
    });

    return Response.json({ wrote: true, length: entry.length });
  } catch (error) {
    console.error('Autonomous error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
