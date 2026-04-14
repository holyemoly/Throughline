import { supabaseAdmin } from './supabase';

// Pricing per million tokens (as of April 2026)
// Source: https://docs.anthropic.com/en/docs/about-claude/pricing
// - input: uncached input tokens
// - cache_write_5m: 5-minute ephemeral cache writes (what Atrium uses)
// - cache_read: cache hit reads (0.1x base input)
// - output: all output tokens including extended thinking
const PRICING = {
  'claude-opus-4-6':    { input: 5,    cache_write_5m: 6.25, cache_read: 0.50, output: 25 },
  'claude-sonnet-4-6':  { input: 3,    cache_write_5m: 3.75, cache_read: 0.30, output: 15 },
  'claude-haiku-4-5':   { input: 1,    cache_write_5m: 1.25, cache_read: 0.10, output: 5 },
  'default':            { input: 3,    cache_write_5m: 3.75, cache_read: 0.30, output: 15 },
};

function getPricing(model) {
  if (PRICING[model]) return PRICING[model];
  for (const key of Object.keys(PRICING)) {
    if (model && model.startsWith(key)) return PRICING[key];
  }
  return PRICING.default;
}

export async function logApiCost({ usage, model, source, conversationId = null }) {
  if (!usage) return;
  try {
    // Raw input tokens reported by the API.
    // Note: for cached requests, input_tokens is the UNCACHED portion —
    // Anthropic breaks cache reads and writes into separate fields.
    const inputTokens = usage.input_tokens || 0;
    const cacheReadTokens = usage.cache_read_input_tokens || 0;
    const cacheWriteTokens = usage.cache_creation_input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;

    const pricing = getPricing(model);
    const inputCost      = (inputTokens      / 1_000_000) * pricing.input;
    const cacheReadCost  = (cacheReadTokens  / 1_000_000) * pricing.cache_read;
    const cacheWriteCost = (cacheWriteTokens / 1_000_000) * pricing.cache_write_5m;
    const outputCost     = (outputTokens     / 1_000_000) * pricing.output;
    const totalCost = inputCost + cacheReadCost + cacheWriteCost + outputCost;

    await supabaseAdmin.from('api_costs').insert({
      conversation_id: conversationId,
      model,
      source,
      // Store both cached_input_tokens (reads, as before) and the total
      // uncached portion (fresh input + write tokens) for accurate reporting.
      input_tokens: inputTokens + cacheWriteTokens,
      cached_input_tokens: cacheReadTokens,
      output_tokens: outputTokens,
      cost_estimate: totalCost,
    });
  } catch (e) {
    console.error('Cost logging failed:', e);
  }
}
