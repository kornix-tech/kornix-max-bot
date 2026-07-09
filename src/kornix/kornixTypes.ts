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

export type CurrentUserDto = {
  id: string;
  displayName: string;
  email: string | null;
  organizationCode: string | null;
  organizationName: string | null;
  roles: string[];
  farmId?: string | null;
  farmName?: string | null;
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
  areaHa: number;
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

export type KornixApprovalStatusDto = {
  approvalBatchId: string;
  approvalStatus: string;
  ledgerEventsStatus: string;
  calculationRunId: CalculationRunId | null;
  calculationStatus: string | null;
  resultAvailable: boolean;
  pollRequired: boolean;
  warnings: ApiWarningDto[];
  error: JsonObject | null;
  timing: JsonObject;
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
  methodProfileMetadata: JsonObject | null;
  diagnosticsSummary: JsonObject | null;
  warnings: ApiWarningDto[];
  error: JsonObject | null;
};

export type FieldWaterRegimeStatusCode =
  | 'ok'
  | 'warning'
  | 'critical'
  | 'no_data'
  | 'not_calculated'
  | 'calculation_failed';

export type FieldDataQualityDto = {
  calculationAvailable: boolean;
  forcingComplete: boolean;
  hasActiveMapping: boolean;
  messages: string[];
  forcingKind: string;
  metricSourceVersion: string;
};

export type FieldSeasonMapPopupSummaryDto = {
  fieldDisplayName: string;
  lines: string[];
};

export type FieldSeasonMapPropertiesDto = {
  fieldId: string;
  fieldSeasonId: string;
  fieldKey: string;
  fieldName: string | null;
  fieldDisplayName: string | null;
  seasonYear: number;
  areaHa: number | null;
  cropName: string | null;
  cropSowingDate: string | null;
  calculationRunId: CalculationRunId;
  latestStatus: FieldWaterRegimeStatusCode;
  day: string;
  air_temperature_daily_c: Record<string, number | null>;
  relative_humidity_daily_pct: Record<string, number | null>;
  wind_daily_mps: Record<string, number | null>;
  eto_daily_mm: number | null;
  shortwave_radiation_daily_mj_m2: number | null;
  soil_total_capacity_water_mm: number | null;
  soil_field_capacity_water_mm: number | null;
  soil_wilting_point_capacity_water_mm: number | null;
  soil_water_content_mm: number | null;
  koef_upper_limit: number | null;
  koef_optimum: number | null;
  koef_lower_limit: number | null;
  precipitation_effective_daily_mm: number | null;
  irrigation_effective_daily_mm: number | null;
  positive_temperature_sum_from_sowing_c: number | null;
  crop_transpiration_daily_mm: number | null;
  soil_water_start_mm?: number | null;
  soil_water_end_mm?: number | null;
  soil_water_available_mm?: number | null;
  soil_water_available_pct_taw?: number | null;
  soil_water_depletion_mm?: number | null;
  soil_water_depletion_pct_taw?: number | null;
  soil_water_productive_mm?: number | null;
  total_available_water_mm?: number | null;
  readily_available_water_mm?: number | null;
  root_zone_depth_m?: number | null;
  precipitation_raw_daily_mm?: number | null;
  effective_precipitation_daily_mm?: number | null;
  irrigation_raw_daily_mm?: number | null;
  effective_irrigation_daily_mm?: number | null;
  drainage_runoff_daily_mm?: number | null;
  crop_coefficient_kc?: number | null;
  basal_crop_coefficient_kcb?: number | null;
  soil_evaporation_coefficient_ke?: number | null;
  surface_evaporation_reduction_kr?: number | null;
  potential_crop_evapotranspiration_mm?: number | null;
  potential_transpiration_mm?: number | null;
  potential_soil_evaporation_mm?: number | null;
  actual_transpiration_mm?: number | null;
  actual_soil_evaporation_mm?: number | null;
  actual_evapotranspiration_mm?: number | null;
  actual_evapotranspiration_cumulative_mm?: number | null;
  forecastSevenDayDate?: string | null;
  forecastSevenDayEvapotranspirationSumMm?: number | null;
  forecastSevenDayPrecipitationSumMm?: number | null;
  forecastSevenDaySoilWaterContentMm?: number | null;
  forecastSevenDayFieldCapacityWaterMm?: number | null;
  water_stress_coefficient?: number | null;
  crop_stage_code?: string | null;
  days_after_sowing?: number | null;
  calculation_diagnostics_json?: unknown;
  calculation_warnings_json?: unknown;
  recommended_irrigation_date: string | null;
  recommended_irrigation_mm: number | null;
  popupSummary?: FieldSeasonMapPopupSummaryDto | null;
  dataQuality: FieldDataQualityDto;
};

export type FieldSeasonMapFeatureDto = {
  type: 'Feature';
  geometry: JsonObject | null;
  properties: FieldSeasonMapPropertiesDto;
};

export type FieldSeasonMapFeatureCollectionDto = {
  type: 'FeatureCollection';
  organizationCode: string;
  seasonYear: number;
  calculationRunId: CalculationRunId;
  day: string;
  generatedAt: string;
  features: FieldSeasonMapFeatureDto[];
  warnings: ApiWarningDto[];
};

export type MetricPointBaseDto = {
  day: string;
  coverage?: number | null;
  contributingAreaHa?: number | null;
  totalAreaHa?: number | null;
};

export type ScalarMetricPointDto = MetricPointBaseDto & {
  value: unknown;
};

export type MinMeanMaxMetricPointDto = MetricPointBaseDto & {
  min: number | null;
  mean: number | null;
  max: number | null;
};

export type WindMetricPointDto = MetricPointBaseDto & {
  mean: number | null;
  maxGust: number | null;
};

export type KornixMetricSeriesDto =
  | {
      long_name_for_code: string;
      label: string;
      unit: string;
      valueKind: 'scalar';
      chartKind: string;
      points: ScalarMetricPointDto[];
      generatedAt?: string | null;
    }
  | {
      long_name_for_code: string;
      label: string;
      unit: string;
      valueKind: 'min_mean_max';
      chartKind: string;
      points: MinMeanMaxMetricPointDto[];
      generatedAt?: string | null;
    }
  | {
      long_name_for_code: string;
      label: string;
      unit: string;
      valueKind: 'mean_max_gust';
      chartKind: string;
      points: WindMetricPointDto[];
      generatedAt?: string | null;
    };

export type ProfileAggregationDto = {
  mode: 'area_weighted_mean';
  selectedFieldCount: number;
  totalAreaHa: number;
};

export type IrrigationRecommendationDto = {
  fieldSeasonId: string;
  recommended_irrigation_date: string | null;
  recommended_irrigation_mm: number | null;
  recommended_irrigation_reason_code: string | null;
  recommended_irrigation_priority: string | null;
  recommended_irrigation_confidence: number | null;
};

export type KornixProfileTimeseriesDto = {
  organizationCode: string;
  seasonYear: number;
  serverDate: string;
  forecastStartDate: string;
  forecastEndDate: string;
  calculationRunId: CalculationRunId;
  window: CalculationWindowDto;
  selectedFieldSeasonIds: string[];
  aggregation: ProfileAggregationDto | null;
  metrics: KornixMetricSeriesDto[];
  recommendations: IrrigationRecommendationDto[];
  warnings: ApiWarningDto[];
  generatedAt: string;
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

export type GetFieldSeasonMapParams = {
  calculationRunId: CalculationRunId;
  methodCode: string;
  day: string;
};

export type GetProfileTimeseriesParams = {
  calculationRunId: CalculationRunId;
  methodCode: string;
  fieldSeasonIds: string[];
  aggregation?: 'area_weighted_mean';
};

export type KornixClientOptions = {
  baseUrl: string;
  serviceToken: string;
  internalServiceIdentity: string;
  timeoutMs: number;
};
