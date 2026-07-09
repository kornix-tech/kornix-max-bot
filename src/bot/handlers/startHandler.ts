import type { BotContext } from '../botContext.js';
import { commandButtonKeyboard } from '../keyboards.js';
import type { BotResponse } from '../../types/bot.js';

export async function startHandler(_context: BotContext): Promise<BotResponse> {
  return {
    text: ['КОРНИКС МАКС БОТ', 'Ввод поливов и осадков по полям.'].join('\n'),
    attachments: commandButtonKeyboard([{ text: 'Выбрать поле', command: '/fields' }], 1)
  };
}
