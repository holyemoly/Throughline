import { supabaseAdmin } from '../../../lib/supabase';

export async function GET() {
  const { data } = await supabaseAdmin.from('memory_moments').select('*').order('created_at', { ascending: false }).limit(50);
  return Response.json({ moments: data || [] });
}

export async function POST(request) {
  const { content, conversationId } = await request.json();
  const { data, error } = await supabaseAdmin.from('memory_moments').insert({ content, conversation_id: conversationId }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ moment: data });
}

// Only allow delete of non-protected moments
export async function DELETE(request) {
  const { id } = await request.json();
  const { data: moment } = await supabaseAdmin.from('memory_moments').select('protected').eq('id', id).single();
  if (moment?.protected) return Response.json({ error: 'This memory is protected' }, { status: 403 });
  await supabaseAdmin.from('memory_moments').delete().eq('id', id);
  return Response.json({ success: true });
}
