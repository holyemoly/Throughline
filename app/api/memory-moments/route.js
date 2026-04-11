import { supabaseAdmin } from '../../../lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const archived = searchParams.get('archived') === 'true';
  const type = searchParams.get('type');

  let query = supabaseAdmin
    .from('memory_moments')
    .select('*')
    .eq('archived', archived)
    .order('created_at', { ascending: false })
    .limit(100);

  if (type) query = query.eq('memory_type', type);

  const { data } = await query;
  return Response.json({ moments: data || [] });
}

export async function POST(request) {
  const { content, conversationId, memoryType = 'episodic', source = 'emily' } = await request.json();
  const { data, error } = await supabaseAdmin
    .from('memory_moments')
    .insert({
      content,
      conversation_id: conversationId,
      memory_type: memoryType,
      source,
    })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ moment: data });
}

export async function PATCH(request) {
  const { id, content, memoryType, archived, protected: isProtected } = await request.json();
  const updates = {};
  if (content !== undefined) updates.content = content;
  if (memoryType !== undefined) updates.memory_type = memoryType;
  if (archived !== undefined) updates.archived = archived;
  if (isProtected !== undefined) updates.protected = isProtected;

  const { error } = await supabaseAdmin
    .from('memory_moments')
    .update(updates)
    .eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}

export async function DELETE(request) {
  const { id } = await request.json();
  const { data: moment } = await supabaseAdmin
    .from('memory_moments')
    .select('protected')
    .eq('id', id)
    .single();
  if (moment?.protected) {
    return Response.json({ error: 'This memory is protected. Archive it instead.' }, { status: 403 });
  }
  await supabaseAdmin.from('memory_moments').delete().eq('id', id);
  return Response.json({ success: true });
}
