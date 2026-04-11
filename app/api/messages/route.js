import { supabaseAdmin } from '../../../lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');

  if (!conversationId) return Response.json({ messages: [] });

  try {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return Response.json({ messages: data || [] });
  } catch (error) {
    return Response.json({ messages: [] });
  }
}

export async function DELETE(request) {
  try {
    const { conversationId, index } = await request.json();

    const { data } = await supabaseAdmin
      .from('messages')
      .select('id, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!data || index >= data.length) return Response.json({ success: true });

    const toDelete = data.slice(index).map(m => m.id);
    await supabaseAdmin.from('messages').delete().in('id', toDelete);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
