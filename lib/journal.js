import { supabaseAdmin } from './supabase';

// Load N most-recently-active journal entries, each with its full addendum thread.
// "Active" means the latest of: original creation, or most recent addendum.
export async function loadRecentJournalEntries(limit = 5) {
  const { data: entries } = await supabaseAdmin
    .from('journal_entries')
    .select('id, title, content, entry_type, created_at, last_activity_at')
    .eq('archived', false)
    .order('last_activity_at', { ascending: false })
    .limit(limit);

  if (!entries || entries.length === 0) return [];

  // Fetch all addenda for these entries in a single query
  const entryIds = entries.map(e => e.id);
  const { data: allAddenda } = await supabaseAdmin
    .from('journal_addenda')
    .select('journal_entry_id, content, created_at')
    .in('journal_entry_id', entryIds)
    .order('created_at', { ascending: true });

  // Group addenda by parent entry id
  const addendaByEntry = {};
  for (const add of (allAddenda || [])) {
    if (!addendaByEntry[add.journal_entry_id]) addendaByEntry[add.journal_entry_id] = [];
    addendaByEntry[add.journal_entry_id].push(add);
  }

  return entries.map(e => ({ ...e, addenda: addendaByEntry[e.id] || [] }));
}

// Format a single entry with its addenda for inclusion in a system prompt.
// The (#id) part is important — it's how Claude knows which ID to pass to the
// addend_journal_entry tool.
export function formatEntryWithAddenda(entry) {
  const date = new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const titlePart = entry.title ? `"${entry.title}" ` : '';
  const typePart = entry.entry_type ? ` (${entry.entry_type})` : '';
  let formatted = `[${date}] ${titlePart}(#${entry.id})${typePart}\n${entry.content}`;

  if (entry.addenda && entry.addenda.length > 0) {
    for (const add of entry.addenda) {
      const addDate = new Date(add.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      formatted += `\n\n— addendum, ${addDate} —\n${add.content}`;
    }
  }
  return formatted;
}

export function formatEntriesBlock(entries) {
  if (!entries || entries.length === 0) return null;
  return entries.map(formatEntryWithAddenda).join('\n\n---\n\n');
}

// Add an addendum to an existing journal entry. Also bumps last_activity_at
// and unarchives the parent entry, so addending an old entry brings it back
// into the loaded set.
export async function addendJournalEntry(journalEntryId, content) {
  // Verify the entry exists
  const { data: entry, error: lookupErr } = await supabaseAdmin
    .from('journal_entries')
    .select('id')
    .eq('id', journalEntryId)
    .maybeSingle();

  if (lookupErr || !entry) {
    return { success: false, error: `no journal entry found with id ${journalEntryId}` };
  }

  const { error: insertErr } = await supabaseAdmin
    .from('journal_addenda')
    .insert({ journal_entry_id: journalEntryId, content });

  if (insertErr) return { success: false, error: insertErr.message };

  // Bump activity and unarchive
  await supabaseAdmin
    .from('journal_entries')
    .update({ last_activity_at: new Date().toISOString(), archived: false })
    .eq('id', journalEntryId);

  return { success: true };
}
