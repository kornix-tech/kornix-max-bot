import type { KornixClient } from '../kornix/kornixClient.js';
import type { MaxId } from '../max/maxTypes.js';
import type { Logger } from '../utils/logger.js';
import type { ConversationStateStore } from './conversationState.js';

export type BotContext = {
  requestId: string;
  userId: MaxId;
  chatId: MaxId | null;
  seasonYear: number;
  kornixClient: KornixClient;
  conversationStore: ConversationStateStore;
  logger: Logger;
};
