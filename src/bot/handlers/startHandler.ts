import type { BotContext } from '../botContext.js';
import { formatStart } from '../messageFormatter.js';
import type { BotResponse } from '../../types/bot.js';

export async function startHandler(_context: BotContext): Promise<BotResponse> {
  return { text: formatStart() };
}
