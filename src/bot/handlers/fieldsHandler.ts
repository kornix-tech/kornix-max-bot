import type { BotContext } from '../botContext.js';
import { formatFields } from '../messageFormatter.js';
import type { BotResponse } from '../../types/bot.js';

export async function fieldsHandler(context: BotContext): Promise<BotResponse> {
  const catalog = await context.kornixClient.getFieldSeasonCatalog(context.seasonYear);
  return { text: formatFields(catalog) };
}
