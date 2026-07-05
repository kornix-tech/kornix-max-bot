import type {
  FieldSeasonCatalogDto,
  KornixCurrentContextDto,
  KornixMethodsResponseDto,
  KornixReadinessDto
} from '../kornix/kornixTypes.js';

const COMMAND_LINES = [
  '/start - начать работу',
  '/help - показать команды',
  '/status - краткий статус KORNIX',
  '/context - текущий контекст сезона',
  '/fields - первые 10 полей',
  '/methods - доступные методы расчёта',
  '/readiness - подробная готовность'
];

export function formatStart(): string {
  return ['KORNIX MAX BOT', 'Read-only режим.', '', 'Команды:', ...COMMAND_LINES].join('\n');
}

export function formatHelp(): string {
  return ['Доступные команды:', ...COMMAND_LINES, '', 'Поливы и approvals пока отключены.'].join('\n');
}

export function formatUnknownCommand(rawText: string): string {
  const suffix = rawText.trim() ? `: ${rawText.trim()}` : '';
  return [`Неизвестная команда${suffix}.`, 'Напишите /help, чтобы увидеть список команд.'].join('\n');
}

export function formatStatus(readiness: KornixReadinessDto): string {
  return [
    'Статус KORNIX',
    `productionStatus: ${readiness.productionStatus}`,
    `readiness: ${readiness.status}`,
    `serverDate: ${readiness.serverDate}`,
    `currentAppliedCalculationRunId: ${readiness.currentAppliedCalculationRunId ?? 'нет'}`,
    `blockingErrors: ${readiness.blockingErrors.length ? readiness.blockingErrors.join(', ') : 'нет'}`
  ].join('\n');
}

export function formatContext(context: KornixCurrentContextDto): string {
  return [
    'Текущий контекст KORNIX',
    `Организация: ${context.organizationName ?? context.organizationCode}`,
    `Сезон: ${context.seasonYear}`,
    `Полей: ${context.fieldCount}`,
    `serverDate: ${context.serverDate}`,
    `currentAppliedCalculationRunId: ${context.currentAppliedCalculationRunId ?? 'нет'}`,
    `defaultMethodCode: ${context.defaultMethodCode}`,
    `frontendMode: ${context.frontendMode}`,
    `submitAllowed: ${context.submitAllowed ? 'yes' : 'no'}`
  ].join('\n');
}

export function formatFields(catalog: FieldSeasonCatalogDto, limit = 10): string {
  const fields = catalog.fields.slice(0, limit);
  const lines = fields.map((field, index) => {
    const crop = field.cropName ?? 'культура не указана';
    return `${index + 1}. ${field.fieldName} | ${crop} | ${field.areaHa} га | ${field.fieldSeasonId}`;
  });
  const tail =
    catalog.fields.length > limit
      ? [`Показаны первые ${limit} из ${catalog.fields.length} полей.`]
      : [`Всего полей: ${catalog.fields.length}.`];
  return ['Поля KORNIX', ...lines, ...tail].join('\n');
}

export function formatMethods(methods: KornixMethodsResponseDto): string {
  const lines = methods.methods.map((method) => {
    const flags = [method.isDefault ? 'default' : null, method.isRequired ? 'required' : null, method.isCandidate ? 'candidate' : null]
      .filter((flag): flag is string => Boolean(flag))
      .join(', ');
    return `- ${method.methodCode} (${method.label}${flags ? `; ${flags}` : ''})`;
  });
  return [
    'Методы KORNIX',
    `defaultMethodCode: ${methods.defaultMethodCode}`,
    `operationalMethodSetCode: ${methods.operationalMethodSetCode}`,
    ...lines
  ].join('\n');
}

export function formatReadiness(readiness: KornixReadinessDto): string {
  return [
    'Readiness KORNIX',
    `status: ${readiness.status}`,
    `productionStatus: ${readiness.productionStatus}`,
    `operationalRequiredPass: ${readiness.operationalRequiredPass ? 'yes' : 'no'}`,
    `strictFullWeatherPass: ${readiness.strictFullWeatherPass ? 'yes' : 'no'}`,
    `missingDailyForcingRows: ${readiness.missingDailyForcingRows}`,
    `failedRequiredMethods: ${readiness.failedRequiredMethods.length ? readiness.failedRequiredMethods.join(', ') : 'нет'}`,
    `warnings: ${readiness.warnings.length}`
  ].join('\n');
}

export function formatBotError(): string {
  return 'Не удалось получить данные KORNIX. Попробуйте позже или проверьте backend readiness.';
}
