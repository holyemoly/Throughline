import { supabaseAdmin } from '../../../lib/supabase';

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from('github_prs')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(5);
    return Response.json({ prs: data || [] });
  } catch (error) {
    return Response.json({ prs: [] });
  }
}

export async function PATCH(request) {
  const { id, status } = await request.json();
  await supabaseAdmin.from('github_prs').update({ status }).eq('id', id);
  return Response.json({ success: true });
}
