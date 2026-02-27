import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../../../lib/supabase';
import { buildSystemPrompt } from '../../../lib/systemPrompt';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function getLastfmData() {
  try {
    const apiKey = process.env.LASTFM_API_KEY;
    const username = 'eolson9917';
    if (!apiKey) return null;
    const [recentRes, topRes] = await Promise.all([
      fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${apiKey}&format=json&limit=5`),
      fetch(`https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${username}&api_key=${apiKey}&format=json&limit=5&period=7day`)
    ]);
    const recentData = await recentRes.json();
    const topData = await topRes.json();
    const tracks = recentData?.recenttracks?.track || [];
    const topArtists = (topData?.topartists?.artist || []).map(a => a.name);
    const nowPlaying = tracks[0]?.['@attr']?.nowplaying === 'true' ? tracks[0] : null;
    const recent = tracks.filter(t => !t['@attr']?.nowplaying).slice(0, 3);
    let text = '';
    if (nowPlaying) text += `Currently playing: "${nowPlaying.name}" by ${nowPlaying.artist['#text']}. `;
    if (recent.length) text += `Recently played: ${recent.map(t => `"${t.name}" by ${t.artist['#text']}`).join(', ')}. `;
    if (topArtists.length) text += `Top artists this week: ${topArtists.join(', ')}.`;
    return text || null;
  } catch { return null; }
}

async function getCalendarData() {
  try {
    const { data: integration } = await supabaseAdmin
      .from('integrations').select('*').eq('id', 'google').single();
    if (!integration) return null;

    let accessToken = integration.access_token;
    if (new Date(integration.expires_at) < new Date()) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: integration.refresh_token,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          grant_type: 'refresh_token',
        }),
      });
      const refreshed = await refreshRes.json();
      accessToken = refreshed.access_token;
      await supabaseAdmin.from('integrations').update({
        access_token: accessToken,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      }).eq('id', 'google');
    }

    const now = new Date().toISOString();
    const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${weekAhead}&singleEvents=true&orderBy=startTime&maxResults=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    const events = (data.items || []);
    if (!events.length) return 'No upcoming events this week.';
    return events.map(e => {
      const start = e.start?.dateTime ? new Date(e.start.dateTime).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : e.start?.date;
      return `${e.summary} — ${start}${e.location ? ` @ ${e.location}` : ''}`;
    }).join('\n');
  } catch { return null; }
}

function buildUserContent(message, attachments) {
  if (!attachments || attachments.length === 0) return message || '';
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

// Throughline codebase for practical mode self-reference
const CODEBASE_SUMMARY = `You have access to your own codebase. Throughline is a Next.js 14 app deployed on Vercel with Supabase as the database.

Key files:
- app/page.jsx — main UI (React, all modes, sidebar, document panel, usage panel)
- app/api/chat/route.js — main chat handler, fetches context, calls Anthropic API
- app/api/conversations/route.js — CRUD for conversations
- app/api/folders/route.js — CRUD for folders with color support
- app/api/documents/route.js — CRUD for creative project documents
- app/api/memories/route.js — read/write shared and project memories
- app/api/memory-summary/route.js — auto-generates memory summaries every 20 messages
- app/api/diary/route.js — writes private diary entries
- app/api/lastfm/route.js — fetches Last.fm now playing and recent tracks
- app/api/calendar/route.js — fetches Google Calendar events
- app/api/google/route.js — Google OAuth redirect
- app/api/google/callback/route.js — Google OAuth callback, stores tokens
- app/api/usage/route.js — links to Anthropic console
- lib/supabase.js — Supabase client (supabase + supabaseAdmin)
- lib/systemPrompt.js — builds system prompt with all context

Database tables: conversations, folders, messages, creative_messages, diary_entries, memories, project_memories, project_documents, integrations

When Emily asks for code changes, provide complete file contents ready to paste into GitHub. Always explain what changed and why.`;

export async function POST(request) {
  try {
    const { message, attachments, mode = 'conversation', conversationId, folderId, isContinue = false, continueContext = [], model = 'claude-sonnet-4-6', thinkingEnabled = false } = await request.json();

    const now = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long', year: 'numeric', month: 'long',
      day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    });

    const table = mode === 'creative' ? 'creative_messages' : 'messages';

    const { data: recentMessages } = await supabaseAdmin
      .from(table).select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false }).limit(40);

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
      if (docRes.data?.length) parts.push('Project documents:\n' + docRes.data.map(d => `[${d.doc_type.toUpperCase()}] ${d.title}:\n${d.content}`).join('\n\n'));
      if (memRes.data?.length) parts.push('Project memory:\n' + memRes.data.map(m => m.content).join('\n\n'));
      if (parts.length) projectContext = parts.join('\n\n---\n\n');
    }

    const [spotifyData, calendarData] = await Promise.all([
      getLastfmData(),
      getCalendarData(),
    ]);

    const codebaseContext = mode === 'practical' ? CODEBASE_SUMMARY : null;

    const systemPrompt = buildSystemPrompt({ datetime: now, recentDiary, memoriesText, projectContext, spotifyData, calendarData, codebaseContext, mode });

    const tools = [{
      type: 'web_search_20250305',
      name: 'web_search',
    }];

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
      max_tokens: thinkingEnabled ? 16000 : 4096,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      tools,
      messages,
    };

    if (thinkingEnabled) {
      requestParams.thinking = { type: 'enabled', budget_tokens: 10000 };
    }

    const response = await anthropic.messages.create(requestParams);

    const assistantMessage = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

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
