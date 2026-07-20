import type { BotContext } from './botContext.js';
import type { InputKind, PendingFieldInput } from './conversationState.js';
import { commandButtonKeyboard } from './keyboards.js';
import type {
  FieldSeasonCatalogFieldDto,
  FieldSeasonMapPropertiesDto,
  KornixApprovalIrrigationCellDto,
  KornixApprovalManagedScopeDto
} from '../kornix/kornixTypes.js';
import { ApiError } from '../kornix/kornixClient.js';
import type { BotResponse, ParsedCommand } from '../types/bot.js';

type ParsedFieldInput = {
  date: string;
  mm: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RU_DATE_RE = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{2}|\d{4}))?$/;

export async function listFieldsForSelection(context: BotContext): Promise<BotResponse> {
  const fields = await loadVisibleFields(context);
  const state = context.conversationStore.get(context.userId, context.chatId);
  state.lastFields = fields;

  const fieldButtons = fields.map((field) => {
    const number = fieldNumber(field);
    return { text: number, command: `/field ${number}` };
  });

  if (!fieldButtons.length) {
    return { text: 'Поля KORNIX не найдены.' };
  }

  return {
    text: 'Выберите поле',
    attachments: commandButtonKeyboard(fieldButtons, 4)
  };
}

export async function selectFieldHandler(context: BotContext, command: ParsedCommand): Promise<BotResponse> {
  const query = command.args.join(' ').trim();
  if (!query) {
    return listFieldsForSelection(context);
  }
  const field = await resolveField(context, query);
  if (!field) {
    return { text: 'Поле не найдено. Напишите /fields и выберите номер из списка.' };
  }

  const state = context.conversationStore.get(context.userId, context.chatId);
  state.selectedField = field;
  state.awaitingInput = null;
  state.inputDate = null;

  let statusText: string;
  try {
    statusText = await loadFieldStatusText(context, field);
  } catch {
    statusText = unavailableFieldStatus(field);
  }

  return {
    text: [
      `Выбрано поле ${fieldNumber(field)}`,
      fieldDetails(field),
      '',
      statusText,
      '',
      'Что внести?'
    ].join('\n'),
    attachments: fieldActionKeyboard()
  };
}

export async function beginFieldInputHandler(
  context: BotContext,
  command: ParsedCommand,
  kind: InputKind
): Promise<BotResponse> {
  const state = context.conversationStore.get(context.userId, context.chatId);
  if (!state.selectedField) {
    const fields = await listFieldsForSelection(context);
    const response: BotResponse = { text: 'Сначала выберите поле.' };
    if (fields.attachments !== undefined) {
      response.attachments = fields.attachments;
    }
    return response;
  }

  const inline = command.args.join(' ').trim();
  if (inline) {
    const parsed = parseFieldInput(inline);
    if (parsed) {
      return setPendingInput(context, kind, state.selectedField, parsed);
    }
    const date = command.args.length === 1 ? parseDateToken(inline) : null;
    if (date) {
      state.awaitingInput = kind;
      state.inputDate = date;
      return { text: 'Введите количество мм' };
    }
    return dateSelectionResponse(kind, state.selectedField);
  }

  state.awaitingInput = kind;
  state.inputDate = null;
  return dateSelectionResponse(kind, state.selectedField);
}

export async function workflowTextInputHandler(context: BotContext, command: ParsedCommand): Promise<BotResponse | null> {
  const state = context.conversationStore.get(context.userId, context.chatId);
  const raw = command.rawText.trim();

  if (state.awaitingInput && state.selectedField) {
    if (!state.inputDate) {
      return dateSelectionResponse(state.awaitingInput, state.selectedField);
    }
    const mm = parseMm(raw);
    if (mm === null || mm <= 0) {
      return { text: 'Введите количество мм одним числом, например: 25 или 12.5' };
    }
    return setPendingInput(context, state.awaitingInput, state.selectedField, { date: state.inputDate, mm });
  }

  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    return selectFieldHandler(context, { ...command, args: [raw] });
  }

  return null;
}

export async function confirmHandler(context: BotContext): Promise<BotResponse> {
  const state = context.conversationStore.get(context.userId, context.chatId);
  if (!state.pendingInputs.length) {
    return {
      text: 'Нет черновика для подтверждения. Выберите поле.',
      attachments: chooseFieldKeyboard()
    };
  }

  const water = state.pendingInputs.filter((item) => item.kind === 'water');
  const rain = state.pendingInputs.filter((item) => item.kind === 'rain');
  const responses: string[] = [];
  for (const [kind, inputs] of [['water', water], ['rain', rain]] as const) {
    if (!inputs.length) {
      continue;
    }
    try {
      responses.push(kind === 'water' ? await submitWater(context, inputs) : await submitRain(context, inputs));
      state.pendingInputs = state.pendingInputs.filter((item) => item.kind !== kind);
    } catch (error) {
      return { text: formatSubmitError(error, kind) };
    }
  }
  state.awaitingInput = null;
  state.inputDate = null;
  return {
    text: responses.join('\n\n'),
    attachments: chooseFieldKeyboard()
  };
}

export async function addMoreHandler(context: BotContext): Promise<BotResponse> {
  const state = context.conversationStore.get(context.userId, context.chatId);
  if (!state.pendingInputs.length) {
    return { text: 'Сначала добавьте полив или осадки.', attachments: chooseFieldKeyboard() };
  }
  const fields = await listFieldsForSelection(context);
  return { ...fields, text: `Добавлено записей: ${state.pendingInputs.length}. Выберите следующее поле.` };
}

export async function fieldStatusHandler(context: BotContext): Promise<BotResponse> {
  const state = context.conversationStore.get(context.userId, context.chatId);
  if (!state.selectedField) {
    return { text: 'Сначала выберите поле.', attachments: chooseFieldKeyboard() };
  }
  try {
    return { text: await loadFieldStatusText(context, state.selectedField) };
  } catch {
    return { text: unavailableFieldStatus(state.selectedField) };
  }
}

export async function cancelHandler(context: BotContext): Promise<BotResponse> {
  const state = context.conversationStore.get(context.userId, context.chatId);
  state.awaitingInput = null;
  state.inputDate = null;
  state.pendingInputs = [];
  return {
    text: 'Черновик отменён. Выбранное поле сохранено.',
    attachments: commandButtonKeyboard(
      [
        { text: 'Полив', command: '/water' },
        { text: 'Осадки', command: '/rain' },
        { text: 'Выбрать поле', command: '/fields' }
      ],
      2
    )
  };
}

function setPendingInput(
  context: BotContext,
  kind: InputKind,
  field: FieldSeasonCatalogFieldDto,
  parsed: ParsedFieldInput
): BotResponse {
  const state = context.conversationStore.get(context.userId, context.chatId);
  state.awaitingInput = null;
  state.inputDate = null;
  const pending: PendingFieldInput = {
    kind,
    field,
    date: parsed.date,
    mm: parsed.mm
  };
  const existing = state.pendingInputs.findIndex((item) => fieldDateKey(item) === fieldDateKey(pending) && item.kind === kind);
  if (existing === -1) {
    state.pendingInputs.push(pending);
  } else {
    state.pendingInputs[existing] = pending;
  }

  return {
    text: [
      'Проверьте данные:',
      ...state.pendingInputs.map((item, index) => [
        `${index + 1}. Поле: ${fieldNumber(item.field)}`,
        `${kindLabel(item.kind)}: ${formatMm(item.mm)} мм`,
        `Дата: ${formatDisplayDate(item.date)}`
      ].join('\n')),
      `Всего записей: ${state.pendingInputs.length}`
    ].join('\n'),
    attachments: commandButtonKeyboard(
      [
        { text: 'Утверждаю', command: '/confirm' },
        { text: 'Добавить еще', command: '/add-more' }
      ],
      2
    )
  };
}

async function resolveField(context: BotContext, query: string): Promise<FieldSeasonCatalogFieldDto | null> {
  const state = context.conversationStore.get(context.userId, context.chatId);
  if (!state.lastFields.length) {
    state.lastFields = await loadVisibleFields(context);
  }

  const normalized = normalize(query);
  const normalizedFieldNumber = normalizeFieldNumber(query);
  if (normalizedFieldNumber) {
    const byFieldNumber = state.lastFields.find((field) => normalize(fieldNumber(field)) === normalizedFieldNumber);
    if (byFieldNumber) {
      return byFieldNumber;
    }
  }

  const index = Number(query);
  if (Number.isInteger(index) && index > 0) {
    return state.lastFields[index - 1] ?? null;
  }

  return (
    state.lastFields.find((field) =>
      [field.fieldName, field.fieldKey, field.fieldSeasonId].some((value) => normalize(value).includes(normalized))
    ) ?? null
  );
}

function parseFieldInput(text: string): ParsedFieldInput | null {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  let date: string | null = null;
  let mm: number | null = null;

  for (const token of tokens) {
    const parsedDate = parseDateToken(token);
    if (parsedDate && !date) {
      date = parsedDate;
      continue;
    }
    const parsedMm = parseMm(token);
    if (parsedMm !== null && mm === null) {
      mm = parsedMm;
    }
  }

  if (!date || mm === null || mm <= 0) {
    return null;
  }
  return { date, mm };
}

function parseDateToken(token: string): string | null {
  const lowered = token.toLowerCase();
  const now = new Date();
  if (lowered === 'сегодня' || lowered === 'today') {
    return formatDate(now);
  }
  if (lowered === 'завтра' || lowered === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow);
  }
  if (DATE_RE.test(token)) {
    return token;
  }
  const ruDate = RU_DATE_RE.exec(token);
  if (ruDate) {
    const [, rawDay, rawMonth, rawYear] = ruDate;
    if (!rawDay || !rawMonth) {
      return null;
    }
    const day = rawDay.padStart(2, '0');
    const month = rawMonth.padStart(2, '0');
    const year = rawYear ? (rawYear.length === 2 ? `20${rawYear}` : rawYear) : String(new Date().getFullYear());
    return `${year}-${month}-${day}`;
  }
  return null;
}

function parseMm(token: string): number | null {
  const normalized = token.replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 10) / 10;
}

async function submitWater(context: BotContext, pendingInputs: PendingFieldInput[]): Promise<string> {
  const currentContext = await context.kornixClient.getCurrentContext(context.seasonYear);
  if (!currentContext.currentAppliedCalculationRunId) {
    return 'Полив не отправлен: в KORNIX нет currentAppliedCalculationRunId.';
  }
  if (!currentContext.submitAllowed) {
    return `Полив не отправлен: submitAllowed=no${currentContext.submitBlockedReason ? ` (${currentContext.submitBlockedReason})` : ''}.`;
  }

  const managedScope: KornixApprovalManagedScopeDto = {
    dateFrom: currentContext.managedScope.dateFrom,
    dateTo: currentContext.managedScope.dateTo,
    fieldSeasonIds: currentContext.managedScope.fieldSeasonIds,
    scopeVersion: currentContext.managedScope.scopeVersion
  };

  if (pendingInputs.some((pending) => !isFieldInManagedScope(pending.field.fieldSeasonId, managedScope))) {
    return 'Полив не отправлен: выбранное поле сейчас вне managedScope KORNIX.';
  }
  const invalidDate = pendingInputs.find((pending) => !isDateInManagedScope(pending.date, managedScope));
  if (invalidDate) {
    return `Полив не отправлен: дата должна быть в окне managedScope ${managedScope.dateFrom}..${managedScope.dateTo}.`;
  }

  const currentLayer = await context.kornixClient.getCurrentIrrigationLayer(context.seasonYear);
  const layer = new Map<string, KornixApprovalIrrigationCellDto>();
  for (const cell of currentLayer.irrigationLayer) {
    if (cell.irrigationMm > 0 && isCellInManagedScope(cell, managedScope)) {
      layer.set(cellKey(cell.fieldSeasonId, cell.irrigationDate), {
        fieldSeasonId: cell.fieldSeasonId,
        irrigationDate: cell.irrigationDate,
        irrigationMm: cell.irrigationMm
      });
    }
  }

  const added: ReturnType<typeof diffEntry>[] = [];
  const updated: ReturnType<typeof diffEntry>[] = [];
  for (const pending of pendingInputs) {
    const key = fieldDateKey(pending);
    const previous = layer.get(key);
    layer.set(key, {
      fieldSeasonId: pending.field.fieldSeasonId,
      irrigationDate: pending.date,
      irrigationMm: pending.mm
    });
    (previous ? updated : added).push(diffEntry(pending));
  }

  const response = await context.kornixClient.submitWaterRegimeApproval({
    seasonYear: context.seasonYear,
    baseCalculationRunId: currentContext.currentAppliedCalculationRunId,
    approvalClientGeneratedAt: new Date().toISOString(),
    managedScope,
    irrigationLayer: [...layer.values()],
    clientDiff: {
      added,
      updated,
      deleted: []
    }
  });

  return [...pendingInputs.flatMap((pending) => [
    'Полив отправлен в KORNIX.',
    `Поле: ${fieldNumber(pending.field)}`,
    `Дата: ${formatDisplayDate(pending.date)}`,
    `Полив: ${formatMm(pending.mm)} мм`,
    ''
  ]),
    `approvalStatus: ${response.approvalStatus}`,
    `calculationStatus: ${response.calculationStatus}`,
    `approvalBatchId: ${response.approvalBatchId}`
  ].join('\n');
}

async function submitRain(context: BotContext, pendingInputs: PendingFieldInput[]): Promise<string> {
  const currentContext = await context.kornixClient.getCurrentContext(context.seasonYear);
  if (!currentContext.currentAppliedCalculationRunId) {
    return 'Осадки не отправлены: в KORNIX нет currentAppliedCalculationRunId.';
  }
  if (!currentContext.submitAllowed) {
    return `Осадки не отправлены: submitAllowed=no${currentContext.submitBlockedReason ? ` (${currentContext.submitBlockedReason})` : ''}.`;
  }

  const managedScope: KornixApprovalManagedScopeDto = {
    dateFrom: `${currentContext.seasonYear}-04-01`,
    dateTo: currentContext.serverDate,
    fieldSeasonIds: currentContext.managedScope.fieldSeasonIds,
    scopeVersion: currentContext.managedScope.scopeVersion
  };

  if (pendingInputs.some((pending) => !isFieldInManagedScope(pending.field.fieldSeasonId, managedScope))) {
    return 'Осадки не отправлены: выбранное поле сейчас вне managedScope KORNIX.';
  }
  const invalidDate = pendingInputs.find((pending) => !isDateInManagedScope(pending.date, managedScope));
  if (invalidDate) {
    return `Осадки не отправлены: дата должна быть в окне managedScope ${managedScope.dateFrom}..${managedScope.dateTo}.`;
  }

  const response = await context.kornixClient.submitManualPrecipitation({
    seasonYear: context.seasonYear,
    baseCalculationRunId: currentContext.currentAppliedCalculationRunId,
    approvalClientGeneratedAt: new Date().toISOString(),
    managedScope,
    precipitationLayer: [],
    clientDiff: {
      added: pendingInputs.map(precipitationDiffEntry),
      updated: [],
      deleted: []
    }
  });

  return [...pendingInputs.flatMap((pending) => [
    'Осадки отправлены в KORNIX.',
    `Поле: ${fieldNumber(pending.field)}`,
    `Дата: ${formatDisplayDate(pending.date)}`,
    `Осадки: ${formatMm(pending.mm)} мм`,
    ''
  ]),
    `approvalStatus: ${response.approvalStatus}`,
    `calculationStatus: ${response.calculationStatus}`,
    `precipitationBatchId: ${response.precipitationBatchId}`
  ].join('\n');
}

function formatSubmitError(error: unknown, kind: InputKind): string {
  const label = kindLabel(kind).toLowerCase();
  if (error instanceof ApiError) {
    if (error.status === 403 || error.status === 401) {
      return `Не удалось сохранить ${label}: доступ бота к записи в KORNIX пока не включён. Черновик сохранён, можно повторить подтверждение позже.`;
    }
    if (error.status === 404 && kind === 'rain') {
      return 'Не удалось сохранить осадки: endpoint ручных осадков ещё не включён в KORNIX backend.';
    }
    return `Не удалось сохранить ${label}: ${error.message}`;
  }
  return `Не удалось сохранить ${label}. Попробуйте позже.`;
}

async function loadVisibleFields(context: BotContext): Promise<FieldSeasonCatalogFieldDto[]> {
  const current = await context.kornixClient.getCurrentContext(context.seasonYear);
  if (!current.currentAppliedCalculationRunId) {
    const catalog = await context.kornixClient.getFieldSeasonCatalog(context.seasonYear);
    return [...catalog.fields].sort((left, right) => compareFieldKeys(left.fieldKey, right.fieldKey));
  }

  const map = await context.kornixClient.getFieldSeasonMap(
    current.currentAppliedCalculationRunId,
    current.defaultMethodCode,
    current.serverDate
  );
  return map.features
    .map((feature) => mapFieldToCatalogField(feature.properties))
    .sort((left, right) => compareFieldKeys(left.fieldKey, right.fieldKey));
}

function mapFieldToCatalogField(field: FieldSeasonMapPropertiesDto): FieldSeasonCatalogFieldDto {
  return {
    fieldId: field.fieldId,
    fieldSeasonId: field.fieldSeasonId,
    fieldKey: field.fieldKey,
    fieldName: field.fieldName,
    areaHa: field.areaHa,
    cropName: field.cropName,
    cropSowingDate: field.cropSowingDate,
    koef_upper_limit: field.koef_upper_limit,
    koef_optimum: field.koef_optimum,
    koef_lower_limit: field.koef_lower_limit,
    geometry: null
  };
}

async function loadFieldStatusText(context: BotContext, field: FieldSeasonCatalogFieldDto): Promise<string> {
  const current = await context.kornixClient.getCurrentContext(context.seasonYear);
  const calculationRunId = current.currentAppliedCalculationRunId;
  if (!calculationRunId) {
    return unavailableFieldStatus(field, 'в KORNIX ещё нет применённого расчёта');
  }

  const [map, calculationRun] = await Promise.all([
    context.kornixClient.getFieldSeasonMap(calculationRunId, current.defaultMethodCode, current.serverDate),
    context.kornixClient.getCalculationRunStatus(calculationRunId)
  ]);
  const feature = map.features.find((item) => item.properties.fieldSeasonId === field.fieldSeasonId);
  if (!feature) {
    return unavailableFieldStatus(field, 'поле не найдено в текущем расчёте KORNIX');
  }

  const value = feature.properties;
  return [
    `Статус поля ${fieldNumber(field)}`,
    `Дата: ${formatCalculationFinishedAt(calculationRun.finishedAt)}`,
    `Статус: водный стресс ${formatOptionalNumber(value.water_stress_coefficient, 2)}`,
    `Влага в почве: ${formatRootZoneMoisture(value)}`,
    formatIrrigationRecommendation(value.recommended_irrigation_mm)
  ].join('\n');
}

function unavailableFieldStatus(field: FieldSeasonCatalogFieldDto, reason = 'не удалось загрузить данные KORNIX'): string {
  return [`Статус поля ${fieldNumber(field)}`, `Статус недоступен: ${reason}.`].join('\n');
}

function fieldActionKeyboard() {
  return commandButtonKeyboard(
    [
      { text: 'Полив', command: '/water' },
      { text: 'Осадки', command: '/rain' }
    ],
    2
  );
}

function chooseFieldKeyboard() {
  return commandButtonKeyboard([{ text: 'Выбрать поле', command: '/fields' }], 1);
}

function dateSelectionResponse(kind: InputKind, field: FieldSeasonCatalogFieldDto): BotResponse {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const buttons = Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    const date = formatDate(new Date(year, month, day));
    return { text: String(day), command: `/${kind} ${date}` };
  });
  buttons.push({ text: 'Отменить', command: '/cancel' });
  return {
    text: [`${kindLabel(kind)} для поля ${fieldNumber(field)}`, 'Выберите дату'].join('\n'),
    attachments: commandButtonKeyboard(buttons, 7)
  };
}

function diffEntry(pending: PendingFieldInput) {
  return {
    fieldSeasonId: pending.field.fieldSeasonId,
    date: pending.date,
    mm: pending.mm,
    source: 'max_bot'
  };
}

function precipitationDiffEntry(pending: PendingFieldInput) {
  return {
    fieldSeasonId: pending.field.fieldSeasonId,
    day: pending.date,
    precipitationMm: pending.mm,
    source: 'max_bot'
  };
}

function fieldDateKey(pending: PendingFieldInput): string {
  return cellKey(pending.field.fieldSeasonId, pending.date);
}

function cellKey(fieldSeasonId: string, date: string): string {
  return `${fieldSeasonId}:${date}`;
}

function isCellInManagedScope(
  cell: { fieldSeasonId: string; irrigationDate: string },
  managedScope: KornixApprovalManagedScopeDto
): boolean {
  return isFieldInManagedScope(cell.fieldSeasonId, managedScope) && isDateInManagedScope(cell.irrigationDate, managedScope);
}

function isFieldInManagedScope(fieldSeasonId: string, managedScope: KornixApprovalManagedScopeDto): boolean {
  return managedScope.fieldSeasonIds.includes(fieldSeasonId);
}

function isDateInManagedScope(date: string, managedScope: KornixApprovalManagedScopeDto): boolean {
  return date >= managedScope.dateFrom && date <= managedScope.dateTo;
}

function getFieldSortParts(fieldKey: string): number[] {
  const primaryKey = fieldKey.split(';')[0]?.trim() ?? fieldKey;
  const matches = primaryKey.match(/\d+/g);
  return matches ? matches.map(Number) : [Number.MAX_SAFE_INTEGER];
}

function compareFieldKeys(leftKey: string, rightKey: string): number {
  const leftParts = getFieldSortParts(leftKey);
  const rightParts = getFieldSortParts(rightKey);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? -1;
    const rightPart = rightParts[index] ?? -1;
    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }

  return leftKey.localeCompare(rightKey, 'ru', { numeric: true });
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function fieldDetails(field: FieldSeasonCatalogFieldDto): string {
  const crop = field.cropName ? `, ${field.cropName}` : '';
  return `${formatArea(field.areaHa)} га${crop}`;
}

function fieldNumber(field: FieldSeasonCatalogFieldDto): string {
  return stripFieldPrefix(field.fieldKey) || stripFieldPrefix(field.fieldName) || field.fieldKey || field.fieldName;
}

function stripFieldPrefix(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  const match = /(?:^|:)(\d+(?:\.\d+)*)$/.exec(raw);
  return match?.[1] ?? raw;
}

function normalizeFieldNumber(value: string): string {
  return stripFieldPrefix(value).toLowerCase();
}

function formatArea(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'нет данных';
  }
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function kindLabel(kind: InputKind): string {
  return kind === 'water' ? 'Полив' : 'Осадки';
}

function formatMm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatOptionalNumber(value: number | null | undefined, maximumFractionDigits: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'нет данных';
  }
  return new Intl.NumberFormat('ru-RU', {
    useGrouping: false,
    maximumFractionDigits
  }).format(value);
}

function formatRootZoneMoisture(value: FieldSeasonMapPropertiesDto): string {
  const water = value.soil_water_content_mm;
  const fieldCapacity = value.soil_field_capacity_water_mm;
  if (
    typeof water !== 'number' ||
    !Number.isFinite(water) ||
    typeof fieldCapacity !== 'number' ||
    !Number.isFinite(fieldCapacity) ||
    fieldCapacity <= 0
  ) {
    return 'нет данных';
  }
  return `${formatOptionalNumber((water / fieldCapacity) * 100, 0)}% НВ`;
}

function formatIrrigationRecommendation(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 'Полив не требуется';
  }
  return `Требуется полив ${formatOptionalNumber(value, 1)} мм`;
}

function formatCalculationFinishedAt(value: string | null | undefined): string {
  if (!value) {
    return 'нет данных';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'нет данных';
  }
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('day')}.${part('month')}.${part('year')}, ${part('hour')}:${part('minute')}`;
}

function formatDisplayDate(date: string): string {
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}.${month}.${year}` : date;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
