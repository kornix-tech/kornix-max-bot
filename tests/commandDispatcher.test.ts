import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dispatchCommand } from '../src/bot/commandDispatcher.js';
import { parseCommand } from '../src/bot/commandParser.js';
import type { BotContext } from '../src/bot/botContext.js';
import type {
  FieldSeasonCatalogDto,
  KornixCurrentContextDto,
  KornixMethodsResponseDto,
  KornixReadinessDto
} from '../src/kornix/kornixTypes.js';
import type { KornixClient } from '../src/kornix/kornixClient.js';
import type { Logger } from '../src/utils/logger.js';

function logger(): Logger {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined
  };
}

function readinessFixture(): KornixReadinessDto {
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
    missingHourlySourceRows: 0,
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

function contextFixture(): KornixCurrentContextDto {
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
      scopeVersion: 'scope-1',
      scopeHash: 'hash-1'
    },
    currentOperationalBaseCalculationRunId: 'run-base',
    currentAppliedCalculationRunId: 'run-1',
    lastSuccessfulCalculationRunId: 'run-1',
    latestCalculationRunId: 'run-1',
    currentOperationalStatus: 'completed',
    currentAppliedStatus: 'completed',
    dataFreshnessStatus: 'current',
    frontendMode: 'current_editable',
    submitAllowed: true,
    submitBlockedReason: null,
    readinessSummary: {
      status: 'pass',
      checkedAt: null,
      operationalRequiredPass: true,
      strictFullWeatherPass: true,
      missingDailyForcingRows: 0,
      missingHourlySourceRows: 0,
      failedRequiredMethods: [],
      nextRetryAt: null,
      warnings: []
    },
    readinessDetailsUrl: '/api/v2/kornix/readiness/current',
    availableMethods: [],
    defaultMethodCode: 'simple',
    fieldCount: 1,
    mapBounds: null,
    generatedAt: '2026-07-05T10:00:00+03:00',
    warnings: []
  };
}

function methodsFixture(): KornixMethodsResponseDto {
  return {
    defaultMethodCode: 'simple',
    operationalMethodSetCode: 'production',
    methods: [
      {
        methodCode: 'simple',
        label: 'Simple',
        methodFamily: 'fao90',
        version: '20260614',
        isDefault: true,
        isCandidate: false,
        isRequired: true
      }
    ]
  };
}

function catalogFixture(): FieldSeasonCatalogDto {
  return {
    organizationCode: 'SP',
    seasonYear: 2026,
    generatedAt: '2026-07-05T10:00:00+03:00',
    fields: [
      {
        fieldId: 'field-1',
        fieldSeasonId: 'field-season-1',
        fieldKey: 'F-1',
        fieldName: 'Поле 1',
        areaHa: 12.5,
        cropName: 'Пшеница',
        cropSowingDate: null,
        koef_upper_limit: null,
        koef_optimum: null,
        koef_lower_limit: null,
        geometry: null
      }
    ]
  };
}

function createContext(): BotContext {
  const kornixClient = {
    getReadinessCurrent: async () => readinessFixture(),
    getCurrentContext: async () => contextFixture(),
    getFieldSeasonCatalog: async () => catalogFixture(),
    getMethods: async () => methodsFixture()
  } as unknown as KornixClient;

  return {
    requestId: 'req-1',
    userId: 'user-1',
    chatId: 'chat-1',
    seasonYear: 2026,
    kornixClient,
    logger: logger()
  };
}

describe('dispatchCommand', () => {
  it('dispatches static commands', async () => {
    const response = await dispatchCommand(parseCommand('/start'), createContext());

    assert.match(response.text, /KORNIX MAX BOT/);
    assert.match(response.text, /\/status/);
  });

  it('dispatches KORNIX-backed read-only commands', async () => {
    const context = createContext();

    assert.match((await dispatchCommand(parseCommand('/status'), context)).text, /productionStatus: ready/);
    assert.match((await dispatchCommand(parseCommand('/context'), context)).text, /Полей: 1/);
    assert.match((await dispatchCommand(parseCommand('/fields'), context)).text, /Поле 1/);
    assert.match((await dispatchCommand(parseCommand('/methods'), context)).text, /defaultMethodCode: simple/);
    assert.match((await dispatchCommand(parseCommand('/readiness'), context)).text, /status: pass/);
  });

  it('falls back to unknown handler', async () => {
    const response = await dispatchCommand(parseCommand('/approve'), createContext());

    assert.match(response.text, /Неизвестная команда/);
  });
});
