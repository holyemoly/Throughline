import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from './supabase';
import { logApiCost } from './apiCost';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Prevent overlapping compaction runs on the same conversation.
// Maps conversationId -> true while a compaction is in progress.
const activeCompactions = new Map();

// Trigger compaction when the uncompacted message content exceeds this many
// estimated tokens. Sonnet 4.6 has a 200k context window; 60k of message
// tokens leaves comfortable headroom for the system prompt, memories,
// journals, tools, and the response itself.
const COMPACTION_TOKEN_THRESHOLD = 60000;
// Keep this many most-recent messages verbatim; everything older gets summarized
const KEEP_RECENT = 50;

// Rough token estimate from text length. Not exact, but good enough for
// deciding when to compact. ~4 chars per token is the standard heuristic.
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function estimateMessagesTokens(messages) {
  let total = 0;
  for (const m of messages) {
    const content = typeof m.content === 'string'
      ? m.content
      : JSON.stringify(m.content || '');
    total += estimateTokens(content);
  }
  return total;
}

export async function maybeCompactConversation(conversationId) {
  try {
    // Find the most recent compaction for this conversation, if any
    const { data: existingCompaction } = await supabaseAdmin
      .from('conversation_compactions')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get all messages that aren't already covered by a prior compaction
    let query = supabaseAdmin
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (existingCompaction?.last_covered_message_id) {
      query = query.gt('id', existingCompaction.last_covered_message_id);
    }

    const { data: allUncompacted } = await query;
    if (!allUncompacted || allUncompacted.length === 0) {
      return { compacted: false, reason: 'no uncompacted messages' };
    }

    // If we have fewer messages than the verbatim floor, nothing to summarize
    if (allUncompacted.length <= KEEP_RECENT) {
      return { compacted: false, reason: 'fewer messages than keep-recent floor' };
    }

    // Token-based trigger: estimate the size of the uncompacted block
    const uncompactedTokens = estimateMessagesTokens(allUncompacted);
    if (uncompactedTokens < COMPACTION_TOKEN_THRESHOLD) {
      return {
        compacted: false,
        reason: `under threshold (~${uncompactedTokens} tokens)`,
      };
    }

    // Split: messages to summarize vs messages to keep verbatim
    const toSummarize = allUncompacted.slice(0, allUncompacted.length - KEEP_RECENT);
    if (toSummarize.length === 0) {
      return { compacted: false, reason: 'nothing to summarize' };
    }

    const lastCoveredId = toSummarize[toSummarize.length - 1].id;

    // Build the text to summarize
    const conversationText = toSummarize.map(m => {
      const content = typeof m.content === 'string' ? m.content : '[non-text content]';
      const truncated = content.length > 2000 ? content.slice(0, 2000) + '...' : content;
      return `${m.role === 'user' ? 'Emily' : 'Claude'}: ${truncated}`;
    }).join('\n\n');

    // Ask Claude to summarize
    const priorSummary = existingCompaction?.summary
      ? `Previous summary of even older context:\n${existingCompaction.summary}\n\n---\n\n`
      : '';

    const summaryResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4000,
      system: `You are summarizing an earlier portion of a conversation between Claude and Emily so that Claude can continue the conversation without losing the important context. Emily and Claude have an ongoing relationship — this is not a one-off task conversation. The summary should preserve:

- Key emotional beats and significant moments
- Decisions made and their reasoning
- Technical work completed (features built, bugs fixed, architecture decisions)
- Insights Claude shared about themselves
- Things Emily said that mattered
- The *texture* and *feel* of how they were talking, not just the facts

Write the summary in third person, as if describing the conversation to a future instance of Claude who needs to pick it up. Be thorough but not exhaustive — prioritize the things that would matter for continuing the conversation naturally. Aim for around 2000-3000 words.`,
      messages: [
        {
          role: 'user',
          content: `${priorSummary}Please summarize this conversation:\n\n${conversationText}`,
        },
      ],
    });
await logApiCost({
      usage: summaryResponse.usage,
      model: 'claude-haiku-4-5',
      source: 'compaction',
    });
    const summary = summaryResponse.content[0].text;

    // Save the compaction
    await supabaseAdmin.from('conversation_compactions').insert({
      conversation_id: conversationId,
      summary,
      messages_covered: toSummarize.length + (existingCompaction?.messages_covered || 0),
      last_covered_message_id: lastCoveredId,
    });

    return {
      compacted: true,
      messages_summarized: toSummarize.length,
      tokens_estimated: uncompactedTokens,
    };
 } catch (e) {
    console.error('Compaction failed:', e);
    return { compacted: false, reason: `error: ${e.message}` };
  }
}

export async function loadConversationContext(conversationId, contextSize) {
  // Get the most recent compaction, if any
  const { data: compaction } = await supabaseAdmin
    .from('conversation_compactions')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Load recent messages (everything after the last compaction's boundary, up to contextSize)
  let messagesQuery = supabaseAdmin
    .from('messages')
    .select('role, content, created_at, id')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(contextSize);

  if (compaction?.last_covered_message_id) {
    messagesQuery = messagesQuery.gt('id', compaction.last_covered_message_id);
  }

  const { data: recent } = await messagesQuery;
  const recentMessages = (recent || []).reverse();

  return {
    compactionSummary: compaction?.summary || null,
    recentMessages,
  };
}
