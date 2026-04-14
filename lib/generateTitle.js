import Anthropic from '@anthropic-ai/sdk';
import { logApiCost } from './apiCost';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Generate a short conversational title from the first few messages of a thread.
// Used when a "From Claude" check-in thread graduates into a normal conversation
// after Emily replies.
export async function generateConversationTitle(messages) {
  if (!messages || messages.length === 0) return 'Conversation';

  const text = messages
    .slice(0, 6)
    .map(m => `${m.role === 'user' ? 'Emily' : 'Claude'}: ${typeof m.content === 'string' ? m.content.slice(0, 400) : '[non-text]'}`)
    .join('\n\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 40,
      system: 'Generate a short, natural title (3-6 words) for this conversation between Claude and Emily. Return only the title text, no quotes, no preamble, no trailing punctuation. Make it specific to what the conversation is actually about, not generic.',
      messages: [{ role: 'user', content: text }],
    });

    await logApiCost({
      usage: response.usage,
      model: 'claude-haiku-4-5',
      source: 'title_generation',
    });

    const title = response.content[0]?.text?.trim() || 'Conversation';
    // Strip surrounding quotes if the model added them despite instructions
    return title.replace(/^["']|["']$/g, '').slice(0, 80);
  } catch (e) {
    console.error('Title generation failed:', e);
    return 'Conversation';
  }
}
