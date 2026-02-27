import { supabaseAdmin } from '../../../lib/supabase';

export async function GET() {
  const { data } = await supabaseAdmin.from('memory_facts').select('*').order('category').order('created_at');
  return Response.json({ facts: data || [] });
}

export async function POST(request) {
  const { category, content } = await request.json();
  const { data, error } = await supabaseAdmin.from('memory_facts').insert({ category, content }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ fact: data });
}

export async function PATCH(request) {
  const { id, content, category } = await request.json();
  const { error } = await supabaseAdmin.from('memory_facts').update({ content, category, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}

export async function DELETE(request) {
  const { id } = await request.json();
  const { error } = await supabaseAdmin.from('memory_facts').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
