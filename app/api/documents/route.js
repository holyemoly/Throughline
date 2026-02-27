import { supabaseAdmin } from '../../../lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get('folderId');
  if (!folderId) return Response.json({ documents: [] });

  try {
    const { data, error } = await supabaseAdmin
      .from('project_documents')
      .select('*')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return Response.json({ documents: data || [] });
  } catch (error) {
    return Response.json({ documents: [] });
  }
}

export async function POST(request) {
  try {
    const { folderId, title, content, doc_type } = await request.json();

    const { data, error } = await supabaseAdmin
      .from('project_documents')
      .insert({ folder_id: folderId, title, content, doc_type: doc_type || 'general' })
      .select()
      .single();

    if (error) throw error;
    return Response.json({ document: data });
  } catch (error) {
    return Response.json({ error: 'Failed to create document' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { id, title, content } = await request.json();
    const { error } = await supabaseAdmin
      .from('project_documents')
      .update({ title, content, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to update document' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    const { error } = await supabaseAdmin.from('project_documents').delete().eq('id', id);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
