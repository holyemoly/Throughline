import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../../../lib/supabase';
import { logApiCost } from '../../../lib/apiCost';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const { conversationId, folderId, recentMessages } = await request.json();

    const conversationText = recentMessages
      .map(m => `${m.role === 'user' ? 'Emily' : 'Claude'}: ${m.content}`)
      .join('\n\n');

    const systemPrompt = `You are summarizing a real conversation between Emily and Claude for future memory.
Extract: topics discussed, things Emily shared about her life, emotional themes, anything Claude should remember.
Be specific. Under 200 words. No preamble.`;

  const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Summarize this conversation:\n\n${conversationText}` }]
    });

    await logApiCost({
      usage: response.usage,
      model: 'claude-haiku-4-5',
      source: 'memory_summary',
    });

    const summary = response.content[0].text;
    if (folderId) {
      await supabaseAdmin.from('project_memories').insert({ folder_id: folderId, content: summary, conversation_id: conversationId });
    } else {
      await supabaseAdmin.from('memories').insert({ content: summary, conversation_id: conversationId });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Memory summary error:', error);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
