import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createMiniAppHandler } from '../src/miniapp/miniAppHandler.js';
import type { KornixClient } from '../src/kornix/kornixClient.js';
import type { AppConfig } from '../src/types/config.js';
import type { Logger } from '../src/utils/logger.js';

const config: AppConfig = {
  nodeEnv: 'development', port: 3000, kornixApiBaseUrl: 'https://test.invalid', kornixServiceToken: '',
  kornixInternalServiceIdentity: 'max-bot', maxBotToken: 'm'.repeat(32), maxWebhookSecret: 'w'.repeat(32),
  maxApiBaseUrl: 'https://platform-api2.max.ru', maxRequestTimeoutMs: 1000, defaultSeasonYear: 2026,
  logLevel: 'error', miniAppEnabled: true, miniAppPublicUrl: '', miniAppInitDataMaxAgeSeconds: 300,
  miniAppSessionSecret: 's'.repeat(32), miniAppSessionTtlSeconds: 3600, miniAppAllowedOrigins: [],
  miniAppPolivLinkUrl: 'https://poliv360.ru/link', miniAppDevMode: true, miniAppDevMaxUserId: 'miniapp-dev-user'
};

const field = {
  fieldId: 'field-1', fieldSeasonId: 'field-season-1', fieldKey: 'SP:1.1', fieldName: 'Участок 1.1',
  areaHa: 12.5, cropName: 'Пшеница', cropSowingDate: null, koef_upper_limit: null, koef_optimum: null,
  koef_lower_limit: null, geometry: null
};
const context = {
  organizationCode: 'SP', organizationName: 'СП', seasonYear: 2026, serverDate: '2026-07-22',
  forecastStartDate: '2026-07-23', forecastEndDate: '2026-07-29',
  calculationWindow: { from: '2026-04-01', to: '2026-07-29', timezone: 'Europe/Moscow' },
  managedScope: { dateFrom: '2026-07-01', dateTo: '2026-07-29', fieldSeasonIds: ['field-season-1'], scopeVersion: 'v1', scopeHash: 'h1' },
  currentOperationalBaseCalculationRunId: 'run-1', currentAppliedCalculationRunId: 'run-1', lastSuccessfulCalculationRunId: 'run-1',
  currentOperationalStatus: 'completed', currentAppliedStatus: 'completed', dataFreshnessStatus: 'current', frontendMode: 'current_editable',
  submitAllowed: true, submitBlockedReason: null,
  readinessSummary: { status: 'pass', checkedAt: null, operationalRequiredPass: true, strictFullWeatherPass: true, missingDailyForcingRows: 0, missingHourlySourceRows: 0, failedRequiredMethods: [], nextRetryAt: null, warnings: [] },
  readinessDetailsUrl: '/readiness', availableMethods: [], defaultMethodCode: 'simple', fieldCount: 1, mapBounds: null, generatedAt: '2026-07-22T10:00:00Z', warnings: []
} as const;
let submitCount = 0;
const client = {
  getCurrentContext: async () => context,
  getFieldSeasonMap: async () => ({ calculationRunId: 'run-1', generatedAt: '2026-07-22T10:00:00Z', day: '2026-07-22', features: [{ properties: { ...field, latestStatus: 'ok', day: '2026-07-22', soil_field_capacity_water_mm: 150, soil_water_content_mm: 120, water_stress_coefficient: .9, precipitation_effective_daily_mm: 0, irrigation_effective_daily_mm: 0, recommended_irrigation_date: null, recommended_irrigation_mm: null, dataQuality: { calculationAvailable: true, forcingComplete: true, hasActiveMapping: true, messages: [] } } }] }),
  getFieldSeasonCatalog: async () => ({ organizationCode: 'SP', seasonYear: 2026, generatedAt: '', fields: [field] }),
  getMethods: async () => ({ defaultMethodCode: 'simple', operationalMethodSetCode: 'prod', methods: [{ methodCode: 'simple', label: 'Простой', methodFamily: 'fao', version: '1', isDefault: true, isCandidate: false, isRequired: true }] }),
  getReadinessCurrent: async () => ({ status: 'pass', productionStatus: 'ready' }),
  getCurrentIrrigationLayer: async () => ({ organizationCode: 'SP', seasonYear: 2026, managedScope: context.managedScope, irrigationLayer: [], projectionHash: 'p', generatedAt: '' }),
  submitWaterRegimeApproval: async () => { submitCount += 1; return { approvalBatchId: 'a1', calculationRunId: 'r2', approvalStatus: 'pending_calculation', calculationStatus: 'queued', reusedPreviousCalculation: false, pollRequired: true, warnings: [] }; },
  submitManualPrecipitation: async () => ({ precipitationBatchId: 'p1', calculationRunId: 'r2', approvalStatus: 'pending_calculation', calculationStatus: 'queued', reusedPreviousCalculation: false, pollRequired: true, warnings: [] })
} as unknown as KornixClient;
const logger: Logger = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined };

let server: Server;
let baseUrl: string;

before(async () => {
  server = createServer(createMiniAppHandler({ config, kornixClient: client, logger }));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

async function json(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  return { response, body: await response.json() as Record<string, unknown> };
}

async function authToken() {
  const { response, body } = await json('/miniapp/api/v1/auth/max', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: '', devUserId: 'miniapp-dev-user' })
  });
  assert.equal(response.status, 200);
  return body.token as string;
}

describe('Mini App HTTP API', () => {
  it('authenticates only the explicit development identity and exposes me', async () => {
    const token = await authToken();
    const { response, body } = await json('/miniapp/api/v1/me', { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    assert.equal(body.status, 'linked');
  });

  it('rejects API requests without a session', async () => {
    assert.equal((await json('/miniapp/api/v1/fields')).response.status, 401);
  });

  it('loads fields and validates draft input at the server boundary', async () => {
    const token = await authToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const fields = await json('/miniapp/api/v1/fields', { headers });
    assert.equal(fields.response.status, 200);
    const invalid = await json('/miniapp/api/v1/drafts/current/items', { method: 'POST', headers, body: JSON.stringify({ type: 'irrigation', fieldId: 'field-season-1', date: '2026-07-22', millimeters: 0 }) });
    assert.equal(invalid.response.status, 422);
  });

  it('submits a draft once and replays the idempotent result', async () => {
    submitCount = 0;
    const token = await authToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const added = await json('/miniapp/api/v1/drafts/current/items', { method: 'POST', headers, body: JSON.stringify({ type: 'irrigation', fieldId: 'field-season-1', date: '2026-07-22', millimeters: 12, methodCode: 'simple' }) });
    assert.equal(added.response.status, 201);
    const submitHeaders = { ...headers, 'Idempotency-Key': 'fixed-submit-key' };
    const first = await json('/miniapp/api/v1/drafts/current/submit', { method: 'POST', headers: submitHeaders, body: '{}' });
    const replay = await json('/miniapp/api/v1/drafts/current/submit', { method: 'POST', headers: submitHeaders, body: '{}' });
    assert.equal(first.response.status, 200);
    assert.equal(replay.response.status, 200);
    assert.equal(replay.body.replayed, true);
    assert.equal(submitCount, 1);
  });

  it('revokes the session on logout', async () => {
    const token = await authToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    assert.equal((await json('/miniapp/api/v1/auth/logout', { method: 'POST', headers, body: '{}' })).response.status, 200);
    assert.equal((await json('/miniapp/api/v1/me', { headers })).response.status, 401);
  });
});
