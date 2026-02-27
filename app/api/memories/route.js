import { supabaseAdmin } from '../../../lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get('folderId');
  const limit = parseInt(searchParams.get('limit') || '3');

  try {
    if (folderId) {
      // Project-specific memory
      const { data } = await supabaseAdmin
        .from('project_memories')
        .select('content, created_at')
        .eq('folder_id', folderId)
        .order('created_at', { ascending: false })
        .limit(limit);
      return Response.json({ memories: data || [] });
    } else {
      // Shared memory (conversation + practical)
      const { data } = await supabaseAdmin
        .from('memories')
        .select('content, created_at')
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
