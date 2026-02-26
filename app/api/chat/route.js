import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../../../lib/supabase';
import { buildSystemPrompt } from '../../../lib/systemPrompt';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request) {
  try {
    const { message, mode = 'conversation', conversationId, isContinue = false, continueContext = [] } = await request.json();

    const now = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long', year: 'numeric', month: 'long',
      day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    });

    const table = mode === 'creative' ? 'creative_messages' : 'messages';

    const { data: recentMessages } = await supabaseAdmin
      .from(table)
      .select('role, content, created_at')
      .order('created_at', { ascending: false })
      .limit(40);

    const messagesForContext = (recentMessages || []).reverse();

    let recentDiary = null;
    if (mode === 'conversation') {
      const { data: diaryData } = await supabaseAdmin
        .from('diary_entries')
        .select('content, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (diaryData) recentDiary = diaryData.content;
    }

    const systemPrompt = buildSystemPrompt({ datetime: now, recentDiary });

    let messages;

    if (isContinue) {
      // For continue, pass the existing context and ask to continue
      messages = [
        ...continueContext,
        { role: 'user', content: 'Please continue.' }
      ];
    } else {
      messages = [
        ...messagesForContext.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
      ];
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });

    const assistantMessage = response.content[0].text;
    const stopReason = response.stop_reason;

    if (!isContinue) {
      await supabaseAdmin.from(table).insert([
        { role: 'user', content: message, conversation_id: conversationId },
        { role: 'assistant', content: assistantMessage, conversation_id: conversationId }
      ]);

      const { count } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId);

      if (mode === 'conversation' && count > 0 && count % 20 === 0) {
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/diary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, recentMessages: messagesForContext.slice(-10) })
        }).catch(() => {});
      }
    }

    return Response.json({ message: assistantMessage, stopReason });

  } catch (error) {
    console.error('Chat error:', error);
    return Response.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
