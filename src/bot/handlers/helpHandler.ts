import type { BotContext } from '../botContext.js';
import { commandButtonKeyboard } from '../keyboards.js';
import { formatHelp } from '../messageFormatter.js';
import type { BotResponse } from '../../types/bot.js';

export async function helpHandler(_context: BotContext): Promise<BotResponse> {
  return {
    text: formatHelp(),
    attachments: commandButtonKeyboard([{ text: 'Выбрать поле', command: '/fields' }], 1)
  };
}
