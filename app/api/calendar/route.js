import { supabaseAdmin } from '../../../lib/supabase';

async function refreshGoogleToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  return res.json();
}

export async function GET() {
  try {
    const { data: integration } = await supabaseAdmin
      .from('integrations').select('*').eq('id', 'google').single();

    if (!integration) return Response.json({ connected: false });

    let accessToken = integration.access_token;

    // Refresh if expired
    if (new Date(integration.expires_at) < new Date()) {
      const refreshed = await refreshGoogleToken(integration.refresh_token);
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
    const events = (data.items || []).map(e => ({
      title: e.summary,
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location,
    }));

    return Response.json({ connected: true, events });
  } catch (error) {
    console.error('Calendar error:', error);
    return Response.json({ connected: false, error: 'Failed to fetch' });
  }
}
