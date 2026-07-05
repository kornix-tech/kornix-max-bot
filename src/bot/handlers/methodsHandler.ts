import type { BotContext } from '../botContext.js';
import { formatMethods } from '../messageFormatter.js';
import type { BotResponse } from '../../types/bot.js';

export async function methodsHandler(context: BotContext): Promise<BotResponse> {
  const methods = await context.kornixClient.getMethods();
  return { text: formatMethods(methods) };
}
