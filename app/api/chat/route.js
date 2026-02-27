import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../../../lib/supabase';
import { buildSystemPrompt } from '../../../lib/systemPrompt';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const { message, mode = 'conversation', conversationId, folderId, isContinue = false, continueContext = [] } = await request.json();

    const now = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long', year: 'numeric', month: 'long',
      day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    });

    const table = mode === 'creative' ? 'creative_messages' : 'messages';

    // Load recent conversation messages
    const { data: recentMessages } = await supabaseAdmin
      .from(table)
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(40);

    const messagesForContext = (recentMessages || []).reverse();

    // Load most recent diary entry
    let recentDiary = null;
    if (mode !== 'creative') {
      const { data: diaryData } = await supabaseAdmin
        .from('diary_entries')
        .select('content')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (diaryData) recentDiary = diaryData.content;
    }

    // Load cross-conversation memories
    let memoriesText = null;
    if (mode !== 'creative') {
      const { data: memData } = await supabaseAdmin
        .from('memories')
        .select('content, created_at')
        .order('created_at', { ascending: false })
        .limit(3);
      if (memData && memData.length > 0) {
        memoriesText = memData.map(m => m.content).join('\n\n---\n\n');
      }
    }

    // Load project-specific memory and documents for creative mode
    let projectContext = null;
    if (mode === 'creative' && folderId) {
      const [memRes, docRes] = await Promise.all([
        supabaseAdmin.from('project_memories').select('content').eq('folder_id', folderId).order('created_at', { ascending: false }).limit(3),
        supabaseAdmin.from('project_documents').select('title, content, doc_type').eq('folder_id', folderId).order('created_at', { ascending: true })
      ]);

      const parts = [];
      if (docRes.data && docRes.data.length > 0) {
        parts.push('Project documents:\n' + docRes.data.map(d => `[${d.doc_type.toUpperCase()}] ${d.title}:\n${d.content}`).join('\n\n'));
      }
      if (memRes.data && memRes.data.length > 0) {
        parts.push('Project memory:\n' + memRes.data.map(m => m.content).join('\n\n'));
      }
      if (parts.length > 0) projectContext = parts.join('\n\n---\n\n');
    }

    const systemPrompt = buildSystemPrompt({
      datetime: now,
      recentDiary,
      memoriesText,
      projectContext,
      mode,
    });

    let messages;
    if (isContinue) {
      messages = [...continueContext, { role: 'user', content: 'Please continue.' }];
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

      await supabaseAdmin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);

      // Trigger memory write every 20 messages
      const { count } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId);

      if (count > 0 && count % 20 === 0) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        
        // Diary for non-creative
        if (mode !== 'creative') {
          fetch(`${appUrl}/api/diary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId, recentMessages: messagesForContext.slice(-10) })
          }).catch(() => {});
        }

        // Memory summary
        fetch(`${appUrl}/api/memory-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, folderId, mode, recentMessages: messagesForContext.slice(-10) })
        }).catch(() => {});
      }
    }

    return Response.json({ message: assistantMessage, stopReason });

  } catch (error) {
    console.error('Chat error:', error);
    return Response.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
