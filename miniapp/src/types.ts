export type Identity =
  | { status: 'linked'; displayName: string | null; seasonYear: number }
  | { status: 'not_linked' | 'inactive' | 'temporarily_unavailable'; linkUrl: string | null };

export type AuthResponse = {
  token: string;
  expiresAt: number;
  identity: Identity;
  startParam: string | null;
  developmentMode: boolean;
};

export type Context = {
  organizationName: string | null;
  organizationCode: string;
  seasonYear: number;
  serverDate: string;
  currentOperationalStatus: string;
  currentAppliedStatus: string;
  currentAppliedCalculationRunId: string | null;
  lastCalculationFinishedAt: string | null;
  defaultMethodCode: string;
  availableMethods: Method[];
  frontendMode: string;
  submitAllowed: boolean;
  fieldCount: number;
  generatedAt: string;
  readinessSummary: { status: string };
  managedScope: { dateFrom: string; dateTo: string; fieldSeasonIds: string[] };
};

export type Field = {
  fieldId: string;
  fieldSeasonId: string;
  fieldKey: string;
  fieldName: string;
  areaHa: number | null;
  cropName: string | null;
  cropSowingDate: string | null;
};

export type FieldDetails = {
  field: Field;
  status: null | {
    latestStatus: string;
    day: string;
    soil_field_capacity_water_mm: number | null;
    soil_water_content_mm: number | null;
    water_stress_coefficient: number | null;
    recommended_irrigation_date: string | null;
    recommended_irrigation_mm: number | null;
    dataQuality: { calculationAvailable: boolean; forcingComplete: boolean; messages: string[] };
  };
  context: Context;
};

export type Method = { methodCode: string; label: string; isDefault: boolean; isRequired: boolean };
export type DraftItem = {
  id: string;
  type: 'irrigation' | 'precipitation';
  fieldId: string;
  fieldName: string;
  fieldKey: string;
  date: string;
  millimeters: number;
  methodCode: string | null;
};

export type Draft = { id: string; items: DraftItem[]; submitting: boolean };
export type SubmitResult = {
  status: 'success' | 'partial' | 'failed';
  successfulItemIds: string[];
  failed: Array<{ itemId: string; message: string }>;
  replayed?: boolean;
};
