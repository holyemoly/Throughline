import { supabaseAdmin } from './supabase';

// Pricing per million tokens (as of April 2026)
// Update these when pricing changes or when adding new models.
const PRICING = {
  'claude-opus-4-6':    { input: 15,   cached: 1.50, output: 75 },
  'claude-sonnet-4-6':  { input: 3,    cached: 0.30, output: 15 },
  'claude-haiku-4-5':   { input: 1,    cached: 0.10, output: 5 },
  // Legacy fallback if we somehow get an unrecognized model string
  'default':            { input: 3,    cached: 0.30, output: 15 },
};

function getPricing(model) {
  if (PRICING[model]) return PRICING[model];
  // Handle versioned model strings like 'claude-haiku-4-5-20251001'
  for (const key of Object.keys(PRICING)) {
    if (model && model.startsWith(key)) return PRICING[key];
  }
  return PRICING.default;
}

// Log the cost of a single Anthropic API call.
// - usage: the usage object from the Anthropic SDK response
// - model: the model string used for the call
// - source: which part of the system made the call
//   ('chat' | 'autonomous' | 'compaction' | 'memory_summary' | 'checkin' | 'reasoning' | 'backfill')
// - conversationId: optional, only meaningful for chat calls
export async function logApiCost({ usage, model, source, conversationId = null }) {
  if (!usage) return;
  try {
    const inputTokens = usage.input_tokens || 0;
    const cachedTokens = usage.cache_read_input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;

    const pricing = getPricing(model);
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const cachedCost = (cachedTokens / 1_000_000) * pricing.cached;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    const totalCost = inputCost + cachedCost + outputCost;

    await supabaseAdmin.from('api_costs').insert({
      conversation_id: conversationId,
      model,
      source,
      input_tokens: inputTokens,
      cached_input_tokens: cachedTokens,
      output_tokens: outputTokens,
      cost_estimate: totalCost,
    });
  } catch (e) {
    console.error('Cost logging failed:', e);
    // Never throw — cost logging is best-effort, never blocks the main request
  }
}
