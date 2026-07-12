import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dispatchCommand } from '../src/bot/commandDispatcher.js';
import { ConversationStateStore } from '../src/bot/conversationState.js';
import { parseCommand } from '../src/bot/commandParser.js';
import type { BotContext } from '../src/bot/botContext.js';
import type {
  FieldSeasonCatalogDto,
  KornixApprovalRequestDto,
  KornixApprovalSubmitResponseDto,
  KornixCurrentContextDto,
  KornixCurrentIrrigationLayerDto,
  KornixManualPrecipitationRequestDto,
  KornixManualPrecipitationResponseDto,
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
  };
}

function currentIrrigationLayerFixture(): KornixCurrentIrrigationLayerDto {
  return {
    organizationCode: 'SP',
    seasonYear: 2026,
    managedScope: {
      dateFrom: '2026-06-14',
      dateTo: '2026-07-12',
      fieldSeasonIds: ['field-season-1'],
      scopeVersion: 'scope-1',
      scopeHash: 'hash-1'
    },
    irrigationLayer: [],
    projectionHash: 'projection-1',
    generatedAt: '2026-07-05T10:00:00+03:00'
  };
}

function approvalResponseFixture(): KornixApprovalSubmitResponseDto {
  return {
    approvalBatchId: 'approval-1',
    calculationRunId: 'calc-1',
    approvalStatus: 'pending_calculation',
    calculationStatus: 'queued',
    reusedPreviousCalculation: false,
    pollRequired: true,
    warnings: []
  };
}

function precipitationResponseFixture(): KornixManualPrecipitationResponseDto {
  return {
    precipitationBatchId: 'precipitation-1',
    calculationRunId: 'calc-precipitation-1',
    approvalStatus: 'pending_calculation',
    calculationStatus: 'queued',
    reusedPreviousCalculation: false,
    pollRequired: true,
    warnings: []
  };
}

function createContext(overrides: Partial<KornixClient> = {}): BotContext {
  const kornixClient = {
    getReadinessCurrent: async () => readinessFixture(),
    getCurrentContext: async () => contextFixture(),
    getFieldSeasonCatalog: async () => catalogFixture(),
    getMethods: async () => methodsFixture(),
    getCurrentIrrigationLayer: async () => currentIrrigationLayerFixture(),
    getFieldSeasonMap: async () => ({
      day: '2026-07-05',
      features: [
        {
          properties: {
            fieldSeasonId: 'field-season-1',
            latestStatus: 'warning',
            day: '2026-07-05',
            soil_water_content_mm: 120,
            precipitation_effective_daily_mm: 2.5,
            irrigation_effective_daily_mm: 10,
            recommended_irrigation_date: '2026-07-06',
            recommended_irrigation_mm: 12,
            dataQuality: {
              calculationAvailable: true,
              forcingComplete: true,
              hasActiveMapping: true,
              messages: []
            }
          }
        }
      ]
    }),
    submitWaterRegimeApproval: async () => approvalResponseFixture(),
    submitManualPrecipitation: async () => precipitationResponseFixture(),
    ...overrides
  } as unknown as KornixClient;

  return {
    requestId: 'req-1',
    userId: 'user-1',
    chatId: 'chat-1',
    seasonYear: 2026,
    kornixClient,
    conversationStore: new ConversationStateStore(),
    logger: logger()
  };
}

describe('dispatchCommand', () => {
  it('dispatches static commands', async () => {
    const response = await dispatchCommand(parseCommand('/start'), createContext());

    assert.equal(response.text, ['КОРНИКС МАКС БОТ', 'Ввод поливов и осадков по полям.'].join('\n'));
    assert.deepEqual(response.attachments, [
      {
        type: 'inline_keyboard',
        payload: {
          buttons: [[{ type: 'callback', text: 'Выбрать поле', payload: '/fields' }]]
        }
      }
    ]);
  });

  it('dispatches KORNIX-backed read-only commands', async () => {
    const context = createContext();

    assert.match((await dispatchCommand(parseCommand('/status'), context)).text, /productionStatus: ready/);
    assert.match((await dispatchCommand(parseCommand('/context'), context)).text, /Полей: 1/);
    const fieldsResponse = await dispatchCommand(parseCommand('/fields'), context);
    assert.equal(fieldsResponse.text, 'Выберите поле');
    assert.deepEqual(fieldsResponse.attachments, [
      {
        type: 'inline_keyboard',
        payload: {
          buttons: [[{ type: 'callback', text: '1.1', payload: '/field 1.1' }]]
        }
      }
    ]);
    assert.match((await dispatchCommand(parseCommand('/methods'), context)).text, /defaultMethodCode: simple/);
    assert.match((await dispatchCommand(parseCommand('/readiness'), context)).text, /status: pass/);
  });

  it('falls back to unknown handler', async () => {
    const response = await dispatchCommand(parseCommand('/approve'), createContext());

    assert.match(response.text, /Неизвестная команда/);
  });

  it('supports field selection and confirmed irrigation input', async () => {
    const context = createContext();

    assert.match((await dispatchCommand(parseCommand('/fields'), context)).text, /Выберите поле/);
    const selectResponse = await dispatchCommand(parseCommand('1.1'), context);
    assert.match(selectResponse.text, /Выбрано поле 1\.1/);
    assert.match(selectResponse.text, /12.5 га, Пшеница/);
    assert.deepEqual(selectResponse.attachments, [
      {
        type: 'inline_keyboard',
        payload: {
          buttons: [
            [{ type: 'callback', text: 'Полив', payload: '/water' }, { type: 'callback', text: 'Осадки', payload: '/rain' }],
            [{ type: 'callback', text: 'Статус поля', payload: '/field-status' }]
          ]
        }
      }
    ]);
    const pendingResponse = await dispatchCommand(parseCommand('/water 2026-07-10 25'), context);
    assert.match(pendingResponse.text, /Проверьте данные/);
    assert.match(pendingResponse.text, /Поле: 1\.1/);
    assert.doesNotMatch(pendingResponse.text, /\/confirm/);
    assert.deepEqual(pendingResponse.attachments, [
      {
        type: 'inline_keyboard',
        payload: {
          buttons: [[{ type: 'callback', text: 'Утверждаю', payload: '/confirm' }, { type: 'callback', text: 'Добавить еще', payload: '/add-more' }]]
        }
      }
    ]);
    assert.match((await dispatchCommand(parseCommand('/confirm'), context)).text, /Полив отправлен/);
  });

  it('shows selected field status from the frontend map endpoint', async () => {
    const context = createContext();
    await dispatchCommand(parseCommand('/fields'), context);
    await dispatchCommand(parseCommand('/field 1.1'), context);

    const response = await dispatchCommand(parseCommand('/field-status'), context);

    assert.match(response.text, /Статус поля 1\.1/);
    assert.match(response.text, /Дата: 05\.07\.2026/);
    assert.match(response.text, /Статус: требует внимания/);
    assert.match(response.text, /Влага в почве: 120 мм/);
    assert.match(response.text, /Рекомендуемый полив: 06\.07\.2026, 12 мм/);
  });

  it('queues several fields and submits them in one approval', async () => {
    const submissions: KornixApprovalRequestDto[] = [];
    const first = catalogFixture().fields[0];
    assert.ok(first);
    const second = { ...first, fieldId: 'field-2', fieldSeasonId: 'field-season-2', fieldKey: 'SP:2.1', fieldName: 'SP:2.1' };
    const context = createContext({
      getFieldSeasonCatalog: async () => ({ ...catalogFixture(), fields: [first, second] }),
      getCurrentContext: async () => ({
        ...contextFixture(),
        managedScope: { ...contextFixture().managedScope, fieldSeasonIds: ['field-season-1', 'field-season-2'] }
      }),
      submitWaterRegimeApproval: async (payload) => {
        submissions.push(payload);
        return approvalResponseFixture();
      }
    });

    await dispatchCommand(parseCommand('/fields'), context);
    await dispatchCommand(parseCommand('/field 1.1'), context);
    await dispatchCommand(parseCommand('/water 2026-07-05 10'), context);
    assert.match((await dispatchCommand(parseCommand('/add-more'), context)).text, /Добавлено записей: 1/);
    await dispatchCommand(parseCommand('/field 2.1'), context);
    const secondDraft = await dispatchCommand(parseCommand('/water 2026-07-05 20'), context);
    assert.match(secondDraft.text, /Всего записей: 2/);

    const response = await dispatchCommand(parseCommand('/confirm'), context);

    assert.match(response.text, /Поле: 1\.1/);
    assert.match(response.text, /Поле: 2\.1/);
    assert.equal(submissions.length, 1);
    assert.deepEqual(submissions[0]?.clientDiff?.added, [
      { fieldSeasonId: 'field-season-1', date: '2026-07-05', mm: 10, source: 'max_bot' },
      { fieldSeasonId: 'field-season-2', date: '2026-07-05', mm: 20, source: 'max_bot' }
    ]);
  });

  it('shows every day of the current month and accepts millimeters after a date click', async () => {
    const context = createContext();
    await dispatchCommand(parseCommand('/fields'), context);
    await dispatchCommand(parseCommand('/field 1'), context);

    const datesResponse = await dispatchCommand(parseCommand('/water'), context);
    assert.match(datesResponse.text, /Выберите дату/);
    const keyboard = datesResponse.attachments as Array<{
      payload: { buttons: Array<Array<{ text: string; payload: string }>> };
    }>;
    const buttons = keyboard[0]?.payload.buttons.flat() ?? [];
    const now = new Date();
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    assert.equal(buttons.length, days + 1);
    assert.deepEqual(buttons[0], {
      type: 'callback',
      text: '1',
      payload: `/water ${now.getFullYear()}-${month}-01`
    });
    assert.equal(buttons.at(-2)?.text, String(days));
    assert.equal(buttons.at(-1)?.payload, '/cancel');

    assert.equal((await dispatchCommand(parseCommand(buttons[0]?.payload ?? ''), context)).text, 'Введите количество мм');
    assert.match((await dispatchCommand(parseCommand('12 мм'), context)).text, /одним числом/);
    assert.match((await dispatchCommand(parseCommand('12.5'), context)).text, /Полив: 12.5 мм/);
  });

  it('submits only irrigation cells inside managed scope', async () => {
    const submissions: KornixApprovalRequestDto[] = [];
    const context = createContext({
      getCurrentIrrigationLayer: async () => ({
        ...currentIrrigationLayerFixture(),
        irrigationLayer: [
          {
            fieldSeasonId: 'field-season-1',
            irrigationDate: '2026-06-10',
            irrigationMm: 10,
            sourceLedgerEventId: 'ledger-outside',
            approvedAt: '2026-06-26T10:00:00+03:00',
            zone: 'historical_actual'
          },
          {
            fieldSeasonId: 'field-season-1',
            irrigationDate: '2026-07-01',
            irrigationMm: 12,
            sourceLedgerEventId: 'ledger-inside',
            approvedAt: '2026-07-01T10:00:00+03:00',
            zone: 'forecast_planned'
          }
        ]
      }),
      submitWaterRegimeApproval: async (payload) => {
        submissions.push(payload);
        return approvalResponseFixture();
      }
    });

    await dispatchCommand(parseCommand('/fields'), context);
    await dispatchCommand(parseCommand('/field 1'), context);
    await dispatchCommand(parseCommand('/water 2026-07-10 25'), context);
    assert.match((await dispatchCommand(parseCommand('/confirm'), context)).text, /Полив отправлен/);

    assert.equal(submissions.length, 1);
    const submitted = submissions[0];
    assert.ok(submitted);
    assert.deepEqual(
      submitted.irrigationLayer.map((cell) => cell.irrigationDate).sort(),
      ['2026-07-01', '2026-07-10']
    );
  });

  it('rejects irrigation dates outside managed scope before submitting', async () => {
    let submitCalled = false;
    const context = createContext({
      submitWaterRegimeApproval: async () => {
        submitCalled = true;
        return approvalResponseFixture();
      }
    });

    await dispatchCommand(parseCommand('/fields'), context);
    await dispatchCommand(parseCommand('/field 1'), context);
    await dispatchCommand(parseCommand('/water 2026-06-01 25'), context);
    const response = await dispatchCommand(parseCommand('/confirm'), context);

    assert.match(response.text, /дата должна быть в окне managedScope 2026-06-14\.\.2026-07-12/);
    assert.equal(submitCalled, false);
  });

  it('supports manual precipitation input', async () => {
    const submissions: KornixManualPrecipitationRequestDto[] = [];
    const context = createContext({
      submitManualPrecipitation: async (payload) => {
        submissions.push(payload);
        return precipitationResponseFixture();
      }
    });

    await dispatchCommand(parseCommand('/fields'), context);
    await dispatchCommand(parseCommand('/field 1'), context);
    assert.match((await dispatchCommand(parseCommand('/rain 2026-07-05 12.5'), context)).text, /Осадки: 12.5 мм/);
    assert.match((await dispatchCommand(parseCommand('/confirm'), context)).text, /Осадки отправлены/);

    assert.equal(submissions.length, 1);
    const submitted = submissions[0];
    assert.ok(submitted);
    assert.equal(submitted.baseCalculationRunId, 'run-1');
    assert.deepEqual(submitted.managedScope, {
      dateFrom: '2026-04-01',
      dateTo: '2026-07-05',
      fieldSeasonIds: ['field-season-1'],
      scopeVersion: 'scope-1'
    });
    assert.deepEqual(submitted.precipitationLayer, []);
    assert.deepEqual(submitted.clientDiff?.added, [
      {
        fieldSeasonId: 'field-season-1',
        day: '2026-07-05',
        precipitationMm: 12.5,
        source: 'max_bot'
      }
    ]);
  });

  it('rejects manual precipitation dates outside precipitation managed scope', async () => {
    let submitCalled = false;
    const context = createContext({
      submitManualPrecipitation: async () => {
        submitCalled = true;
        return precipitationResponseFixture();
      }
    });

    await dispatchCommand(parseCommand('/fields'), context);
    await dispatchCommand(parseCommand('/field 1'), context);
    await dispatchCommand(parseCommand('/rain 2026-07-10 12.5'), context);
    const response = await dispatchCommand(parseCommand('/confirm'), context);

    assert.match(response.text, /дата должна быть в окне managedScope 2026-04-01\.\.2026-07-05/);
    assert.equal(submitCalled, false);
  });
});
