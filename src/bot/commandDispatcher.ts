import type { BotContext } from './botContext.js';
import { formatHelp } from './messageFormatter.js';
import type { BotResponse, ParsedCommand } from '../types/bot.js';

export async function dispatchCommand(_command: ParsedCommand, _context: BotContext): Promise<BotResponse> {
  return { text: formatHelp() };
}
