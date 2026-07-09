import type { JsonObject, JsonValue } from '../kornix/kornixTypes.js';

export type MaxId = string | number;

export type MaxUser = {
  user_id?: MaxId;
  id?: MaxId;
  name?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_bot?: boolean;
  [key: string]: unknown;
};

export type MaxChat = {
  chat_id?: MaxId;
  id?: MaxId;
  type?: string;
  title?: string;
  is_channel?: boolean;
  [key: string]: unknown;
};

export type MaxMessageBody = {
  text?: string | null;
  mid?: string;
  seq?: number;
  attachments?: unknown[] | null;
  [key: string]: unknown;
};

export type MaxRecipient = {
  user_id?: MaxId;
  chat_id?: MaxId;
  id?: MaxId;
  type?: string;
  [key: string]: unknown;
};

export type MaxMessage = {
  message_id?: string;
  id?: string;
  sender?: MaxUser;
  recipient?: MaxRecipient;
  chat?: MaxChat;
  chat_id?: MaxId;
  timestamp?: number;
  body?: MaxMessageBody | null;
  text?: string;
  [key: string]: unknown;
};

export type MaxCallback = {
  callback_id?: string;
  payload?: string | JsonObject | null;
  user?: MaxUser;
  message?: MaxMessage;
  [key: string]: unknown;
};

export type MaxUpdateType =
  | 'message_created'
  | 'message_callback'
  | 'bot_started'
  | 'bot_added'
  | 'bot_stopped'
  | 'bot_removed'
  | 'message_edited'
  | 'message_removed'
  | string;

export type MaxUpdate = {
  update_type?: MaxUpdateType;
  updateType?: MaxUpdateType;
  timestamp?: number;
  chat_id?: MaxId;
  user?: MaxUser;
  message?: MaxMessage;
  callback?: MaxCallback;
  [key: string]: unknown;
};

export type MaxIncomingMessageUpdate = MaxUpdate & {
  update_type: 'message_created';
  message: MaxMessage;
};

export type MaxOutgoingMessage = {
  text?: string | null;
  attachments?: unknown[] | null;
  link?: JsonObject | null;
  notify?: boolean;
  format?: 'markdown' | 'html';
  [key: string]: JsonValue | unknown;
};

export type MaxInlineKeyboardButton = {
  type: 'message' | 'callback' | 'link' | 'request_contact' | 'request_geo_location' | 'open_app' | 'clipboard';
  text: string;
  payload?: string | JsonObject | null;
  url?: string;
  [key: string]: JsonValue | unknown;
};

export type MaxInlineKeyboardAttachment = {
  type: 'inline_keyboard';
  payload: {
    buttons: MaxInlineKeyboardButton[][];
  };
};

export type MaxSendMessageRequest = MaxOutgoingMessage;

export type MaxSendMessageResponse = {
  message?: MaxMessage;
  success?: boolean;
  [key: string]: unknown;
};

export type MaxAnswerCallbackRequest = {
  message?: MaxOutgoingMessage | null;
  notification?: string | null;
};

export type MaxAnswerCallbackResponse = {
  success: boolean;
  message?: string;
};

export type MaxSendMessageOptions = {
  disableLinkPreview?: boolean;
  notify?: boolean;
  attachments?: unknown[] | null;
};

export type MaxWebhookPayload = MaxUpdate | { updates: MaxUpdate[] };
