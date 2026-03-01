import { supabaseAdmin } from '../../../lib/supabase';

// GET - load messages for a conversation
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');
  const mode = searchParams.get('mode') || 'conversation';

  if (!conversationId) return Response.json({ messages: [] });

  const table = mode === 'creative' ? 'creative_messages' : 'messages';

  try {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return Response.json({ messages: data || [] });
  } catch (error) {
    return Response.json({ messages: [] });
  }
}

// DELETE - delete a message by position (deletes that message and all after it)
export async function DELETE(request) {
  try {
    const { conversationId, index, mode } = await request.json();
    const table = mode === 'creative' ? 'creative_messages' : 'messages';

    // Get all messages in order
    const { data } = await supabaseAdmin
      .from(table)
      .select('id, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!data || index >= data.length) return Response.json({ success: true });

    // Delete this message and everything after it
    const toDelete = data.slice(index).map(m => m.id);
    await supabaseAdmin.from(table).delete().in('id', toDelete);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
