import { supabaseAdmin } from '../../../lib/supabase';

async function getAccessToken() {
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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sheetId = process.env.MANSON_SHEET_ID;
  const range = searchParams.get('range') || 'Sheet1!A1:F50';

  if (!sheetId) return Response.json({ error: 'No sheet ID configured' }, { status: 500 });

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return Response.json({ error: 'Not connected to Google' }, { status: 401 });

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    return Response.json({ values: data.values || [] });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch sheet' }, { status: 500 });
  }
}
