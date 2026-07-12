import type { BotContext } from './botContext.js';
import type { InputKind, PendingFieldInput } from './conversationState.js';
import { commandButtonKeyboard } from './keyboards.js';
import type {
  FieldSeasonCatalogFieldDto,
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
  const catalog = await context.kornixClient.getFieldSeasonCatalog(context.seasonYear);
  const state = context.conversationStore.get(context.userId, context.chatId);
  state.lastFields = catalog.fields;

  const fieldButtons = catalog.fields.slice(0, 40).map((field) => {
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
  state.pendingInput = null;

  return {
    text: [
      `Выбрано поле ${fieldNumber(field)}`,
      fieldDetails(field),
      '',
      'Что внести?'
    ].join('\n'),
    attachments: commandButtonKeyboard(
      [
        { text: 'Полив', command: '/water' },
        { text: 'Осадки', command: '/rain' }
      ],
      2
    )
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
      state.pendingInput = null;
      return { text: 'Введите количество мм' };
    }
    return dateSelectionResponse(kind, state.selectedField);
  }

  state.awaitingInput = kind;
  state.inputDate = null;
  state.pendingInput = null;
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
  if (!state.pendingInput) {
    return {
      text: 'Нет черновика для подтверждения. Выберите поле.',
      attachments: chooseFieldKeyboard()
    };
  }

  const pending = state.pendingInput;
  try {
    const response = pending.kind === 'water' ? await submitWater(context, pending) : await submitRain(context, pending);
    state.pendingInput = null;
    state.awaitingInput = null;
    state.inputDate = null;
    return {
      text: response,
      attachments: chooseFieldKeyboard()
    };
  } catch (error) {
    return { text: formatSubmitError(error, pending.kind) };
  }
}

export async function cancelHandler(context: BotContext): Promise<BotResponse> {
  const state = context.conversationStore.get(context.userId, context.chatId);
  state.awaitingInput = null;
  state.inputDate = null;
  state.pendingInput = null;
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
  state.pendingInput = {
    kind,
    field,
    date: parsed.date,
    mm: parsed.mm
  };

  return {
    text: [
      'Подтвердите ввод:',
      `Поле: ${fieldNumber(field)}`,
      `${kindLabel(kind)}: ${formatMm(parsed.mm)} мм`,
      `Дата: ${parsed.date}`
    ].join('\n'),
    attachments: commandButtonKeyboard(
      [
        { text: 'Подтвердить', command: '/confirm' },
        { text: 'Отменить', command: '/cancel' }
      ],
      2
    )
  };
}

async function resolveField(context: BotContext, query: string): Promise<FieldSeasonCatalogFieldDto | null> {
  const state = context.conversationStore.get(context.userId, context.chatId);
  if (!state.lastFields.length) {
    const catalog = await context.kornixClient.getFieldSeasonCatalog(context.seasonYear);
    state.lastFields = catalog.fields;
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

async function submitWater(context: BotContext, pending: PendingFieldInput): Promise<string> {
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

  if (!isFieldInManagedScope(pending.field.fieldSeasonId, managedScope)) {
    return 'Полив не отправлен: выбранное поле сейчас вне managedScope KORNIX.';
  }
  if (!isDateInManagedScope(pending.date, managedScope)) {
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

  const key = fieldDateKey(pending);
  const previous = layer.get(key);
  layer.set(key, {
    fieldSeasonId: pending.field.fieldSeasonId,
    irrigationDate: pending.date,
    irrigationMm: pending.mm
  });

  const response = await context.kornixClient.submitWaterRegimeApproval({
    seasonYear: context.seasonYear,
    baseCalculationRunId: currentContext.currentAppliedCalculationRunId,
    approvalClientGeneratedAt: new Date().toISOString(),
    managedScope,
    irrigationLayer: [...layer.values()],
    clientDiff: {
      added: previous ? [] : [diffEntry(pending)],
      updated: previous ? [diffEntry(pending)] : [],
      deleted: []
    }
  });

  return [
    'Полив отправлен в KORNIX.',
    `Поле: ${fieldLabel(pending.field)}`,
    `Дата: ${pending.date}`,
    `Полив: ${formatMm(pending.mm)} мм`,
    `approvalStatus: ${response.approvalStatus}`,
    `calculationStatus: ${response.calculationStatus}`,
    `approvalBatchId: ${response.approvalBatchId}`
  ].join('\n');
}

async function submitRain(context: BotContext, pending: PendingFieldInput): Promise<string> {
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

  if (!isFieldInManagedScope(pending.field.fieldSeasonId, managedScope)) {
    return 'Осадки не отправлены: выбранное поле сейчас вне managedScope KORNIX.';
  }
  if (!isDateInManagedScope(pending.date, managedScope)) {
    return `Осадки не отправлены: дата должна быть в окне managedScope ${managedScope.dateFrom}..${managedScope.dateTo}.`;
  }

  const response = await context.kornixClient.submitManualPrecipitation({
    seasonYear: context.seasonYear,
    baseCalculationRunId: currentContext.currentAppliedCalculationRunId,
    approvalClientGeneratedAt: new Date().toISOString(),
    managedScope,
    precipitationLayer: [],
    clientDiff: {
      added: [precipitationDiffEntry(pending)],
      updated: [],
      deleted: []
    }
  });

  return [
    'Осадки отправлены в KORNIX.',
    `Поле: ${fieldLabel(pending.field)}`,
    `Дата: ${pending.date}`,
    `Осадки: ${formatMm(pending.mm)} мм`,
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

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function fieldLabel(field: FieldSeasonCatalogFieldDto): string {
  return `Поле ${fieldNumber(field)} (${fieldDetails(field)})`;
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

function formatArea(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function kindLabel(kind: InputKind): string {
  return kind === 'water' ? 'Полив' : 'Осадки';
}

function formatMm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
