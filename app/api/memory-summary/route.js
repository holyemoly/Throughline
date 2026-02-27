import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../../../lib/supabase';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const { conversationId, folderId, mode, recentMessages } = await request.json();

    const conversationText = recentMessages
      .map(m => `${m.role === 'user' ? 'Emily' : 'Claude'}: ${m.content}`)
      .join('\n\n');

    const systemPrompt = mode === 'creative'
      ? `You are summarizing a creative roleplay session for future context injection. 
Extract: key plot developments, character decisions, world details established, emotional beats, unresolved threads.
Be specific and factual. Under 200 words. No preamble.`
      : `You are summarizing a real conversation between Emily and Claude for future memory.
Extract: topics discussed, things Emily shared about her life, emotional themes, anything Claude should remember.
Be specific. Under 200 words. No preamble.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Summarize this conversation:\n\n${conversationText}` }]
    });

    const summary = response.content[0].text;

    if (folderId && mode === 'creative') {
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
