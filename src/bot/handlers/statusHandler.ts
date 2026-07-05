import type { BotContext } from '../botContext.js';
import { formatStatus } from '../messageFormatter.js';
import type { BotResponse } from '../../types/bot.js';

export async function statusHandler(context: BotContext): Promise<BotResponse> {
  const readiness = await context.kornixClient.getReadinessCurrent(context.seasonYear);
  return { text: formatStatus(readiness) };
}
