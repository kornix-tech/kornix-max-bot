import { parseCommand } from '../bot/commandParser.js';
import { dispatchCommand } from '../bot/commandDispatcher.js';
import type { BotContext } from '../bot/botContext.js';
import type { ConversationStateStore } from '../bot/conversationState.js';
import { formatBotError } from '../bot/messageFormatter.js';
import type { KornixClient } from '../kornix/kornixClient.js';
import type { MaxClient } from './maxClient.js';
import type { MaxCallback, MaxId, MaxMessage, MaxUpdate, MaxWebhookPayload } from './maxTypes.js';
import type { Logger } from '../utils/logger.js';

export type MaxWebhookProcessOptions = {
  rawBody: string;
  requestId: string;
  seasonYear: number;
  kornixClient: KornixClient;
  maxClient: MaxClient;
  conversationStore: ConversationStateStore;
  logger: Logger;
};

export type MaxWebhookProcessResult =
  | { ok: true; handled: true }
  | { ok: true; handled: false; reason: string };

type IncomingTextMessage = {
  update: MaxUpdate;
  userId: MaxId;
  chatId: MaxId | null;
  text: string;
  callbackId: string | null;
};

export async function processMaxWebhook(options: MaxWebhookProcessOptions): Promise<MaxWebhookProcessResult> {
  const updates = parseUpdates(options.rawBody);
  if (!updates.length) {
    options.logger.warn('max_webhook_ignored', { requestId: options.requestId, reason: 'invalid_or_empty_json' });
    return { ok: true, handled: false, reason: 'invalid_or_empty_json' };
  }

  for (const update of updates) {
    const incoming = extractTextMessage(update) ?? extractCallbackCommand(update) ?? extractBotStarted(update);
    if (!incoming) {
      options.logger.info('max_webhook_ignored', {
        requestId: options.requestId,
        updateType: update.update_type ?? update.updateType ?? 'unknown'
      });
      continue;
    }

    if (incoming.callbackId) {
      options.logger.info('max_webhook_callback_received', {
        requestId: options.requestId,
        callbackId: incoming.callbackId,
        command: incoming.text
      });
    }
    await handleIncomingTextMessage(incoming, options);
    return { ok: true, handled: true };
  }

  return { ok: true, handled: false, reason: 'no_text_message' };
}

export function parseUpdates(rawBody: string): MaxUpdate[] {
  if (!rawBody.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(rawBody) as MaxWebhookPayload;
    if (isUpdateList(parsed)) {
      return parsed.updates;
    }
    if (isUpdate(parsed)) {
      return [parsed];
    }
    return [];
  } catch {
    return [];
  }
}

export function extractTextMessage(update: MaxUpdate): IncomingTextMessage | null {
  const updateType = update.update_type ?? update.updateType;
  if (updateType !== 'message_created' || !update.message) {
    return null;
  }

  const text = messageText(update.message);
  const userId = userIdFromMessage(update.message, update);
  const chatId = chatIdFromMessage(update.message, update);
  if (!text || userId === null) {
    return null;
  }
  return { update, userId, chatId, text, callbackId: null };
}

export function extractCallbackCommand(update: MaxUpdate): IncomingTextMessage | null {
  const updateType = update.update_type ?? update.updateType;
  if (updateType !== 'message_callback' || !update.callback) {
    return null;
  }

  const text = callbackPayloadText(update.callback);
  const userId = update.callback.user?.user_id ?? update.callback.user?.id ?? update.user?.user_id ?? update.user?.id ?? null;
  const message = update.callback.message ?? update.message;
  const chatId = message ? chatIdFromMessage(message, update) : update.chat_id ?? null;
  if (!text || userId === null) {
    return null;
  }
  return { update, userId, chatId, text, callbackId: update.callback.callback_id ?? null };
}

export function extractBotStarted(update: MaxUpdate): IncomingTextMessage | null {
  const updateType = update.update_type ?? update.updateType;
  const userId = update.user?.user_id ?? update.user?.id ?? null;
  if (updateType !== 'bot_started' || userId === null) {
    return null;
  }
  return { update, userId, chatId: update.chat_id ?? null, text: '/start', callbackId: null };
}

async function handleIncomingTextMessage(
  incoming: IncomingTextMessage,
  options: MaxWebhookProcessOptions
): Promise<void> {
  const command = parseCommand(incoming.text);
  const context: BotContext = {
    requestId: options.requestId,
    userId: incoming.userId,
    chatId: incoming.chatId,
    seasonYear: options.seasonYear,
    kornixClient: options.kornixClient,
    conversationStore: options.conversationStore,
    logger: options.logger
  };

  try {
    const response = await dispatchCommand(command, context);
    await sendReply(options.maxClient, incoming, response);
    await answerCallbackSafely(options.maxClient, incoming.callbackId, options);
  } catch (error) {
    options.logger.error('max_webhook_command_failed', {
      requestId: options.requestId,
      commandType: command.type,
      message: error instanceof Error ? error.message : String(error)
    });
    await sendReply(options.maxClient, incoming, { text: formatBotError() });
    await answerCallbackSafely(options.maxClient, incoming.callbackId, options);
  }
}

async function answerCallbackSafely(
  maxClient: MaxClient,
  callbackId: string | null,
  options: MaxWebhookProcessOptions
): Promise<void> {
  if (!callbackId) {
    return;
  }
  try {
    await maxClient.answerCallback(callbackId);
  } catch (error) {
    options.logger.warn('max_callback_answer_failed', {
      requestId: options.requestId,
      callbackId,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

async function sendReply(
  maxClient: MaxClient,
  incoming: IncomingTextMessage,
  response: { text: string; attachments?: unknown[] | null }
): Promise<void> {
  const options = response.attachments === undefined ? undefined : { attachments: response.attachments };
  if (incoming.chatId !== null) {
    await maxClient.sendMessageToChat(incoming.chatId, response.text, options);
    return;
  }
  await maxClient.sendMessageToUser(incoming.userId, response.text, options);
}

function isUpdateList(value: unknown): value is { updates: MaxUpdate[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'updates' in value &&
    Array.isArray((value as { updates?: unknown }).updates)
  );
}

function isUpdate(value: unknown): value is MaxUpdate {
  return typeof value === 'object' && value !== null;
}

function messageText(message: MaxMessage): string | null {
  if (typeof message.body?.text === 'string') {
    return message.body.text;
  }
  if (typeof message.text === 'string') {
    return message.text;
  }
  return null;
}

function callbackPayloadText(callback: MaxCallback): string | null {
  if (typeof callback.payload === 'string' && callback.payload.trim()) {
    return callback.payload;
  }
  return null;
}

function userIdFromMessage(message: MaxMessage, update: MaxUpdate): MaxId | null {
  return message.sender?.user_id ?? message.sender?.id ?? update.user?.user_id ?? update.user?.id ?? null;
}

function chatIdFromMessage(message: MaxMessage, update: MaxUpdate): MaxId | null {
  return message.recipient?.chat_id ?? message.chat?.chat_id ?? message.chat_id ?? update.chat_id ?? null;
}
