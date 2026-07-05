import type { BotContext } from '../botContext.js';
import { formatHelp } from '../messageFormatter.js';
import type { BotResponse } from '../../types/bot.js';

export async function helpHandler(_context: BotContext): Promise<BotResponse> {
  return { text: formatHelp() };
}
