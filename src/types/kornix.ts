export type KornixEndpointKey =
  | 'currentContext'
  | 'fieldSeasonCatalog'
  | 'irrigationLayerCurrent'
  | 'approvalSubmit'
  | 'approvalStatus'
  | 'calculationRunStatus'
  | 'fieldSeasonMap'
  | 'profileTimeseries'
  | 'readinessCurrent'
  | 'methods';

export type KornixClientOptions = {
  baseUrl: string;
  apiPrefix: string;
  serviceToken?: string;
};

export type KornixClient = {
  readonly options: KornixClientOptions;
  endpointPath(endpoint: KornixEndpointKey): string;
};
