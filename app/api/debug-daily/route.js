import { supabaseAdmin } from '../../../lib/supabase';

export async function GET(request) {
  const results = {
    timestamp: new Date().toISOString(),
    env_check: {
      has_cron_secret: !!process.env.CRON_SECRET,
      cron_secret_length: process.env.CRON_SECRET?.length || 0,
      has_anthropic_key: !!process.env.ANTHROPIC_API_KEY,
    },
    last_autonomous_runs: null,
    recent_journal_entries: null,
    daily_call: null,
  };

  // Check the autonomous_runs table for recent fires
  try {
    const { data } = await supabaseAdmin
      .from('autonomous_runs')
      .select('*')
      .order('fired_at', { ascending: false })
      .limit(5);
    results.last_autonomous_runs = data || [];
  } catch (e) {
    results.last_autonomous_runs = `error: ${e.message}`;
  }

  // Check the journal_entries table for recent entries
  try {
    const { data } = await supabaseAdmin
      .from('journal_entries')
      .select('id, entry_type, created_at, content')
      .order('created_at', { ascending: false })
      .limit(5);
    results.recent_journal_entries = (data || []).map(e => ({
      id: e.id,
      entry_type: e.entry_type,
      created_at: e.created_at,
      content_preview: e.content?.slice(0, 100) + '...',
    }));
  } catch (e) {
    results.recent_journal_entries = `error: ${e.message}`;
  }

  // Try calling the daily route directly with the cron secret
  try {
    const url = new URL('/api/daily', request.url);
    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'missing'}`,
      },
    });
    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    results.daily_call = {
      status: res.status,
      response: parsed,
    };
  } catch (e) {
    results.daily_call = `error: ${e.message}`;
  }

  return Response.json(results, {
    headers: { 'Content-Type': 'application/json' }
  });
}
