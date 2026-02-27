import { supabaseAdmin } from '../../../lib/supabase';

export async function GET() {
  const { data } = await supabaseAdmin.from('settings').select('*').eq('id', 'default').single();
  return Response.json({ settings: data || { hot_context_size: 20, default_model: 'claude-sonnet-4-6', thinking_default: false } });
}

export async function PATCH(request) {
  const updates = await request.json();
  await supabaseAdmin.from('settings').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', 'default');
  return Response.json({ success: true });
}
