import { supabaseAdmin } from '../../../lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');

  try {
    let query = supabaseAdmin.from('folders').select('*').order('updated_at', { ascending: false });
    if (mode) query = query.eq('mode', mode);
    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ folders: data || [] });
  } catch (error) {
    return Response.json({ folders: [] });
  }
}

export async function POST(request) {
  try {
    const { name, mode, color } = await request.json();
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);

    const { data, error } = await supabaseAdmin
      .from('folders')
      .insert({ id, name, mode, color: color || '#9b72cf' })
      .select()
      .single();

    if (error) throw error;
    return Response.json({ folder: data });
  } catch (error) {
    return Response.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { id, name, color } = await request.json();
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;

    const { error } = await supabaseAdmin.from('folders').update(updates).eq('id', id);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to update folder' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    // Cascades to conversations, messages, documents, project_memories
    const { error } = await supabaseAdmin.from('folders').delete().eq('id', id);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
