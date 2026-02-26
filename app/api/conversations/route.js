import { supabaseAdmin } from '../../../lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'conversation';

  try {
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('mode', mode)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return Response.json({ conversations: data || [] });
  } catch (error) {
    console.error('Get conversations error:', error);
    return Response.json({ conversations: [] });
  }
}

export async function POST(request) {
  try {
    const { mode, title } = await request.json();
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .insert({
        id,
        mode,
        title: title || 'new conversation',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return Response.json({ conversation: data });
  } catch (error) {
    console.error('Create conversation error:', error);
    return Response.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { id, title } = await request.json();

    const { error } = await supabaseAdmin
      .from('conversations')
      .update({ title })
      .eq('id', id);

    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to rename' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id, mode } = await request.json();
    const table = mode === 'creative' ? 'creative_messages' : 'messages';

    await supabaseAdmin.from(table).delete().eq('conversation_id', id);
    await supabaseAdmin.from('conversations').delete().eq('id', id);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
