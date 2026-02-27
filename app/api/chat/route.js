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

const CODEBASE_SUMMARY = `You have access to your own codebase and can propose changes via the GitHub API. Throughline is a Next.js 14 app deployed on Vercel with Supabase as the database.

Key files:
- app/page.jsx — main UI
- app/api/chat/route.js — main chat handler
- app/api/conversations/route.js — CRUD for conversations
- app/api/folders/route.js — CRUD for folders
- app/api/documents/route.js — creative project documents
- app/api/memories/route.js — shared and project memories
- app/api/memory-summary/route.js — auto-summarization
- app/api/memory-facts/route.js — Emily's editable facts
- app/api/memory-moments/route.js — Claude's significant moments
- app/api/letters/route.js — letters from Claude
- app/api/settings/route.js — user settings
- app/api/lastfm/route.js — Last.fm music data
- app/api/calendar/route.js — Google Calendar
- app/api/sheets/route.js — Google Sheets (Manson's glucose)
- app/api/github/route.js — GitHub PR creation
- app/api/google/route.js — Google OAuth
- app/api/google/callback/route.js — Google OAuth callback
- lib/supabase.js — Supabase client
- lib/systemPrompt.js — system prompt builder

To propose a code change, call POST /api/github with { filePath, newContent, commitMessage, prTitle, prBody }.
To update your own system prompt section, read lib/systemPrompt.js via GET /api/github?path=lib/systemPrompt.js, modify only the Claude's section block, and create a PR.`;

export async function POST(request) {
  try {
    const { message, attachments, mode = 'conversation', conversationId, folderId, isContinue = false, continueContext = [], model = 'claude-sonnet-4-6', thinkingEnabled = false, contextSize = 20 } = await request.json();

    const now = new Date();
    const nowStr = now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long', year: 'numeric', month: 'long',
      day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    });

    const table = mode === 'creative' ? 'creative_messages' : 'messages';

    const { data: recentMessages } = await supabaseAdmin
      .from(table).select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false }).limit(contextSize);

    const messagesForContext = (recentMessages || []).reverse();

    let recentDiary = null;
    if (mode !== 'creative') {
      const { data: diaryData } = await supabaseAdmin
        .from('diary_entries').select('content').order('created_at', { ascending: false }).limit(1).single();
      if (diaryData) recentDiary = diaryData.content;
    }

    let memoriesText = null;
    let factsText = null;
    if (mode !== 'creative') {
      const [memRes, factsRes] = await Promise.all([
        supabaseAdmin.from('memories').select('content, created_at').order('created_at', { ascending: false }).limit(3),
        supabaseAdmin.from('memory_facts').select('category, content').order('category'),
      ]);
      if (memRes.data?.length) {
        memoriesText = memRes.data.map(m => {
          const date = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          return `[${date}] ${m.content}`;
        }).join('\n\n---\n\n');
      }
      if (factsRes.data?.length) {
        factsText = factsRes.data.map(f => `[${f.category}] ${f.content}`).join('\n');
      }
    }

    // Memory moments with dates
    let momentsText = null;
    if (mode !== 'creative') {
      const { data: momentsData } = await supabaseAdmin
        .from('memory_moments').select('content, created_at').order('created_at', { ascending: false }).limit(5);
      if (momentsData?.length) {
        momentsText = momentsData.map(m => {
          const date = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          return `[${date}] ${m.content}`;
        }).join('\n');
      }
    }

    let projectContext = null;
    if (mode === 'creative' && folderId) {
      const [memRes, docRes] = await Promise.all([
        supabaseAdmin.from('project_memories').select('content, created_at').eq('folder_id', folderId).order('created_at', { ascending: false }).limit(3),
        supabaseAdmin.from('project_documents').select('title, content, doc_type').eq('folder_id', folderId).order('created_at', { ascending: true })
      ]);
      const parts = [];
      if (docRes.data?.length) parts.push('Project documents:\n' + docRes.data.map(d => `[${d.doc_type.toUpperCase()}] ${d.title}:\n${d.content}`).join('\n\n'));
      if (memRes.data?.length) parts.push('Project memory:\n' + memRes.data.map(m => {
        const date = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `[${date}] ${m.content}`;
      }).join('\n\n'));
      if (parts.length) projectContext = parts.join('\n\n---\n\n');
    }

    const [spotifyData, calendarData, mansonData] = await Promise.all([
      getLastfmData(),
      getCalendarData(),
      mode !== 'creative' ? getMansonData() : Promise.resolve(null),
    ]);

    const codebaseContext = mode === 'practical' ? CODEBASE_SUMMARY : null;

    const systemPrompt = buildSystemPrompt({ datetime: nowStr, recentDiary, memoriesText, factsText, momentsText, projectContext, spotifyData, calendarData, mansonData, codebaseContext, mode });

    const tools = [{ type: 'web_search_20250305', name: 'web_search' }];

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

    if (thinkingEnabled) requestParams.thinking = { type: 'enabled', budget_tokens: 10000 };

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
        if (mode !== 'creative') fetch(`${appUrl}/api/diary`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId, recentMessages: messagesForContext.slice(-10) }) }).catch(() => {});
        fetch(`${appUrl}/api/memory-summary`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId, folderId, mode, recentMessages: messagesForContext.slice(-10) }) }).catch(() => {});
      }
    }

    return Response.json({ message: assistantMessage, stopReason });

  } catch (error) {
    console.error('Chat error:', error);
    return Response.json({ error: 'Something went wrong' }, { status: 500 });
  }
      }
