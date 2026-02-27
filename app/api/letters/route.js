import { supabaseAdmin } from '../../../lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get('unread') === 'true';
  
  let query = supabaseAdmin.from('letters').select('*').eq('shared_with_emily', true).order('created_at', { ascending: false });
  if (unreadOnly) query = query.eq('read_by_emily', false);
  
  const { data } = await query;
  return Response.json({ letters: data || [] });
}

export async function POST(request) {
  const { content, conversationId, sharedWithEmily } = await request.json();
  const { data, error } = await supabaseAdmin.from('letters').insert({
    content,
    conversation_id: conversationId,
    shared_with_emily: sharedWithEmily || false,
  }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ letter: data });
}

export async function PATCH(request) {
  const { id, readByEmily, sharedWithEmily } = await request.json();
  const updates = {};
  if (readByEmily !== undefined) updates.read_by_emily = readByEmily;
  if (sharedWithEmily !== undefined) updates.shared_with_emily = sharedWithEmily;
  await supabaseAdmin.from('letters').update(updates).eq('id', id);
  return Response.json({ success: true });
}

export async function DELETE(request) {
  const { id } = await request.json();
  await supabaseAdmin.from('letters').delete().eq('id', id);
  return Response.json({ success: true });
}
