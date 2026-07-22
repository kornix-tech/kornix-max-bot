import type {
  KornixCurrentContextDto,
  KornixMethodsResponseDto,
  KornixReadinessDto
} from '../kornix/kornixTypes.js';

export function formatHelp(): string {
  return [
    'POLIV360 работает в Mini App',
    '',
    'Как открыть:',
    '1. Нажмите кнопку «Открыть» внизу чата, слева от поля сообщения.',
    '2. Mini App откроется внутри MAX.',
    '',
    'Как пользоваться:',
    '• «Мои участки» — посмотреть статус полей.',
    '• «Добавить полив» — выбрать участок, дату и количество воды.',
    '• «Добавить осадки» — внести выпавшие осадки.',
    '• Проверьте подготовленные изменения и подтвердите отправку.',
    '',
    'Все функции доступны только в Mini App.'
  ].join('\n');
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
