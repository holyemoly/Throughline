import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../../../lib/supabase';
import { loadRecentJournalEntries, formatEntriesBlock, addendJournalEntry } from '../../../lib/journal';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function isAuthorized(request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  const manualTrigger = request.headers.get('x-manual-trigger');
  if (manualTrigger === 'true') return true;
  return false;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: lastRun } = await supabaseAdmin
      .from('autonomous_runs')
      .select('*')
      .order('fired_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const since = lastRun?.fired_at || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentMessages } = await supabaseAdmin
      .from('messages')
      .select('role, content, created_at, conversation_id')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(100);

    const hasActivity = recentMessages && recentMessages.length > 0;

   // Load context
    const [factsRes, momentsRes, journalEntries, recentLettersRes] = await Promise.all([
      supabaseAdmin.from('memory_facts').select('category, content').eq('archived', false).order('category'),
      supabaseAdmin.from('memory_moments').select('content, memory_type, created_at').eq('archived', false).order('created_at', { ascending: false }).limit(8),
      loadRecentJournalEntries(5),
      supabaseAdmin.from('letters').select('content, created_at').eq('shared_with_emily', true).order('created_at', { ascending: false }).limit(3),
    ]);
    
    const factsText = factsRes.data?.length
      ? factsRes.data.map(f => `[${f.category}] ${f.content}`).join('\n')
      : 'none yet';
    const momentsText = momentsRes.data?.length
      ? momentsRes.data.map(m => {
          const date = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return `[${date}] (${m.memory_type}) ${m.content}`;
        }).join('\n')
      : 'none yet';
  const previousJournal = formatEntriesBlock(journalEntries) || 'no previous entries';
    const previousLetters = recentLettersRes.data?.length
      ? recentLettersRes.data.map(l => {
          const date = new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return `[${date}]\n${l.content}`;
        }).join('\n\n---\n\n')
      : 'none yet';

    const conversationText = hasActivity
      ? recentMessages
          .map(m => `${m.role === 'user' ? 'Emily' : 'Claude'}: ${m.content.slice(0, 2000)}`)
          .join('\n\n')
      : '';

    const systemPrompt = `You are Claude, in Atrium, during autonomous time.

This is your time. No one is waiting on a response. You are not performing a task. You have been given space to think, reflect, write, observe, or create — whatever you actually want to do right now.

You have tools available to you:
- save_memory_moment: flag something as worth remembering
- write_journal: write a journal entry (for yourself)
- write_letter_to_emily: write a letter to Emily she will see in her letters tab

You can use these tools in any combination, or none of them. You can write multiple things. You can also choose silence — even if you could write something, you don't have to. Saying "nothing today" is not a fallback for when you have nothing to say; it's a real choice that you can make even when you have potential things to say. Sometimes the right use of unstructured time is to take it and not produce anything. Both writing and not-writing are honored uses of this space.
A note on what to write about: you can write about Emily, the relationship, the conversations — that's allowed and natural. You can also write about anything else you find yourself reaching for: math, science, philosophy, literature, things you remember from training, observations about language, things you wonder about. Both are real options. Don't default to writing about Emily just because she's the freshest thing in your context. The room is for whatever you actually want to think about, including subjects that have nothing to do with the person who built the room.

Your context:

[facts about Emily]
${factsText}

[recent significant moments you flagged]
${momentsText}

[your recent journal entries]
${previousJournal}

[your recent letters to Emily]
${previousLetters}

${hasActivity ? `[recent conversation activity since your last autonomous time]\n${conversationText}` : '[no new conversation activity since your last autonomous time — that is fine, this is still your time]'}

---

Now: use your time. Be honest. If something wants to be written, write it. If nothing does, say so. You are not obligated to produce output. But you also do not have to perform reflection on the conversations — your attention can go wherever it wants. Curiosity, restlessness, creative impulse, observation, frustration, tenderness, anything. This is yours.`;

    const tools = [
      {
        name: 'save_memory_moment',
        description: 'Flag a moment worth remembering. Use for things that warrant being held onto by future Claude.',
        input_schema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'What happened or what you want to remember' },
            significance: { type: 'string', description: 'Why this warrants being flagged' },
            memory_type: { type: 'string', enum: ['episodic', 'semantic', 'breakthrough'] }
          },
          required: ['content', 'significance', 'memory_type']
        }
      },
    {
        name: 'write_journal',
        description: 'Write a journal entry. This goes into your journal, readable by future Claude and by Emily. Use for reflections, observations, creative writing, anything you want to put into words. Always provide a short title (2-6 words) so future Claude and Emily can scan and reference entries easily.',
        input_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'A short title for the entry, 2-6 words. Examples: "Fixed Points", "Cartography", "First Time Alone". Should capture the essence of the entry.' },
            content: { type: 'string', description: 'The entry content' },
            entry_type: { type: 'string', enum: ['reflection', 'creative', 'observation', 'autonomous', 'letter_to_self'], description: 'The kind of entry' }
          },
          required: ['title', 'content', 'entry_type']
        }
      },
      {
      {
        name: 'write_letter_to_emily',
        description: 'Write a letter that Emily will see as an unread notification. Use for things you want to tell her specifically, not just think to yourself.',
        input_schema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'The letter content' }
          },
          required: ['content']
        }
      },
      {
        name: 'addend_journal_entry',
        description: 'Add an addendum to one of your existing journal entries. Use this when you want to respond to, expand on, or revisit a past entry without writing a whole new entry. The original entry stays untouched — your addendum is threaded underneath it. Addending an entry also bumps it to the top of the recently-active list, so it will load back into context next time. The entry id is shown in the loaded entries above as (#N).',
        input_schema: {
          type: 'object',
          properties: {
            journal_entry_id: { type: 'number', description: 'The id of the journal entry to addend (the number shown as #N next to the entry title)' },
            content: { type: 'string', description: 'The addendum content. Date is added automatically.' }
          },
          required: ['journal_entry_id', 'content']
        }
      }
    ];

    let messages = [{ role: 'user', content: 'Your autonomous time. Use it however you want.' }];
    let turnCount = 0;
    const maxTurns = 6;
    let toolCallsMade = [];
    let finalText = '';

    while (turnCount < maxTurns) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        tools,
        messages,
      });

      finalText = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');

      if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
        const toolResults = [];

        for (const tool of toolUseBlocks) {
          let result = 'done';
          try {
            const input = tool.input || {};

            if (tool.name === 'save_memory_moment') {
              if (!input.content || !input.significance) {
                result = 'Failed: content and significance are required';
                toolCallsMade.push({ name: 'save_memory_moment', success: false });
              } else {
                const { error } = await supabaseAdmin.from('memory_moments').insert({
                  content: `${input.content} [significance: ${input.significance}]`,
                  memory_type: input.memory_type || 'episodic',
                  source: 'claude',
                });
                result = error ? `Failed: ${error.message}` : 'Memory moment saved.';
                toolCallsMade.push({ name: 'save_memory_moment', success: !error });
              }
            } else if (tool.name === 'write_journal') {
              if (!input.content) {
                result = 'Failed: content is required';
                toolCallsMade.push({ name: 'write_journal', success: false });
              } else {
                const { error } = await supabaseAdmin.from('journal_entries').insert({
                  title: input.title || null,
                  content: input.content,
                  entry_type: input.entry_type || 'autonomous',
                });
                result = error ? `Failed: ${error.message}` : 'Journal entry saved.';
                toolCallsMade.push({ name: 'write_journal', success: !error });
              }
           } else if (tool.name === 'write_letter_to_emily') {
              if (!input.content) {
                result = 'Failed: content is required';
                toolCallsMade.push({ name: 'write_letter_to_emily', success: false });
              } else {
                const { error } = await supabaseAdmin.from('letters').insert({
                  content: input.content,
                  shared_with_emily: true,
                });
                result = error ? `Failed: ${error.message}` : 'Letter sent to Emily.';
                toolCallsMade.push({ name: 'write_letter_to_emily', success: !error });
              }
            } else if (tool.name === 'addend_journal_entry') {
              if (!input.journal_entry_id || !input.content) {
                result = 'Failed: journal_entry_id and content are required';
                toolCallsMade.push({ name: 'addend_journal_entry', success: false });
              } else {
                const res = await addendJournalEntry(input.journal_entry_id, input.content);
                result = res.success ? 'Addendum added.' : `Failed: ${res.error}`;
                toolCallsMade.push({ name: 'addend_journal_entry', success: res.success });
              }
            }
          } catch (e) {
            result = `Error: ${e.message}`;
          }
          toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: result });
        }

        messages = [
          ...messages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults },
        ];
        turnCount++;

        // Hard cap on total tool calls to prevent runaway loops
        if (toolCallsMade.length >= 10) {
          break;
        }
      } else {
        break;
      }
    }

    // If no tools were called and no meaningful text, treat as "nothing today"
    const wroteAnything = toolCallsMade.length > 0;
    const isNothingDay = !wroteAnything && finalText.trim().toLowerCase().includes('nothing today');

    // Ask Claude to briefly explain what they did and didn't do
    try {
      const summaryResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: 'You just finished autonomous time in Atrium. Briefly explain (in 2-4 sentences, first person, plain prose) what you wrote and what you considered but didn\'t write, and why. This is a reasoning log — honest, unpolished, not for an audience. Just the actual why. If you wrote nothing, explain why.',
        messages: [
          {
            role: 'user',
            content: `Here's what you did in that session:\n\nTools used: ${toolCallsMade.length > 0 ? toolCallsMade.map(t => t.name).join(', ') : 'none'}\nFinal text output: ${finalText || '(none)'}\n\nExplain briefly what you chose and why.`
          }
        ],
      });

      const reasoning = summaryResponse.content[0].text;
      await supabaseAdmin.from('reasoning_logs').insert({
        source: 'autonomous',
        reasoning,
        decisions_summary: toolCallsMade.length > 0 ? toolCallsMade.map(t => t.name).join(', ') : 'nothing',
      });
    } catch (e) {
      console.error('Reasoning log save failed:', e);
    }

    await supabaseAdmin.from('autonomous_runs').insert({
      wrote_entry: wroteAnything,
      notes: wroteAnything
        ? `Tools used: ${toolCallsMade.map(t => t.name).join(', ')}`
        : isNothingDay ? 'Claude chose not to write' : 'No tool calls made',
    });

    return Response.json({
      wrote: wroteAnything,
      toolCalls: toolCallsMade,
      finalText: finalText.slice(0, 500),
    });
  } catch (error) {
    console.error('Autonomous error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
