import { supabaseAdmin } from '../../../lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const source = searchParams.get('source');

  let query = supabaseAdmin
    .from('reasoning_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (source) query = query.eq('source', source);

  const { data } = await query;
  return Response.json({ logs: data || [] });
}
