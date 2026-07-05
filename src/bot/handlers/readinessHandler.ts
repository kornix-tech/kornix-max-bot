import type { BotContext } from '../botContext.js';
import { formatReadiness } from '../messageFormatter.js';
import type { BotResponse } from '../../types/bot.js';

export async function readinessHandler(context: BotContext): Promise<BotResponse> {
  const readiness = await context.kornixClient.getReadinessCurrent(context.seasonYear);
  return { text: formatReadiness(readiness) };
}
