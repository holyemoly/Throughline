import { supabaseAdmin } from '../../../lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const entryType = searchParams.get('type');
  const starred = searchParams.get('starred') === 'true';

  let query = supabaseAdmin
    .from('journal_entries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (entryType) query = query.eq('entry_type', entryType);
  if (starred) query = query.eq('starred', true);

  const { data, error } = await query;
  if (error) return Response.json({ entries: [], error: error.message });
  return Response.json({ entries: data || [] });
}

export async function POST(request) {
  const { content, entryType = 'reflection', conversationId } = await request.json();
  const { data, error } = await supabaseAdmin
    .from('journal_entries')
    .insert({
      content,
      entry_type: entryType,
      conversation_id: conversationId || null,
    })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ entry: data });
}

export async function PATCH(request) {
  const { id, content, starred, entryType } = await request.json();
  const updates = {};
  if (content !== undefined) updates.content = content;
  if (starred !== undefined) updates.starred = starred;
  if (entryType !== undefined) updates.entry_type = entryType;

  const { error } = await supabaseAdmin
    .from('journal_entries')
    .update(updates)
    .eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}

export async function DELETE(request) {
  const { id } = await request.json();
  await supabaseAdmin.from('journal_entries').delete().eq('id', id);
  return Response.json({ success: true });
}
