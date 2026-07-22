import type { KornixClient } from './kornixClient.js';
import type {
  FieldSeasonCatalogFieldDto,
  KornixApprovalIrrigationCellDto,
  KornixApprovalManagedScopeDto,
  KornixApprovalSubmitResponseDto,
  KornixManualPrecipitationResponseDto
} from './kornixTypes.js';

export type FieldOperation = {
  field: FieldSeasonCatalogFieldDto;
  date: string;
  mm: number;
};

export type OperationResult<T> = { accepted: true; response: T } | { accepted: false; reason: string };

export async function submitIrrigationOperations(
  client: KornixClient,
  seasonYear: number,
  operations: FieldOperation[]
): Promise<OperationResult<KornixApprovalSubmitResponseDto>> {
  const context = await client.getCurrentContext(seasonYear);
  if (!context.currentAppliedCalculationRunId) {
    return { accepted: false, reason: 'в KORNIX нет currentAppliedCalculationRunId' };
  }
  if (!context.submitAllowed) {
    const detail = context.submitBlockedReason ? ` (${context.submitBlockedReason})` : '';
    return { accepted: false, reason: `submitAllowed=no${detail}` };
  }
  const managedScope = approvalScope(context.managedScope);
  const scopeError = validateScope(operations, managedScope);
  if (scopeError) {
    return { accepted: false, reason: scopeError };
  }

  const currentLayer = await client.getCurrentIrrigationLayer(seasonYear);
  const layer = new Map<string, KornixApprovalIrrigationCellDto>();
  for (const cell of currentLayer.irrigationLayer) {
    if (cell.irrigationMm > 0 && inScope(cell.fieldSeasonId, cell.irrigationDate, managedScope)) {
      layer.set(cellKey(cell.fieldSeasonId, cell.irrigationDate), {
        fieldSeasonId: cell.fieldSeasonId,
        irrigationDate: cell.irrigationDate,
        irrigationMm: cell.irrigationMm
      });
    }
  }

  const added: ReturnType<typeof irrigationDiff>[] = [];
  const updated: ReturnType<typeof irrigationDiff>[] = [];
  for (const operation of operations) {
    const key = cellKey(operation.field.fieldSeasonId, operation.date);
    const previous = layer.get(key);
    layer.set(key, {
      fieldSeasonId: operation.field.fieldSeasonId,
      irrigationDate: operation.date,
      irrigationMm: operation.mm
    });
    (previous ? updated : added).push(irrigationDiff(operation));
  }

  const response = await client.submitWaterRegimeApproval({
    seasonYear,
    baseCalculationRunId: context.currentAppliedCalculationRunId,
    approvalClientGeneratedAt: new Date().toISOString(),
    managedScope,
    irrigationLayer: [...layer.values()],
    clientDiff: { added, updated, deleted: [] }
  });
  return { accepted: true, response };
}

export async function submitPrecipitationOperations(
  client: KornixClient,
  seasonYear: number,
  operations: FieldOperation[]
): Promise<OperationResult<KornixManualPrecipitationResponseDto>> {
  const context = await client.getCurrentContext(seasonYear);
  if (!context.currentAppliedCalculationRunId) {
    return { accepted: false, reason: 'в KORNIX нет currentAppliedCalculationRunId' };
  }
  if (!context.submitAllowed) {
    const detail = context.submitBlockedReason ? ` (${context.submitBlockedReason})` : '';
    return { accepted: false, reason: `submitAllowed=no${detail}` };
  }
  const managedScope: KornixApprovalManagedScopeDto = {
    dateFrom: `${context.seasonYear}-04-01`,
    dateTo: context.serverDate,
    fieldSeasonIds: context.managedScope.fieldSeasonIds,
    scopeVersion: context.managedScope.scopeVersion
  };
  const scopeError = validateScope(operations, managedScope);
  if (scopeError) {
    return { accepted: false, reason: scopeError };
  }

  const response = await client.submitManualPrecipitation({
    seasonYear,
    baseCalculationRunId: context.currentAppliedCalculationRunId,
    approvalClientGeneratedAt: new Date().toISOString(),
    managedScope,
    precipitationLayer: [],
    clientDiff: { added: operations.map(precipitationDiff), updated: [], deleted: [] }
  });
  return { accepted: true, response };
}

function approvalScope(scope: {
  dateFrom: string;
  dateTo: string;
  fieldSeasonIds: string[];
  scopeVersion: string;
}): KornixApprovalManagedScopeDto {
  return {
    dateFrom: scope.dateFrom,
    dateTo: scope.dateTo,
    fieldSeasonIds: scope.fieldSeasonIds,
    scopeVersion: scope.scopeVersion
  };
}

function validateScope(operations: FieldOperation[], scope: KornixApprovalManagedScopeDto): string | null {
  if (operations.some((operation) => !scope.fieldSeasonIds.includes(operation.field.fieldSeasonId))) {
    return 'выбранное поле сейчас вне managedScope KORNIX';
  }
  if (operations.some((operation) => operation.date < scope.dateFrom || operation.date > scope.dateTo)) {
    return `дата должна быть в окне managedScope ${scope.dateFrom}..${scope.dateTo}`;
  }
  return null;
}

function inScope(fieldSeasonId: string, date: string, scope: KornixApprovalManagedScopeDto): boolean {
  return scope.fieldSeasonIds.includes(fieldSeasonId) && date >= scope.dateFrom && date <= scope.dateTo;
}

function cellKey(fieldSeasonId: string, date: string): string {
  return `${fieldSeasonId}:${date}`;
}

function irrigationDiff(operation: FieldOperation) {
  return {
    fieldSeasonId: operation.field.fieldSeasonId,
    date: operation.date,
    mm: operation.mm,
    source: 'max_bot'
  };
}

function precipitationDiff(operation: FieldOperation) {
  return {
    fieldSeasonId: operation.field.fieldSeasonId,
    day: operation.date,
    precipitationMm: operation.mm,
    source: 'max_bot'
  };
}
