import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  getGlobalDispatcher,
  MockAgent,
  type Dispatcher,
  type MockPool,
  setGlobalDispatcher
} from 'undici';
import {
  MaxApiError,
  MaxClient,
  MaxNetworkError,
  MaxValidationError,
  type MaxClientOptions
} from '../src/max/maxClient.js';
import type { KornixLogger } from '../src/kornix/kornixClient.js';

const BASE_URL = 'https://platform-api2.max.test';

type LogEntry = {
  message: string;
  meta: Record<string, unknown> | undefined;
};

let originalDispatcher: Dispatcher;
let mockAgent: MockAgent;
let mockPool: MockPool;
let logs: LogEntry[];

function createLogger(): KornixLogger {
  return {
    debug: (message, meta) => logs.push({ message, meta }),
    info: (message, meta) => logs.push({ message, meta }),
    warn: (message, meta) => logs.push({ message, meta }),
    error: (message, meta) => logs.push({ message, meta })
  };
}

function createClient(options: Partial<MaxClientOptions> = {}): MaxClient {
  return new MaxClient(
    {
      baseUrl: BASE_URL,
      botToken: 'max-token',
      timeoutMs: 500,
      ...options
    },
    createLogger()
  );
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail('Expected promise to reject.');
}

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  mockPool = mockAgent.get<MockPool>(BASE_URL);
  setGlobalDispatcher(mockAgent);
  logs = [];
});

afterEach(async () => {
  mockAgent.assertNoPendingInterceptors();
  setGlobalDispatcher(originalDispatcher);
  await mockAgent.close();
});

describe('MaxClient', () => {
  it('sends a message to a user and logs request metadata', async () => {
    mockPool
      .intercept({
        path: '/messages?user_id=42&disable_link_preview=true',
        method: 'POST',
        headers: {
          authorization: 'max-token'
        },
        body: JSON.stringify({ text: 'hello', notify: false })
      })
      .reply(200, { success: true, message: { message_id: 'mid-1' } });

    const response = await createClient().sendMessageToUser(42, 'hello', {
      disableLinkPreview: true,
      notify: false
    });

    assert.equal(response.success, true);
    assert.equal(logs[0]?.message, 'max_request_started');
    assert.equal(logs[1]?.message, 'max_request_finished');
    assert.equal(logs[1]?.meta?.status, 200);
    assert.equal(logs[1]?.meta?.method, 'POST');
  });

  it('answers callbacks through the answers endpoint', async () => {
    mockPool
      .intercept({
        path: '/answers?callback_id=callback-1',
        method: 'POST',
        body: JSON.stringify({ notification: 'done', message: null })
      })
      .reply(200, { success: true });

    const response = await createClient().answerCallback('callback-1', 'done', { notify: false });

    assert.equal(response.success, true);
  });

  it('throws MaxApiError for 404 responses', async () => {
    mockPool
      .intercept({ path: '/messages?chat_id=missing-chat', method: 'POST' })
      .reply(404, { message: 'chat not found' });

    const error = await captureError(createClient().sendMessageToChat('missing-chat', 'hello'));

    assert.ok(error instanceof MaxApiError);
    assert.equal(error.status, 404);
    assert.equal(error.message, 'chat not found');
  });

  it('throws MaxApiError for 500 responses', async () => {
    mockPool
      .intercept({ path: '/messages?chat_id=chat-1', method: 'POST' })
      .reply(500, { error: 'backend exploded' });

    const error = await captureError(createClient().sendMessageToChat('chat-1', 'hello'));

    assert.ok(error instanceof MaxApiError);
    assert.equal(error.status, 500);
  });

  it('throws MaxNetworkError on timeout', async () => {
    mockPool
      .intercept({ path: '/messages?chat_id=chat-1', method: 'POST' })
      .reply(200, { success: true })
      .delay(50);

    const error = await captureError(createClient({ timeoutMs: 1 }).sendMessageToChat('chat-1', 'hello'));

    assert.ok(error instanceof MaxNetworkError);
    assert.match(error.message, /timed out/i);
  });

  it('throws MaxValidationError on invalid JSON', async () => {
    mockPool
      .intercept({ path: '/messages?chat_id=chat-1', method: 'POST' })
      .reply(200, 'not-json', { headers: { 'content-type': 'application/json' } });

    const error = await captureError(createClient().sendMessageToChat('chat-1', 'hello'));

    assert.ok(error instanceof MaxValidationError);
    assert.match(error.message, /invalid JSON/i);
  });
});
