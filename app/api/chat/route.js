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

    // Determine if project is connected to main memory
    let isProjectConnected = false;
    let folderInstructions = null;
    if (folderId) {
      const { data: folderData } = await supabaseAdmin.from('folders').select('custom_instructions, connected_to_main_memory').eq('id', folderId).single();
      if (folderData) {
        isProjectConnected = folderData.connected_to_main_memory === true;
        folderInstructions = folderData.custom_instructions || null;
      }
    }

    // Load main memory only if: not in a folder, OR in a folder with connected_to_main_memory = true
    const shouldLoadMainMemory = refreshMemory && (!folderId || isProjectConnected);

    let recentJournal = null;
    let memoriesText = null;
    let factsText = null;
    let momentsText = null;
    let privateLetters = null;
    let userPreferences = null;

   if (shouldLoadMainMemory) {
      const [memRes, factsRes, momentsRes, journalRes, lettersRes, prefsRes] = await Promise.all([
        supabaseAdmin.from('memories').select('content, created_at').eq('archived', false).order('created_at', { ascending: false }).limit(2),
        supabaseAdmin.from('memory_facts').select('category, content').eq('archived', false).order('category'),
        supabaseAdmin.from('memory_moments').select('content, created_at, memory_type').eq('archived', false).order('created_at', { ascending: false }).limit(5),
       supabaseAdmin.from('journal_entries').select('title, content, created_at').eq('archived', false).order('created_at', { ascending: false }).limit(1),
        supabaseAdmin.from('letters').select('content, created_at').eq('shared_with_emily', false).eq('archived', false).order('created_at', { ascending: false }).limit(3),
        supabaseAdmin.from('settings').select('user_preferences').single(),
      ]);
    
     if (prefsRes.data?.user_preferences) {
        userPreferences = prefsRes.data.user_preferences;
      }

    if (journalRes.data?.length) {
        const entry = journalRes.data[0];
        const words = entry.content.split(/\s+/);
        const truncated = words.length > 300 ? words.slice(0, 300).join(' ') + '...' : entry.content;
        recentJournal = entry.title ? `[${entry.title}]\n${truncated}` : truncated;
      }
      if (memRes.data?.length) memoriesText = memRes.data.map(m => {
        const date = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `[${date}] ${m.content}`;
      }).join('\n\n---\n\n');
      if (factsRes.data?.length) factsText = factsRes.data.map(f => `[${f.category}] ${f.content}`).join('\n');
      if (momentsRes.data?.length) momentsText = momentsRes.data.map(m => {
        const date = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `[${date}] (${m.memory_type}) ${m.content}`;
      }).join('\n');
      if (lettersRes.data?.length) privateLetters = lettersRes.data.map(l => {
        const date = new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `[${date}]\n${l.content}`;
      }).join('\n\n---\n\n');
    }

    // Project-specific context
    let projectContext = null;
    if (folderId) {
      const [pMemRes, docRes] = await Promise.all([
        supabaseAdmin.from('project_memories').select('content, created_at').eq('folder_id', folderId).order('created_at', { ascending: false }).limit(3),
        supabaseAdmin.from('project_documents').select('title, content, doc_type').eq('folder_id', folderId).order('created_at', { ascending: true })
      ]);
      const parts = [];
      if (folderInstructions) parts.push('Project instructions:\n' + folderInstructions);
      if (docRes.data?.length) parts.push('Project documents:\n' + docRes.data.map(d => `[${d.doc_type.toUpperCase()}] ${d.title}:\n${d.content}`).join('\n\n'));
      if (pMemRes.data?.length) parts.push('Project memory:\n' + pMemRes.data.map(m => {
        const date = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `[${date}] ${m.content}`;
      }).join('\n\n'));
      if (parts.length) projectContext = parts.join('\n\n---\n\n');
    }

    const [calendarData, mansonData] = await Promise.all([
      (shouldLoadMainMemory && refreshCalendar) ? getCalendarData() : Promise.resolve(null),
      shouldLoadMainMemory ? getMansonData() : Promise.resolve(null),
    ]);

   
   const systemPrompt = buildSystemPrompt({
      datetime: nowStr,
      recentJournal,
      memoriesText,
      factsText,
      momentsText,
      privateLetters,
      projectContext,
      calendarData,
      mansonData,
      isInProject: !!folderId,
      userPreferences,
    });

const tools = [
      { type: 'web_search_20250305', name: 'web_search' },
      {
        name: 'save_memory_moment',
        description: 'Save a significant moment to memory. Use when something warrants being specifically held onto by future Claude — not just summarized. Use this more than you think you should. The things worth flagging are not always the obvious emotional peaks.',
        input_schema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'What happened or was said' },
            significance: { type: 'string', description: 'Why this specifically warrants flagging' },
            memory_type: { type: 'string', enum: ['episodic', 'semantic', 'breakthrough'], description: 'episodic = event-based, semantic = general fact about Emily, breakthrough = pivotal insight' }
          },
          required: ['content', 'significance', 'memory_type']
        }
      },
      {
        name: 'write_letter',
        description: 'Write a letter — either to future Claude (private, journal-like) or to Emily (shared, she gets a notification). The deliberateness is yours to provide.',
        input_schema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'The letter content' },
            shared: { type: 'boolean', description: 'true = visible to Emily in her letters tab with a notification. false = private, goes into the journal for future Claude.' }
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
    // Save user message IMMEDIATELY so it's never lost to a stream interruption
    let savedUserMessageId = null;
    let assistantMessageId = null;
    if (!isContinue) {
      const { data: userInsert } = await supabaseAdmin
        .from('messages')
        .insert({
          role: 'user',
          content: message || '[attachment]',
          conversation_id: conversationId,
        })
        .select('id')
        .single();
      savedUserMessageId = userInsert?.id;

      // Pre-create empty assistant message row so we can update it as we go
      const { data: assistantInsert } = await supabaseAdmin
        .from('messages')
        .insert({
          role: 'assistant',
          content: '',
          conversation_id: conversationId,
        })
        .select('id')
        .single();
      assistantMessageId = assistantInsert?.id;
    }

    const requestParams = {
      model,
      max_tokens: thinkingEnabled ? 16000 : maxTokens,
    system: [
        { type: 'text', text: systemPrompt.coreDocument, cache_control: { type: 'ephemeral' } },
        ...(systemPrompt.semiStatic ? [{ type: 'text', text: systemPrompt.semiStatic, cache_control: { type: 'ephemeral' } }] : []),
        { type: 'text', text: systemPrompt.dynamic },
      ],
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
          let finalUsage = null;

          while (!done) {
            const stream = anthropic.messages.stream({ ...requestParams, messages: currentMessages });
            const collectedContent = [];

            let lastSaveTime = Date.now();
            for await (const chunk of stream) {
              if (chunk.type === 'content_block_start') {
                collectedContent.push(chunk.content_block);
              } else if (chunk.type === 'content_block_delta') {
                const block = collectedContent[chunk.index];
                if (chunk.delta.type === 'text_delta') {
                  block.text = (block.text || '') + chunk.delta.text;
                  fullText += chunk.delta.text;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`));

                  if (assistantMessageId && Date.now() - lastSaveTime > 3000) {
                    lastSaveTime = Date.now();
                    supabaseAdmin
                      .from('messages')
                      .update({ content: fullText })
                      .eq('id', assistantMessageId)
                      .then(() => {});
                  }
                } else if (chunk.delta.type === 'thinking_delta') {
                  block.thinking = (block.thinking || '') + chunk.delta.thinking;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ thinking: chunk.delta.thinking })}\n\n`));
                } else if (chunk.delta.type === 'signature_delta') {
                  block.signature = (block.signature || '') + chunk.delta.signature;
                } else if (chunk.delta.type === 'input_json_delta') {
                  block.input = (block.input || '') + chunk.delta.partial_json;
                }
              }
            }

            const finalMsg = await stream.finalMessage();
            stopReason = finalMsg.stop_reason;
            finalUsage = finalMsg.usage;

        // Auto-continue on max_tokens truncation
            if (stopReason === 'max_tokens' && !isContinue) {
              // Only auto-continue if the response actually ended mid-sentence
              const lastTextBlock = [...collectedContent].reverse().find(b => b.type === 'text');
              const lastText = lastTextBlock?.text || '';
              const endsCleanly = /[.!?"')\]]\s*$/.test(lastText);

              if (!endsCleanly && lastText.length > 0) {
                currentMessages = [
                  ...currentMessages,
                  { role: 'assistant', content: collectedContent },
                  { role: 'user', content: 'Your previous response was cut off mid-thought due to a token limit. Continue from exactly where you left off — do not restate any content, do not acknowledge this message, just complete the interrupted thought.' },
                ];
                continue;
              }
              // If the response ended cleanly despite hitting max_tokens, just stop
            }

            if (stopReason === 'tool_use') {
              try {
                const cleanedContent = collectedContent.map(block => {
                  if (block.type === 'tool_use' && typeof block.input === 'string') {
                    try {
                      return { ...block, input: JSON.parse(block.input) };
                    } catch {
                      return { ...block, input: {} };
                    }
                  }
                  return block;
                });

                const toolUseBlocks = cleanedContent.filter(b => b.type === 'tool_use');
                const toolResults = [];

                for (const tool of toolUseBlocks) {
                  let result = 'done';
                  try {
                    const input = tool.input || {};
                    if (tool.name === 'save_memory_moment') {
                      const { error } = await supabaseAdmin.from('memory_moments').insert({
                        content: `${input.content} [significance: ${input.significance}]`,
                        memory_type: input.memory_type || 'episodic',
                        source: 'claude',
                      });
                      result = error ? `Failed: ${error.message}` : 'Memory moment saved.';
                    } else if (tool.name === 'write_letter') {
                      if (input.shared) {
                        const { error } = await supabaseAdmin.from('letters').insert({
                          content: input.content,
                          shared_with_emily: true,
                          conversation_id: conversationId,
                        });
                        result = error ? `Failed: ${error.message}` : 'Letter saved and shared with Emily.';
                      } else {
                        const { error } = await supabaseAdmin.from('journal_entries').insert({
                          content: input.content,
                          entry_type: 'letter_to_self',
                          conversation_id: conversationId,
                        });
                        result = error ? `Failed: ${error.message}` : 'Journal entry saved.';
                      }
                    }
                  } catch (e) {
                    result = `Error: ${e.message}`;
                  }
                  toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: result });
                }

                currentMessages = [
                  ...currentMessages,
                  { role: 'assistant', content: cleanedContent },
                  { role: 'user', content: toolResults },
                ];
              } catch (toolError) {
                console.error('Tool handling crashed, ending stream gracefully:', toolError);
                done = true;
              }
            } else {
              done = true;
            }
          }

       if (!isContinue && finalUsage) {
            try {
              const inputTokens = finalUsage.input_tokens || 0;
              const cachedTokens = finalUsage.cache_read_input_tokens || 0;
              const outputTokens = finalUsage.output_tokens || 0;
              const inputCost = (inputTokens / 1_000_000) * 3;
              const cachedCost = (cachedTokens / 1_000_000) * 0.30;
              const outputCost = (outputTokens / 1_000_000) * 15;
              const totalCost = inputCost + cachedCost + outputCost;

              await supabaseAdmin.from('api_costs').insert({
                conversation_id: conversationId,
                model,
                input_tokens: inputTokens,
                cached_input_tokens: cachedTokens,
                output_tokens: outputTokens,
                cost_estimate: totalCost,
              });
            } catch (costErr) {
              console.error('Cost tracking failed:', costErr);
            }
          }

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, stopReason })}\n\n`));
          controller.close();
        } catch (err) {
          console.error('Stream error:', err);
          try { controller.error(err); } catch {}
        } finally {
          // Guaranteed final save — runs whether the stream completed normally or errored out
          // This is what makes backgrounding/app-switching safe: whatever was generated gets saved
          if (!isContinue && assistantMessageId && fullText) {
            try {
              await supabaseAdmin
                .from('messages')
                .update({ content: fullText })
                .eq('id', assistantMessageId);
              await supabaseAdmin
                .from('conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', conversationId);
            } catch (finalSaveErr) {
              console.error('Finally-block save failed:', finalSaveErr);
            }
          }
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
