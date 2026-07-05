import type { CalculationRunId, GetFieldSeasonMapParams, GetProfileTimeseriesParams } from './kornixTypes.js';

export const KORNIX_API_PREFIX = '/api/v2/kornix';

export type QueryPrimitive = string | number | boolean | null | undefined;
export type QueryValue = QueryPrimitive | QueryPrimitive[];
export type QueryParams = Record<string, QueryValue>;

export function serializeQuery(params: QueryParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      const items = value.filter((item): item is string | number | boolean => item !== null && item !== undefined);
      if (items.length > 0) {
        query.set(key, items.map(String).join(','));
      }
      continue;
    }
    if (value !== null && value !== undefined) {
      query.set(key, String(value));
    }
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

function pathWithQuery(path: string, params: QueryParams): string {
  return `${path}${serializeQuery(params)}`;
}

export const kornixEndpoints = {
  me: '/api/v2/me',
  methods: `${KORNIX_API_PREFIX}/methods`,
  waterRegimeApprovals: `${KORNIX_API_PREFIX}/water-regime/approvals`,

  currentContext(seasonYear: number): string {
    return pathWithQuery(`${KORNIX_API_PREFIX}/current-context`, { seasonYear });
  },

  readinessCurrent(seasonYear: number): string {
    return pathWithQuery(`${KORNIX_API_PREFIX}/readiness/current`, { seasonYear });
  },

  currentIrrigationLayer(seasonYear: number): string {
    return pathWithQuery(`${KORNIX_API_PREFIX}/irrigation-layer/current`, { seasonYear });
  },

  fieldSeasonCatalog(seasonYear: number): string {
    return pathWithQuery(`${KORNIX_API_PREFIX}/field-seasons/catalog`, { seasonYear });
  },

  fieldSeasonMap(params: GetFieldSeasonMapParams): string {
    return pathWithQuery(`${KORNIX_API_PREFIX}/field-seasons/map`, {
      calculationRunId: params.calculationRunId,
      methodCode: params.methodCode,
      day: params.day
    });
  },

  profileTimeseries(params: GetProfileTimeseriesParams): string {
    return pathWithQuery(`${KORNIX_API_PREFIX}/water-regime/profile-timeseries`, {
      calculationRunId: params.calculationRunId,
      methodCode: params.methodCode,
      fieldSeasonIds: params.fieldSeasonIds,
      aggregation: params.fieldSeasonIds.length > 1 ? (params.aggregation ?? 'area_weighted_mean') : params.aggregation
    });
  },

  approvalStatus(approvalBatchId: string): string {
    return `${KORNIX_API_PREFIX}/water-regime/approvals/${encodeURIComponent(approvalBatchId)}`;
  },

  calculationRunStatus(calculationRunId: CalculationRunId): string {
    return `${KORNIX_API_PREFIX}/water-regime/calculation-runs/${encodeURIComponent(calculationRunId)}`;
  }
} as const;
