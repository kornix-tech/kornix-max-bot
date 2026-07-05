import type { BotContext } from '../botContext.js';
import { formatContext } from '../messageFormatter.js';
import type { BotResponse } from '../../types/bot.js';

export async function contextHandler(context: BotContext): Promise<BotResponse> {
  const currentContext = await context.kornixClient.getCurrentContext(context.seasonYear);
  return { text: formatContext(currentContext) };
}
