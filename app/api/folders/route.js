import { supabaseAdmin } from '../../../lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  try {
    if (id) {
      const { data, error } = await supabaseAdmin.from('folders').select('*').eq('id', id).single();
      if (error) throw error;
      return Response.json({ folder: data });
    }
    const { data, error } = await supabaseAdmin.from('folders').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    return Response.json({ folders: data || [] });
  } catch (error) {
    return Response.json({ folders: [] });
  }
}

export async function POST(request) {
  try {
    const { name, color } = await request.json();
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);

    const { data, error } = await supabaseAdmin
      .from('folders')
      .insert({ id, name, color: color || '#9b72cf', connected_to_main_memory: false })
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
    const { id, name, color, custom_instructions, connected_to_main_memory } = await request.json();
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    if (custom_instructions !== undefined) updates.custom_instructions = custom_instructions;
    if (connected_to_main_memory !== undefined) updates.connected_to_main_memory = connected_to_main_memory;

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
    const { error } = await supabaseAdmin.from('folders').delete().eq('id', id);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
