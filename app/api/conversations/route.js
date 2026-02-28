import { supabaseAdmin } from '../../../lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get('folderId');
  const mode = searchParams.get('mode');

  try {
    let query = supabaseAdmin
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (folderId) query = query.eq('folder_id', folderId);
    else if (mode) {
      query = query.eq('mode', mode).is('folder_id', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ conversations: data || [] });
  } catch (error) {
    return Response.json({ conversations: [] });
  }
}

export async function POST(request) {
  try {
    const { mode, title, folderId } = await request.json();
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .insert({
        id,
        mode,
        folder_id: folderId || null,
        title: title || 'new conversation',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return Response.json({ conversation: data });
  } catch (error) {
    return Response.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { id, title, starred, folderId } = await request.json();
    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (starred !== undefined) updates.starred = starred;
    if (folderId !== undefined) updates.folder_id = folderId;
    const { error } = await supabaseAdmin.from('conversations').update(updates).eq('id', id);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    // Messages cascade via FK
    const { error } = await supabaseAdmin.from('conversations').delete().eq('id', id);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
