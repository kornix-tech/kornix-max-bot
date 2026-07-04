import type { KornixClient, KornixClientOptions, KornixEndpointKey } from '../types/kornix.js';

const ENDPOINT_PATHS: Record<KornixEndpointKey, string> = {
  currentContext: '/current-context',
  fieldSeasonCatalog: '/field-seasons/catalog',
  irrigationLayerCurrent: '/irrigation-layer/current',
  approvalSubmit: '/water-regime/approvals',
  approvalStatus: '/water-regime/approvals/{approvalBatchId}',
  calculationRunStatus: '/water-regime/calculation-runs/{calculationRunId}',
  fieldSeasonMap: '/field-seasons/map',
  profileTimeseries: '/water-regime/profile-timeseries',
  readinessCurrent: '/readiness/current',
  methods: '/methods'
};

export function createKornixClient(options: KornixClientOptions): KornixClient {
  return {
    options,
    endpointPath(endpoint: KornixEndpointKey): string {
      return `${options.apiPrefix}${ENDPOINT_PATHS[endpoint]}`;
    }
  };
}
