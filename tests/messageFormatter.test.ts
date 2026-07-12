import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatContext,
  formatHelp,
  formatMethods,
  formatReadiness,
  formatStatus,
  formatUnknownCommand
} from '../src/bot/messageFormatter.js';
import type {
  KornixCurrentContextDto,
  KornixMethodsResponseDto,
  KornixReadinessDto
} from '../src/kornix/kornixTypes.js';

function readinessFixture(): KornixReadinessDto {
  return {
    serverDate: '2026-07-05',
    calculationWindow: { from: '2026-04-01', to: '2026-07-12', timezone: 'Europe/Moscow' },
    status: 'pass',
    productionStatus: 'ready',
    checkedAt: '2026-07-05T10:00:00+03:00',
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
    availableMethods: [],
    defaultMethodCode: 'simple',
    fieldCount: 2,
    mapBounds: null,
    generatedAt: '2026-07-05T10:00:00+03:00',
    warnings: []
  };
}

describe('messageFormatter', () => {
  it('formats command lists without markdown requirements', () => {
    assert.match(formatHelp(), /Нажмите кнопку/);
    assert.match(formatUnknownCommand('/wat'), /Неизвестная команда: \/wat/);
  });

  it('formats context, status and readiness summaries', () => {
    assert.match(formatContext(contextFixture()), /Полей: 2/);
    assert.match(formatStatus(readinessFixture()), /productionStatus: ready/);
    assert.match(formatReadiness(readinessFixture()), /operationalRequiredPass: yes/);
  });

  it('formats methods with default and flags', () => {
    const methods: KornixMethodsResponseDto = {
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

    assert.match(formatMethods(methods), /simple \(Simple; default, required\)/);
  });
});
