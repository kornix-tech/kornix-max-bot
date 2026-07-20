import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  getGlobalDispatcher,
  MockAgent,
  type Dispatcher,
  type MockPool,
  setGlobalDispatcher
} from 'undici';
import { ApiError, KornixClient, NetworkError, ValidationError } from '../src/kornix/kornixClient.js';
import type { KornixCurrentContextDto } from '../src/kornix/kornixTypes.js';
import type { Logger } from '../src/utils/logger.js';

const BASE_URL = 'https://kornix-api.test';

type LogEntry = {
  message: string;
  meta: Record<string, unknown> | undefined;
};

let originalDispatcher: Dispatcher;
let mockAgent: MockAgent;
let mockPool: MockPool;
let logs: LogEntry[];

function createLogger(): Logger {
  return {
    debug: (message, meta) => logs.push({ message, meta }),
    info: (message, meta) => logs.push({ message, meta }),
    warn: (message, meta) => logs.push({ message, meta }),
    error: (message, meta) => logs.push({ message, meta })
  };
}

function createClient(timeoutMs = 500): KornixClient {
  return new KornixClient(
    {
      baseUrl: BASE_URL,
      serviceToken: 'service-token',
      internalServiceIdentity: 'max-bot',
      timeoutMs
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

function currentContextFixture(): KornixCurrentContextDto {
  return {
    organizationCode: 'SP',
    organizationName: 'SP',
    seasonYear: 2026,
    serverDate: '2026-07-05',
    forecastStartDate: '2026-07-06',
    forecastEndDate: '2026-07-12',
    calculationWindow: { from: '2026-04-01', to: '2026-07-12', timezone: 'Europe/Moscow' },
    managedScope: {
      dateFrom: '2026-06-14',
      dateTo: '2026-07-12',
      fieldSeasonIds: ['field-season-1'],
      scopeVersion: 'scope_server_date_21_7_all_tenant_fields_20260614',
      scopeHash: 'scope-hash'
    },
    currentOperationalBaseCalculationRunId: 'cwr_operational_1',
    currentAppliedCalculationRunId: 'cwr_applied_1',
    lastSuccessfulCalculationRunId: 'cwr_applied_1',
    latestCalculationRunId: 'cwr_applied_1',
    currentOperationalStatus: 'completed',
    currentAppliedStatus: 'completed',
    dataFreshnessStatus: 'current',
    frontendMode: 'current_editable',
    submitAllowed: true,
    submitBlockedReason: null,
    readinessSummary: {
      status: 'pass',
      checkedAt: '2026-07-05T10:00:00+03:00',
      operationalRequiredPass: true,
      strictFullWeatherPass: true,
      missingDailyForcingRows: 0,
      missingHourlySourceRows: 0,
      failedRequiredMethods: [],
      nextRetryAt: null,
      warnings: []
    },
    readinessDetailsUrl: '/api/v2/kornix/readiness/current',
    availableMethods: [
      {
        methodCode: 'simple_eto_single_layer_soil',
        label: 'Simple ETo single-layer soil',
        methodFamily: 'fao90',
        version: '20260614',
        isDefault: true,
        isCandidate: false,
        isRequired: true
      }
    ],
    defaultMethodCode: 'simple_eto_single_layer_soil',
    fieldCount: 1,
    mapBounds: null,
    generatedAt: '2026-07-05T10:00:00+03:00',
    warnings: []
  };
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

describe('KornixClient', () => {
  it('performs a successful request and logs start/end metadata', async () => {
    mockPool
      .intercept({
        path: '/api/v2/kornix/current-context?seasonYear=2026',
        method: 'GET',
        headers: {
          authorization: 'Bearer service-token',
          'x-kornix-internal-service': 'max-bot'
        }
      })
      .reply(200, currentContextFixture());

    const response = await createClient().getCurrentContext(2026);

    assert.equal(response.organizationCode, 'SP');
    assert.equal(logs[0]?.message, 'kornix_request_started');
    assert.equal(logs[1]?.message, 'kornix_request_finished');
    assert.equal(logs[1]?.meta?.status, 200);
    assert.equal(logs[1]?.meta?.method, 'GET');
  });

  it('serializes query parameters for current context requests', async () => {
    mockPool
      .intercept({
        path: '/api/v2/kornix/current-context?seasonYear=2026',
        method: 'GET'
      })
      .reply(200, currentContextFixture());

    const response = await createClient().getCurrentContext(2026);

    assert.equal(response.seasonYear, 2026);
    assert.equal(response.currentAppliedCalculationRunId, 'cwr_applied_1');
  });

  it('loads calculation completion time from the calculation run endpoint', async () => {
    mockPool
      .intercept({
        path: '/api/v2/kornix/water-regime/calculation-runs/cwr_applied_1',
        method: 'GET'
      })
      .reply(200, {
        calculationRunId: 'cwr_applied_1',
        runKind: 'operational',
        status: 'completed',
        organizationCode: 'SP',
        seasonYear: 2026,
        serverDate: '2026-07-05',
        calculationWindow: { from: '2026-04-01', to: '2026-07-12', timezone: 'Europe/Moscow' },
        operationalMethodSetCode: 'production',
        defaultMethodCode: 'simple_eto_single_layer_soil',
        startedAt: '2026-07-05T09:00:00Z',
        finishedAt: '2026-07-05T09:30:00Z',
        warnings: [],
        error: null
      });

    const response = await createClient().getCalculationRunStatus('cwr_applied_1');

    assert.equal(response.finishedAt, '2026-07-05T09:30:00Z');
  });

  it('throws ApiError for 404 envelopes', async () => {
    mockPool
      .intercept({ path: '/api/v2/kornix/water-regime/approvals/missing-batch', method: 'GET' })
      .reply(404, {
        error: {
          code: 'APPROVAL_BATCH_NOT_FOUND',
          message: 'Approval batch was not found.',
          requestId: 'req-404'
        }
      });

    const error = await captureError(
      createClient().request('/api/v2/kornix/water-regime/approvals/missing-batch')
    );

    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 404);
    assert.equal(error.code, 'APPROVAL_BATCH_NOT_FOUND');
    assert.equal(error.requestId, 'req-404');
  });

  it('throws ApiError for 500 without a KORNIX error envelope', async () => {
    mockPool.intercept({ path: '/api/v2/kornix/methods', method: 'GET' }).reply(500, 'backend exploded');

    const error = await captureError(createClient().getMethods());

    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 500);
    assert.equal(error.code, 'http_error');
  });

  it('throws NetworkError on request timeout', async () => {
    mockPool
      .intercept({ path: '/api/v2/kornix/current-context?seasonYear=2026', method: 'GET' })
      .reply(200, currentContextFixture())
      .delay(50);

    const error = await captureError(createClient(1).getCurrentContext(2026));

    assert.ok(error instanceof NetworkError);
    assert.match(error.message, /timed out/i);
  });

  it('throws ValidationError on invalid JSON', async () => {
    mockPool
      .intercept({ path: '/api/v2/kornix/current-context?seasonYear=2026', method: 'GET' })
      .reply(200, 'not-json', { headers: { 'content-type': 'application/json' } });

    const error = await captureError(createClient().getCurrentContext(2026));

    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /invalid JSON/i);
  });
});
