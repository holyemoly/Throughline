import { supabaseAdmin } from '../../../lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get('folderId');
  const archived = searchParams.get('archived') === 'true';
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    if (folderId) {
      const { data } = await supabaseAdmin
        .from('project_memories')
        .select('*')
        .eq('folder_id', folderId)
        .order('created_at', { ascending: false })
        .limit(limit);
      return Response.json({ memories: data || [] });
    } else {
      const { data } = await supabaseAdmin
        .from('memories')
        .select('*')
        .eq('archived', archived)
        .order('created_at', { ascending: false })
        .limit(limit);
      return Response.json({ memories: data || [] });
    }
  } catch (error) {
    return Response.json({ memories: [] });
  }
}

export async function POST(request) {
  try {
    const { content, conversationId, folderId } = await request.json();

    if (folderId) {
      await supabaseAdmin.from('project_memories').insert({ folder_id: folderId, content, conversation_id: conversationId });
    } else {
      await supabaseAdmin.from('memories').insert({ content, conversation_id: conversationId });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to save memory' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const { id, content, archived, starred } = await request.json();
  const updates = {};
  if (content !== undefined) updates.content = content;
  if (archived !== undefined) updates.archived = archived;
  if (starred !== undefined) updates.starred = starred;

  const { error } = await supabaseAdmin
    .from('memories')
    .update(updates)
    .eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}

export async function DELETE(request) {
  const { id } = await request.json();
  await supabaseAdmin.from('memories').delete().eq('id', id);
  return Response.json({ success: true });
}
