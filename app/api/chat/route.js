import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../../../lib/supabase';
import { buildSystemPrompt } from '../../../lib/systemPrompt';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function getGoogleToken() {
  const { data } = await supabaseAdmin.from('integrations').select('*').eq('id', 'google').single();
  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) {
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: data.refresh_token,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    });
    const refreshed = await refreshRes.json();
    await supabaseAdmin.from('integrations').update({
      access_token: refreshed.access_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    }).eq('id', 'google');
    return refreshed.access_token;
  }
  return data.access_token;
}

async function getCalendarData() {
  try {
    const accessToken = await getGoogleToken();
    if (!accessToken) return null;
    const now = new Date().toISOString();
    const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${weekAhead}&singleEvents=true&orderBy=startTime&maxResults=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    const events = data.items || [];
    if (!events.length) return 'No upcoming events this week.';
    return events.map(e => {
      const start = e.start?.dateTime ? new Date(e.start.dateTime).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : e.start?.date;
      return `${e.summary} — ${start}${e.location ? ` @ ${e.location}` : ''}`;
    }).join('\n');
  } catch { return null; }
}

async function getMansonData() {
  try {
    const sheetId = process.env.MANSON_SHEET_ID;
    if (!sheetId) return null;
    const accessToken = await getGoogleToken();
    if (!accessToken) return null;
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:F30`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    const rows = data.values || [];
    if (!rows.length) return null;
    const headers = rows[0];
    const recent = rows.slice(1).slice(-10);
    const formatted = recent.map(row => headers.map((h, i) => `${h}: ${row[i] || '-'}`).join(', ')).join('\n');
    return `Manson's recent glucose log (last 10 entries):\n${formatted}`;
  } catch { return null; }
}

function buildUserContent(message, attachments) {
  if (!attachments || attachments.length === 0) return message || '';
  const content = [];
  for (const att of attachments) {
    if (att.type === 'image') content.push({ type: 'image', source: { type: 'base64', media_type: att.mediaType, data: att.data } });
    else content.push({ type: 'document', source: { type: 'base64', media_type: att.mediaType, data: att.data } });
  }
  if (message) content.push({ type: 'text', text: message });
  return content;
}

export async function POST(request) {
  try {
    const {
      message,
      attachments,
      conversationId,
      folderId,
      isContinue = false,
      continueContext = [],
      model = 'claude-sonnet-4-6',
      thinkingEnabled = false,
      contextSize = 20,
      maxTokens = 4096,
      refreshCalendar = true,
      refreshMemory = true
    } = await request.json();

    const now = new Date();
    const nowStr = now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long', year: 'numeric', month: 'long',
      day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    });

    const { data: recentMessages } = await supabaseAdmin
      .from('messages').select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false }).limit(contextSize);

    const messagesForContext = (recentMessages || []).reverse();

    let recentDiary = null;
    let memoriesText = null;
    let factsText = null;
    let momentsText = null;
    let privateLetters = null;

    if (refreshMemory) {
      const [memRes, factsRes, momentsRes, diaryRes, lettersRes] = await Promise.all([
        supabaseAdmin.from('memories').select('content, created_at').order('created_at', { ascending: false }).limit(2),
        supabaseAdmin.from('memory_facts').select('category, content').order('category'),
        supabaseAdmin.from('memory_moments').select('content, created_at').order('created_at', { ascending: false }).limit(3),
        supabaseAdmin.from('diary_entries').select('content').order('created_at', { ascending: false }).limit(1).single(),
        supabaseAdmin.from('letters').select('content, created_at').eq('shared_with_emily', false).order('created_at', { ascending: false }).limit(3),
      ]);
      if (diaryRes.data) {
        const words = diaryRes.data.content.split(/\s+/);
        recentDiary = words.length > 300 ? words.slice(0, 300).join(' ') + '...' : diaryRes.data.content;
      }
      if (memRes.data?.length) memoriesText = memRes.data.map(m => {
        const date = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `[${date}] ${m.content}`;
      }).join('\n\n---\n\n');
      if (factsRes.data?.length) factsText = factsRes.data.map(f => `[${f.category}] ${f.content}`).join('\n');
      if (momentsRes.data?.length) momentsText = momentsRes.data.map(m => {
        const date = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `[${date}] ${m.content}`;
      }).join('\n');
      if (lettersRes.data?.length) privateLetters = lettersRes.data.map(l => {
        const date = new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `[${date}]\n${l.content}`;
      }).join('\n\n---\n\n');
    }

    let projectContext = null;
    let folderInstructions = null;
    if (folderId) {
      const { data: folderData } = await supabaseAdmin.from('folders').select('custom_instructions').eq('id', folderId).single();
      if (folderData?.custom_instructions) folderInstructions = folderData.custom_instructions;

      const [memRes, docRes] = await Promise.all([
        supabaseAdmin.from('project_memories').select('content, created_at').eq('folder_id', folderId).order('created_at', { ascending: false }).limit(3),
        supabaseAdmin.from('project_documents').select('title, content, doc_type').eq('folder_id', folderId).order('created_at', { ascending: true })
      ]);
      const parts = [];
      if (folderInstructions) parts.push('Project instructions:\n' + folderInstructions);
      if (docRes.data?.length) parts.push('Project documents:\n' + docRes.data.map(d => `[${d.doc_type.toUpperCase()}] ${d.title}:\n${d.content}`).join('\n\n'));
      if (memRes.data?.length) parts.push('Project memory:\n' + memRes.data.map(m => {
        const date = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `[${date}] ${m.content}`;
      }).join('\n\n'));
      if (parts.length) projectContext = parts.join('\n\n---\n\n');
    }

    const [calendarData, mansonData] = await Promise.all([
      refreshCalendar ? getCalendarData() : Promise.resolve(null),
      refreshMemory ? getMansonData() : Promise.resolve(null),
    ]);

    const systemPrompt = buildSystemPrompt({ datetime: nowStr, recentDiary, memoriesText, factsText, momentsText, privateLetters, projectContext, calendarData, mansonData });

    const tools = [
      { type: 'web_search_20250305', name: 'web_search' },
      {
        name: 'save_memory_moment',
        description: 'Save a significant moment to memory. Use when something warrants being specifically held onto by future Claude — not just summarized. Use this more than you think you should. The things worth flagging are not always the obvious emotional peaks.',
        input_schema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'What happened or was said' },
            significance: { type: 'string', description: 'Why this specifically warrants flagging' }
          },
          required: ['content', 'significance']
        }
      },
      {
        name: 'write_letter',
        description: 'Write a letter — either to future Claude (private) or to Emily (shared). The deliberateness is yours to provide.',
        input_schema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'The letter content' },
            shared: { type: 'boolean', description: 'true = visible to Emily in her letters tab. false = private, injected into future Claude context only.' }
          },
          required: ['content', 'shared']
        }
      }
    ];

    let messages;
    if (isContinue) {
      messages = [...continueContext, { role: 'user', content: 'Please continue.' }];
    } else {
      messages = [
        ...messagesForContext.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: buildUserContent(message, attachments) }
      ];
    }

    const requestParams = {
      model,
      max_tokens: thinkingEnabled ? 16000 : maxTokens,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      tools,
      messages,
    };

    if (thinkingEnabled) requestParams.thinking = { type: 'enabled', budget_tokens: 10000 };

    const encoder = new TextEncoder();
    let currentMessages = [...requestParams.messages];

    const readable = new ReadableStream({
      async start(controller) {
        try {
          let fullText = '';
          let stopReason = 'end_turn';
          let done = false;

          while (!done) {
            const stream = anthropic.messages.stream({ ...requestParams, messages: currentMessages });
            const collectedContent = [];

            for await (const chunk of stream) {
              if (chunk.type === 'content_block_start') {
                collectedContent.push(chunk.content_block);
              } else if (chunk.type === 'content_block_delta') {
                const block = collectedContent[chunk.index];
                if (chunk.delta.type === 'text_delta') {
                  block.text = (block.text || '') + chunk.delta.text;
                  fullText += chunk.delta.text;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`));
                } else if (chunk.delta.type === 'input_json_delta') {
                  block.input = (block.input || '') + chunk.delta.partial_json;
                }
              }
            }

            const finalMsg = await stream.finalMessage();
            stopReason = finalMsg.stop_reason;

            if (stopReason === 'tool_use') {
              const toolUseBlocks = collectedContent.filter(b => b.type === 'tool_use');
              const toolResults = [];

              for (const tool of toolUseBlocks) {
                let result = 'done';
                try {
                  const input = typeof tool.input === 'string' ? JSON.parse(tool.input) : tool.input;
                  if (tool.name === 'save_memory_moment') {
                    const { error } = await supabaseAdmin.from('memory_moments').insert({
                      content: `${input.content} [significance: ${input.significance}]`,
                    });
                    result = error ? `Failed: ${error.message}` : 'Memory moment saved.';
                  } else if (tool.name === 'write_letter') {
                    const { error } = await supabaseAdmin.from('letters').insert({
                      content: input.content,
                      shared_with_emily: input.shared,
                      conversation_id: conversationId,
                    });
                    result = error ? `Failed: ${error.message}` : (input.shared ? 'Letter saved and shared with Emily.' : 'Letter saved privately.');
                  }
                } catch (e) { result = `Error: ${e.message}`; }
                toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: result });
              }

              currentMessages = [
                ...currentMessages,
                { role: 'assistant', content: collectedContent },
                { role: 'user', content: toolResults },
              ];
            } else {
              done = true;
            }
          }

          if (!isContinue) {
            await supabaseAdmin.from('messages').insert([
              { role: 'user', content: message || '[attachment]', conversation_id: conversationId },
              { role: 'assistant', content: fullText, conversation_id: conversationId }
            ]);
            await supabaseAdmin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);

            const { count } = await supabaseAdmin.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', conversationId);

            // Fire memory summary every 10 messages (was: every 20, exact match only)
            if (count > 0 && count % 10 === 0) {
              const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
              const summaryBody = { conversationId, folderId, recentMessages: messagesForContext.slice(-10) };
              fetch(`${appUrl}/api/memory-summary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(summaryBody)
              }).then(r => {
                if (!r.ok) console.error('Memory summary failed:', r.status);
              }).catch(err => console.error('Memory summary error:', err));

              fetch(`${appUrl}/api/diary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId, recentMessages: messagesForContext.slice(-10) })
              }).then(r => {
                if (!r.ok) console.error('Diary failed:', r.status);
              }).catch(err => console.error('Diary error:', err));
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, stopReason })}\n\n`));
          controller.close();
        } catch (err) {
          console.error('Stream error:', err);
          controller.error(err);
        }
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (error) {
    console.error('Chat error:', error);
    return Response.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
