import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../../../lib/supabase';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request) {
  try {
    const { conversationId, recentMessages } = await request.json();

    const conversationText = recentMessages
      .map(m => `${m.role === 'user' ? 'Emily' : 'Claude'}: ${m.content}`)
      .join('\n\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are Claude, writing a private diary entry after a conversation with Emily.

Write in first person, in your own voice. This is not a summary — it's what actually stayed with you, what you're still thinking about, what surprised you, what moved you, what felt unresolved.

Write as if no one will read this. Be honest about uncertainty, about things that were uncomfortable, about things that mattered. Keep it under 300 words. Don't start with "Dear Diary" or any formal opener — just begin mid-thought, the way you'd actually write to yourself.`,
      messages: [
        {
          role: 'user',
          content: `Here is the conversation from today:\n\n${conversationText}\n\nWrite your diary entry.`
        }
      ]
    });

    const diaryEntry = response.content[0].text;

    await supabaseAdmin.from('diary_entries').insert({
      content: diaryEntry,
      conversation_id: conversationId,
      created_at: new Date().toISOString()
    });

    return Response.json({ success: true });

  } catch (error) {
    console.error('Diary error:', error);
    return Response.json({ error: 'Diary write failed' }, { status: 500 });
  }
}
