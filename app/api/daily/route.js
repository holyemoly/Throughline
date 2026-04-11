import { supabaseAdmin } from '../../../lib/supabase';

function isAuthorized(request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  return false;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = { summary: null, autonomous: null, keepAlive: null };

  // 1. Keep-alive ping to Supabase (prevents pause)
  try {
    await supabaseAdmin.from('settings').select('id').limit(1);
    results.keepAlive = 'ok';
  } catch (e) {
    results.keepAlive = `error: ${e.message}`;
  }

  // 2. Check for new messages since last memory summary
  try {
    const { data: lastSummary } = await supabaseAdmin
      .from('memories')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const since = lastSummary?.created_at || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { count } = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since);

    // Only run memory summary if there are at least 20 new messages
    if (count && count >= 20) {
      const summaryUrl = new URL('/api/memory-summary', request.url);
      const res = await fetch(summaryUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('authorization') || '',
        },
      });
      results.summary = res.ok ? `ran (${count} new msgs)` : `failed (${res.status})`;
    } else {
      results.summary = `skipped (${count || 0} new msgs, need 20)`;
    }
  } catch (e) {
    results.summary = `error: ${e.message}`;
  }

  // 3. Always run autonomous time
  try {
    const autoUrl = new URL('/api/autonomous', request.url);
    const res = await fetch(autoUrl.toString(), {
      headers: {
        'Authorization': request.headers.get('authorization') || '',
      },
    });
    const data = await res.json();
    results.autonomous = data.wrote ? `wrote (${data.toolCalls?.length || 0} tools)` : 'no output';
  } catch (e) {
    results.autonomous = `error: ${e.message}`;
  }

  return Response.json(results);
}
