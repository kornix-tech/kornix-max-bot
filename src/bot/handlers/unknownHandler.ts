import type { BotContext } from '../botContext.js';
import { formatUnknownCommand } from '../messageFormatter.js';
import type { ParsedCommand, BotResponse } from '../../types/bot.js';

export async function unknownHandler(_context: BotContext, command: ParsedCommand): Promise<BotResponse> {
  return { text: formatUnknownCommand(command.rawText) };
}
