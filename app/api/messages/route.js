import { supabaseAdmin } from '../../../lib/supabase';

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
