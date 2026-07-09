import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractCallbackCommand, extractTextMessage, parseUpdates, processMaxWebhook } from '../src/max/maxWebhook.js';
import { ConversationStateStore } from '../src/bot/conversationState.js';
import type { KornixClient } from '../src/kornix/kornixClient.js';
import type { MaxClient } from '../src/max/maxClient.js';
import type { MaxId, MaxUpdate } from '../src/max/maxTypes.js';
import type { Logger } from '../src/utils/logger.js';

type SentMessage = {
  target: 'chat' | 'user';
  id: MaxId;
  text: string;
  attachments?: unknown[] | null | undefined;
};

function logger(): Logger {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined
  };
}

function createMaxClient(sent: SentMessage[]): MaxClient {
  return {
    sendMessageToChat: async (chatId: MaxId, text: string, options?: { attachments?: unknown[] | null }) => {
      sent.push({ target: 'chat', id: chatId, text, attachments: options?.attachments });
      return { success: true };
    },
    sendMessageToUser: async (userId: MaxId, text: string, options?: { attachments?: unknown[] | null }) => {
      sent.push({ target: 'user', id: userId, text, attachments: options?.attachments });
      return { success: true };
    },
    answerCallback: async () => {
      return { success: true };
    }
  } as unknown as MaxClient;
}

function createKornixClient(fail = false): KornixClient {
  return {
    getReadinessCurrent: async () => {
      if (fail) {
        throw new Error('KORNIX unavailable');
      }
      return {
        serverDate: '2026-07-05',
        calculationWindow: { from: '2026-04-01', to: '2026-07-12', timezone: 'Europe/Moscow' },
        status: 'pass',
        productionStatus: 'ready',
        checkedAt: null,
        currentAppliedCalculationRunId: 'run-1',
        runKind: 'operational',
        methodCode: 'simple',
        profileCode: null,
        scope: {},
        apiContract: {},
        forcingCoverage: {},
        scheduler: {},
        watchdog: {},
        operationalRequiredPass: true,
        strictFullWeatherPass: true,
        missingDailyForcingRows: 0,
        requiredGaps: [],
        optionalGaps: [],
        sourceStatuses: {},
        fieldDailyForcingCoverage: {},
        hourlySourceCoverage: {},
        jobStatus: {},
        nextRetryAt: null,
        failedRequiredMethods: [],
        blockingErrors: [],
        warnings: []
      };
    }
  } as unknown as KornixClient;
}

function messageUpdate(text: string): MaxUpdate {
  return {
    update_type: 'message_created',
    timestamp: 1,
    message: {
      sender: { user_id: 'user-1' },
      recipient: { chat_id: 'chat-1' },
      body: { text }
    }
  };
}

function callbackUpdate(payload: string): MaxUpdate {
  return {
    update_type: 'message_callback',
    timestamp: 1,
    callback: {
      callback_id: 'callback-1',
      payload,
      user: { user_id: 'user-1' },
      message: {
        recipient: { chat_id: 'chat-1' },
        body: { text: 'Выберите поле' }
      }
    }
  };
}

describe('maxWebhook', () => {
  it('parses single updates and update lists', () => {
    assert.equal(parseUpdates(JSON.stringify(messageUpdate('/help'))).length, 1);
    assert.equal(parseUpdates(JSON.stringify({ updates: [messageUpdate('/help')] })).length, 1);
    assert.equal(parseUpdates('{invalid').length, 0);
  });

  it('extracts text message identity from a message_created update', () => {
    const incoming = extractTextMessage(messageUpdate('/status'));

    assert.equal(incoming?.userId, 'user-1');
    assert.equal(incoming?.chatId, 'chat-1');
    assert.equal(incoming?.text, '/status');
  });

  it('extracts callback payload commands from a message_callback update', () => {
    const incoming = extractCallbackCommand(callbackUpdate('/field 1.1'));

    assert.equal(incoming?.userId, 'user-1');
    assert.equal(incoming?.chatId, 'chat-1');
    assert.equal(incoming?.text, '/field 1.1');
    assert.equal(incoming?.callbackId, 'callback-1');
  });

  it('dispatches text commands and sends a chat reply', async () => {
    const sent: SentMessage[] = [];
    const result = await processMaxWebhook({
      rawBody: JSON.stringify(messageUpdate('/help')),
      requestId: 'req-1',
      seasonYear: 2026,
      kornixClient: createKornixClient(),
      maxClient: createMaxClient(sent),
      conversationStore: new ConversationStateStore(),
      logger: logger()
    });

    assert.deepEqual(result, { ok: true, handled: true });
    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.target, 'chat');
    assert.match(sent[0]?.text ?? '', /Доступные команды/);
  });

  it('dispatches callback commands and sends keyboard replies', async () => {
    const sent: SentMessage[] = [];
    const result = await processMaxWebhook({
      rawBody: JSON.stringify(callbackUpdate('/fields')),
      requestId: 'req-1',
      seasonYear: 2026,
      kornixClient: {
        ...createKornixClient(),
        getFieldSeasonCatalog: async () => ({
          organizationCode: 'SP',
          seasonYear: 2026,
          generatedAt: '2026-07-05T10:00:00+03:00',
          fields: [
            {
              fieldId: 'field-1',
              fieldSeasonId: 'field-season-1',
              fieldKey: 'SP:1.1',
              fieldName: 'SP:1.1',
              areaHa: 12.5,
              cropName: 'Пшеница',
              cropSowingDate: null,
              koef_upper_limit: null,
              koef_optimum: null,
              koef_lower_limit: null,
              geometry: null
            }
          ]
        })
      } as unknown as KornixClient,
      maxClient: createMaxClient(sent),
      conversationStore: new ConversationStateStore(),
      logger: logger()
    });

    assert.deepEqual(result, { ok: true, handled: true });
    assert.equal(sent.length, 1);
    assert.match(sent[0]?.text ?? '', /Поле 1\.1/);
    assert.deepEqual(sent[0]?.attachments, [
      {
        type: 'inline_keyboard',
        payload: {
          buttons: [[{ type: 'callback', text: '1.1', payload: '/field 1.1' }]]
        }
      }
    ]);
  });

  it('ignores unsupported update types with 200-compatible result', async () => {
    const sent: SentMessage[] = [];
    const result = await processMaxWebhook({
      rawBody: JSON.stringify({ update_type: 'bot_started', user: { user_id: 'user-1' } }),
      requestId: 'req-1',
      seasonYear: 2026,
      kornixClient: createKornixClient(),
      maxClient: createMaxClient(sent),
      conversationStore: new ConversationStateStore(),
      logger: logger()
    });

    assert.deepEqual(result, { ok: true, handled: false, reason: 'no_text_message' });
    assert.equal(sent.length, 0);
  });

  it('sends a friendly message when KORNIX API fails', async () => {
    const sent: SentMessage[] = [];
    const result = await processMaxWebhook({
      rawBody: JSON.stringify(messageUpdate('/status')),
      requestId: 'req-1',
      seasonYear: 2026,
      kornixClient: createKornixClient(true),
      maxClient: createMaxClient(sent),
      conversationStore: new ConversationStateStore(),
      logger: logger()
    });

    assert.deepEqual(result, { ok: true, handled: true });
    assert.match(sent[0]?.text ?? '', /Не удалось получить данные KORNIX/);
  });
});
