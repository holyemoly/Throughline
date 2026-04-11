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

 // Memory summary skipped — handled inline by chat route if ever needed
  results.summary = 'skipped (not part of daily routine)';
  
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
