import { randomUUID } from 'node:crypto';
import { fetch, type RequestInit, type Response } from 'undici';
import type { Logger } from '../utils/logger.js';
import type {
  MaxAnswerCallbackRequest,
  MaxAnswerCallbackResponse,
  MaxId,
  MaxOutgoingMessage,
  MaxSendMessageOptions,
  MaxSendMessageResponse
} from './maxTypes.js';

export type MaxClientOptions = {
  baseUrl: string;
  botToken: string;
  timeoutMs: number;
};

type RequestOptions = {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  timeoutMs?: number;
};

export class MaxApiError extends Error {
  readonly status: number;
  readonly responseBody: unknown;

  constructor(status: number, message: string, responseBody?: unknown) {
    super(message);
    this.name = 'MaxApiError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export class MaxNetworkError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'MaxNetworkError';
    this.cause = cause;
  }
}

export class MaxValidationError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'MaxValidationError';
    this.cause = cause;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    throw new MaxValidationError('MAX API baseUrl is required.');
  }
  return trimmed.replace(/\/+$/, '');
}

function ensurePositiveTimeout(timeoutMs: number): number {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new MaxValidationError(`MAX API timeout must be a positive integer, got: ${timeoutMs}`);
  }
  return timeoutMs;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function buildUrl(baseUrl: string, endpoint: string, query?: RequestOptions['query']): string {
  const url = new URL(endpoint, `${baseUrl}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new MaxValidationError('MAX API returned invalid JSON.', error);
  }
}

function errorMessageFromBody(status: number, body: unknown): string {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return `MAX API ${status}: HTTP error`;
}

export class MaxClient {
  readonly baseUrl: string;
  readonly botToken: string;
  readonly timeoutMs: number;
  private readonly logger: Logger;

  constructor(options: MaxClientOptions, logger: Logger = console) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.botToken = options.botToken.trim();
    this.timeoutMs = ensurePositiveTimeout(options.timeoutMs);
    this.logger = logger;
  }

  sendMessageToUser(userId: MaxId, text: string, options: MaxSendMessageOptions = {}): Promise<MaxSendMessageResponse> {
    return this.sendMessage({ user_id: userId, disable_link_preview: options.disableLinkPreview }, text, options);
  }

  sendMessageToChat(chatId: MaxId, text: string, options: MaxSendMessageOptions = {}): Promise<MaxSendMessageResponse> {
    return this.sendMessage({ chat_id: chatId, disable_link_preview: options.disableLinkPreview }, text, options);
  }

  answerCallback(callbackId: string, text?: string, options: MaxSendMessageOptions = {}): Promise<MaxAnswerCallbackResponse> {
    const notification = text?.trim() || 'Готово';
    const payload: MaxAnswerCallbackRequest = { notification };
    if (options.notify === false) {
      payload.message = null;
    }
    return this.request<MaxAnswerCallbackResponse>('/answers', {
      query: { callback_id: callbackId },
      body: payload
    });
  }

  async request<TResponse>(endpoint: string, options: RequestOptions = {}): Promise<TResponse> {
    const method = 'POST';
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const requestId = randomUUID();
    const url = buildUrl(this.baseUrl, endpoint, options.query);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = performance.now();

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: this.botToken,
      'Content-Type': 'application/json'
    };
    const init: RequestInit = {
      method,
      headers,
      signal: controller.signal
    };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    this.logger.info('max_request_started', { requestId, endpoint, method });

    try {
      const response = await fetch(url, init);
      const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
      this.logger.info('max_request_finished', {
        requestId,
        endpoint,
        method,
        status: response.status,
        durationMs
      });

      const body = await parseJson(response);
      if (!response.ok) {
        throw new MaxApiError(response.status, errorMessageFromBody(response.status, body), body);
      }
      return body as TResponse;
    } catch (error) {
      if (error instanceof MaxApiError || error instanceof MaxValidationError) {
        throw error;
      }
      if (isAbortError(error)) {
        throw new MaxNetworkError(`MAX API request timed out after ${timeoutMs} ms.`, error);
      }
      throw new MaxNetworkError('MAX API network request failed.', error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private sendMessage(
    query: Record<string, string | number | boolean | undefined>,
    text: string,
    options: MaxSendMessageOptions
  ): Promise<MaxSendMessageResponse> {
    const message: MaxOutgoingMessage = { text };
    if (options.attachments !== undefined) {
      message.attachments = options.attachments;
    }
    if (options.notify !== undefined) {
      message.notify = options.notify;
    }
    return this.request<MaxSendMessageResponse>('/messages', {
      query,
      body: message
    });
  }
}
