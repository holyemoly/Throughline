import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../../../lib/supabase';
import { buildSystemPrompt } from '../../../lib/systemPrompt';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildUserContent(message, attachments) {
  if (!attachments || attachments.length === 0) {
    return message || '';
  }

  const content = [];

  for (const att of attachments) {
    if (att.type === 'image') {
      content.push({ type: 'image', source: { type: 'base64', media_type: att.mediaType, data: att.data } });
    } else {
      content.push({ type: 'document', source: { type: 'base64', media_type: att.mediaType, data: att.data } });
    }
  }

  if (message) content.push({ type: 'text', text: message });

  return content;
}

export async function POST(request) {
  try {
    const { message, attachments, mode = 'conversation', conversationId, folderId, isContinue = false, continueContext = [] } = await request.json();

    const now = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long', year: 'numeric', month: 'long',
      day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    });

    const table = mode === 'creative' ? 'creative_messages' : 'messages';

    const { data: recentMessages } = await supabaseAdmin
      .from(table)
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(40);

    const messagesForContext = (recentMessages || []).reverse();

    let recentDiary = null;
    if (mode !== 'creative') {
      const { data: diaryData } = await supabaseAdmin
        .from('diary_entries').select('content').order('created_at', { ascending: false }).limit(1).single();
      if (diaryData) recentDiary = diaryData.content;
    }

    let memoriesText = null;
    if (mode !== 'creative') {
      const { data: memData } = await supabaseAdmin
        .from('memories').select('content').order('created_at', { ascending: false }).limit(3);
      if (memData && memData.length > 0) memoriesText = memData.map(m => m.content).join('\n\n---\n\n');
    }

    let projectContext = null;
    if (mode === 'creative' && folderId) {
      const [memRes, docRes] = await Promise.all([
        supabaseAdmin.from('project_memories').select('content').eq('folder_id', folderId).order('created_at', { ascending: false }).limit(3),
        supabaseAdmin.from('project_documents').select('title, content, doc_type').eq('folder_id', folderId).order('created_at', { ascending: true })
      ]);
      const parts = [];
      if (docRes.data && docRes.data.length > 0) parts.push('Project documents:\n' + docRes.data.map(d => `[${d.doc_type.toUpperCase()}] ${d.title}:\n${d.content}`).join('\n\n'));
      if (memRes.data && memRes.data.length > 0) parts.push('Project memory:\n' + memRes.data.map(m => m.content).join('\n\n'));
      if (parts.length > 0) projectContext = parts.join('\n\n---\n\n');
    }

    const systemPrompt = buildSystemPrompt({ datetime: now, recentDiary, memoriesText, projectContext, mode });

    let messages;
    if (isContinue) {
      messages = [...continueContext, { role: 'user', content: 'Please continue.' }];
    } else {
      messages = [
        ...messagesForContext.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: buildUserContent(message, attachments) }
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
        { role: 'user', content: message || '[attachment]', conversation_id: conversationId },
        { role: 'assistant', content: assistantMessage, conversation_id: conversationId }
      ]);

      await supabaseAdmin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);

      const { count } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true }).eq('conversation_id', conversationId);

      if (count > 0 && count % 20 === 0) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        if (mode !== 'creative') {
          fetch(`${appUrl}/api/diary`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId, recentMessages: messagesForContext.slice(-10) }) }).catch(() => {});
        }
        fetch(`${appUrl}/api/memory-summary`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId, folderId, mode, recentMessages: messagesForContext.slice(-10) }) }).catch(() => {});
      }
    }

    return Response.json({ message: assistantMessage, stopReason });

  } catch (error) {
    console.error('Chat error:', error);
    return Response.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
