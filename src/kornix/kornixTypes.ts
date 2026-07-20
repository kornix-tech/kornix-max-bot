export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | { [key: string]: JsonValue } | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type CalculationRunId = string;

export type ApiWarningDto = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiErrorBodyDto = {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
};

export type ApiErrorEnvelopeDto = {
  error?: ApiErrorBodyDto;
};

export type CalculationWindowDto = {
  from: string;
  to: string;
  timezone: string;
};

export type MapBoundsDto = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

export type KornixManagedScopeDto = {
  dateFrom: string;
  dateTo: string;
  fieldSeasonIds: string[];
  scopeVersion: string;
  scopeHash: string;
};

export type KornixApprovalManagedScopeDto = Omit<KornixManagedScopeDto, 'scopeHash'>;

export type KornixReadinessSummaryDto = {
  status: 'pass' | 'pending' | 'fail' | 'degraded';
  checkedAt: string | null;
  operationalRequiredPass: boolean;
  strictFullWeatherPass: boolean;
  missingDailyForcingRows: number;
  missingHourlySourceRows: number;
  failedRequiredMethods: string[];
  nextRetryAt: string | null;
  warnings: ApiWarningDto[];
};

export type KornixMethodDto = {
  methodCode: string;
  label: string;
  methodFamily: string;
  version: string;
  isDefault: boolean;
  isCandidate: boolean;
  isRequired: boolean;
};

export type KornixMethodsResponseDto = {
  defaultMethodCode: string;
  operationalMethodSetCode: string;
  methods: KornixMethodDto[];
};

export type KornixCurrentContextDto = {
  organizationCode: string;
  organizationName: string | null;
  seasonYear: number;
  serverDate: string;
  forecastStartDate: string;
  forecastEndDate: string;
  calculationWindow: CalculationWindowDto;
  managedScope: KornixManagedScopeDto;
  currentOperationalBaseCalculationRunId: CalculationRunId | null;
  currentAppliedCalculationRunId: CalculationRunId | null;
  lastSuccessfulCalculationRunId: CalculationRunId | null;
  latestCalculationRunId?: CalculationRunId | null;
  currentOperationalStatus:
    | 'not_started'
    | 'data_refresh_in_progress'
    | 'data_gap'
    | 'calculation_queued'
    | 'calculation_running'
    | 'completed'
    | 'failed'
    | 'degraded';
  currentAppliedStatus: 'completed' | 'not_available' | 'stale' | 'failed';
  dataFreshnessStatus: 'current' | 'stale' | 'data_gap' | 'source_delay' | 'calculation_failed' | 'degraded';
  frontendMode: 'current_editable' | 'stale_read_only' | 'not_ready';
  submitAllowed: boolean;
  submitBlockedReason: string | null;
  readinessSummary: KornixReadinessSummaryDto;
  readinessDetailsUrl: string;
  availableMethods: KornixMethodDto[];
  defaultMethodCode: string;
  fieldCount: number;
  mapBounds: MapBoundsDto | null;
  generatedAt: string;
  warnings: ApiWarningDto[];
};

export type FieldSeasonCatalogFieldDto = {
  fieldId: string;
  fieldSeasonId: string;
  fieldKey: string;
  fieldName: string;
  areaHa: number | null;
  cropName: string | null;
  cropSowingDate: string | null;
  koef_upper_limit: number | null;
  koef_optimum: number | null;
  koef_lower_limit: number | null;
  geometry: JsonObject | null;
};

export type FieldSeasonCatalogDto = {
  organizationCode: string;
  seasonYear: number;
  generatedAt: string;
  fields: FieldSeasonCatalogFieldDto[];
};

export type FieldSeasonMapPropertiesDto = {
  fieldId: string;
  fieldSeasonId: string;
  fieldKey: string;
  fieldName: string;
  areaHa: number | null;
  cropName: string | null;
  cropSowingDate: string | null;
  latestStatus: 'ok' | 'warning' | 'critical' | 'no_data' | 'not_calculated' | 'calculation_failed';
  day: string;
  soil_field_capacity_water_mm: number | null;
  soil_water_content_mm: number | null;
  water_stress_coefficient: number | null;
  koef_upper_limit: number | null;
  koef_optimum: number | null;
  koef_lower_limit: number | null;
  precipitation_effective_daily_mm: number | null;
  irrigation_effective_daily_mm: number | null;
  recommended_irrigation_date: string | null;
  recommended_irrigation_mm: number | null;
  dataQuality: {
    calculationAvailable: boolean;
    forcingComplete: boolean;
    hasActiveMapping: boolean;
    messages: string[];
  };
};

export type FieldSeasonMapDto = {
  calculationRunId: CalculationRunId;
  generatedAt: string;
  day: string;
  features: Array<{ properties: FieldSeasonMapPropertiesDto }>;
};

export type KornixCalculationRunStatusDto = {
  calculationRunId: CalculationRunId;
  runKind: string;
  status: string;
  organizationCode: string | null;
  seasonYear: number;
  serverDate: string;
  calculationWindow: CalculationWindowDto;
  operationalMethodSetCode: string;
  defaultMethodCode: string;
  startedAt: string | null;
  finishedAt: string | null;
  warnings: ApiWarningDto[];
  error: JsonObject | null;
};

export type KornixCurrentIrrigationLayerCellDto = {
  fieldSeasonId: string;
  irrigationDate: string;
  irrigationMm: number;
  sourceLedgerEventId: string;
  approvedAt: string;
  zone: 'historical_actual' | 'forecast_planned';
};

export type KornixCurrentIrrigationLayerDto = {
  organizationCode: string;
  seasonYear: number;
  managedScope: KornixManagedScopeDto;
  irrigationLayer: KornixCurrentIrrigationLayerCellDto[];
  projectionHash: string;
  generatedAt: string;
};

export type KornixApprovalIrrigationCellDto = {
  fieldSeasonId: string;
  irrigationDate: string;
  irrigationMm: number;
};

export type KornixApprovalClientDiffDto = {
  added: JsonObject[];
  updated: JsonObject[];
  deleted: JsonObject[];
};

export type KornixApprovalRequestDto = {
  seasonYear: number;
  baseCalculationRunId: string;
  approvalClientGeneratedAt?: string | null;
  managedScope: KornixApprovalManagedScopeDto;
  irrigationLayer: KornixApprovalIrrigationCellDto[];
  clientDiff?: KornixApprovalClientDiffDto | null;
};

export type KornixApprovalSubmitResponseDto = {
  approvalBatchId: string;
  calculationRunId: CalculationRunId | null;
  approvalStatus: 'no_changes' | 'pending_calculation' | 'calculation_failed' | 'applied' | 'cancelled' | 'superseded';
  calculationStatus: 'reused_existing' | 'queued' | 'running' | 'completed' | 'failed' | 'not_available';
  reusedPreviousCalculation: boolean;
  pollRequired: boolean;
  pollAfterMs?: number | null;
  statusUrl?: string | null;
  warnings: ApiWarningDto[];
};

export type KornixManualPrecipitationRequestDto = {
  seasonYear: number;
  baseCalculationRunId: string;
  approvalClientGeneratedAt?: string | null;
  managedScope: KornixApprovalManagedScopeDto;
  precipitationLayer: KornixManualPrecipitationCellDto[];
  clientDiff?: KornixApprovalClientDiffDto | null;
};

export type KornixManualPrecipitationCellDto = {
  fieldSeasonId: string;
  day: string;
  precipitationMm: number;
};

export type KornixManualPrecipitationResponseDto = {
  precipitationBatchId: string;
  calculationRunId: CalculationRunId | null;
  approvalStatus: 'no_changes' | 'pending_calculation' | 'applied' | 'calculation_failed';
  calculationStatus: 'reused_existing' | 'queued' | 'running' | 'completed' | 'failed' | 'not_available';
  reusedPreviousCalculation: boolean;
  pollRequired: boolean;
  pollAfterMs?: number | null;
  warnings: ApiWarningDto[];
};

export type KornixReadinessDto = {
  serverDate: string;
  calculationWindow: CalculationWindowDto;
  status: 'pass' | 'pending' | 'fail' | 'degraded';
  productionStatus: 'ready' | 'degraded' | 'not_ready';
  checkedAt: string | null;
  currentAppliedCalculationRunId: CalculationRunId | null;
  runKind: string | null;
  methodCode: string | null;
  profileCode: string | null;
  scope: JsonObject;
  apiContract: JsonObject;
  forcingCoverage: JsonObject;
  scheduler: JsonObject;
  watchdog: JsonObject;
  operationalRequiredPass: boolean;
  strictFullWeatherPass: boolean;
  missingDailyForcingRows: number;
  missingHourlySourceRows: number;
  requiredGaps: JsonObject[];
  optionalGaps: JsonObject[];
  sourceStatuses: JsonObject;
  fieldDailyForcingCoverage: JsonObject;
  hourlySourceCoverage: JsonObject;
  jobStatus: JsonObject;
  nextRetryAt: string | null;
  failedRequiredMethods: string[];
  blockingErrors: string[];
  warnings: ApiWarningDto[];
};

export type KornixClientOptions = {
  baseUrl: string;
  serviceToken: string;
  internalServiceIdentity: string;
  timeoutMs: number;
};
