import { supabaseAdmin } from '../../../../lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  
  if (!code) return Response.redirect('/');

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'https://throughline-nine.vercel.app'}/api/google/callback`;
    
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    
    // Store tokens in Supabase
    await supabaseAdmin.from('integrations').upsert({
      id: 'google',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    });

    return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://throughline-nine.vercel.app'}?connected=google`);
  } catch (error) {
    console.error('Google OAuth error:', error);
    return Response.redirect('/');
  }
}
