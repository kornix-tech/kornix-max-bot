import type { KornixClient } from '../kornix/kornixClient.js';
import type { MaxId } from '../max/maxTypes.js';
import type { Logger } from '../utils/logger.js';

export type BotContext = {
  requestId: string;
  userId: MaxId;
  chatId: MaxId | null;
  seasonYear: number;
  kornixClient: KornixClient;
  logger: Logger;
};
