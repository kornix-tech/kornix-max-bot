# Bot Integration Plan

Дата: 2026-07-04.

## Цель

`kornix-max-bot` должен быть отдельным Docker-сервисом между MAX Messenger и KORNIX Backend API. Бот не читает БД, не ходит в frontend и не дублирует расчётную бизнес-логику.

## Границы Шага 1

Реализовано только:

- структура проекта;
- минимальный HTTP server;
- `GET /health`;
- `POST /max/webhook`;
- интерфейсные заготовки config/logger/MAX/KORNIX/command parser.

Не реализовано:

- команды бота;
- MAX outgoing API;
- webhook signature validation;
- KORNIX auth;
- KORNIX API calls;
- irrigation business workflow.

## Авторизация

Текущее состояние backend `main`:

- browser frontend использует session cookie + CSRF;
- `viewer`, `farm_operator`, `admin`, `service_admin` задают права;
- approvals требуют `farm_operator`, `admin` или `service_admin`;
- internal service bearer существует, но в `main` разрешён только для allowlisted GET и не может делать POST approvals.

План:

1. Для read-only команд можно использовать backend-supported internal service principal, если нужные GET endpoints входят в allowlist.
2. Для write-команд полива нельзя самовольно использовать `KORNIX_SERVICE_TOKEN`: backend его не примет на POST approvals.
3. Перед реализацией approvals нужно выбрать один официальный вариант:
   - расширить backend service auth для bot principal с calculate role и audit attribution;
   - использовать user-bound OAuth/OIDC/BFF delegation;
   - оставить бот read-only до появления backend контракта.

## Read-Only Workflow

1. Проверить backend `GET /api/v2/health`.
2. Получить `GET /api/v2/kornix/current-context?seasonYear=YYYY`.
3. Если нет `currentAppliedCalculationRunId`, ответить пользователю статусом not ready/read-only.
4. Получить `GET /api/v2/kornix/methods`, выбрать `defaultMethodCode`.
5. Получить поля через `GET /api/v2/kornix/field-seasons/catalog`.
6. Для карты/сводки на дату вызвать `GET /api/v2/kornix/field-seasons/map`.
7. Для графиков/рекомендаций вызвать `GET /api/v2/kornix/water-regime/profile-timeseries`.
8. Для readiness/status вызвать `GET /api/v2/kornix/readiness/current`.
9. Для текущих утверждённых поливов вызвать `GET /api/v2/kornix/irrigation-layer/current`.

## Создание И Подтверждение Поливов

План после решения auth:

1. Получить `current-context`.
2. Проверить `frontendMode === "current_editable"` и `submitAllowed === true`.
3. Сохранить `currentAppliedCalculationRunId` как `baseCalculationRunId`.
4. Получить `irrigation-layer/current`.
5. Сформировать full replacement `irrigationLayer`:
   - сохранить существующие active cells, которые пользователь не меняет;
   - добавить/обновить только положительные `irrigationMm > 0`;
   - удалить пустые/нулевые/отрицательные значения из отправки;
   - не отправлять поля или даты вне `managedScope`.
6. Отправить `POST /api/v2/kornix/water-regime/approvals`.
7. Если `pollRequired`, читать `GET /api/v2/kornix/water-regime/approvals/{approvalBatchId}` до `applied`, `no_changes` или ошибки.
8. После успеха перечитать `current-context`, `irrigation-layer/current`, map/profile.
9. Если backend вернул `BASE_CALCULATION_RUN_IS_NOT_CURRENT_APPLIED`, обновить context и предложить повторить действие с новым base run.

## Получение Полей

Endpoint: `GET /api/v2/kornix/field-seasons/catalog?seasonYear=YYYY`.

Использование ботом:

- список полей;
- `fieldSeasonId` для следующих API calls;
- `fieldKey`/`fieldName` для человекочитаемых ответов;
- `areaHa`, `cropName`, `cropSowingDate`;
- geometry только для будущей генерации карты/ссылки.

## Получение Карты

Endpoint: `GET /api/v2/kornix/field-seasons/map`.

Required query:

- `calculationRunId`;
- `methodCode`;
- `day`.

Использование ботом:

- текущий статус поля;
- water/ET/precipitation/irrigation metrics;
- recommendation hints;
- data quality flags.

## Получение Графиков

Endpoint: `GET /api/v2/kornix/water-regime/profile-timeseries`.

Required query:

- `calculationRunId`;
- `methodCode`;
- `fieldSeasonIds`.

Если выбрано несколько полей, обязательно `aggregation=area_weighted_mean`.

## Получение Рекомендаций

Основные источники:

- `profile-timeseries.recommendations`;
- `field-seasons/map.features[].properties.recommended_irrigation_date`;
- `field-seasons/map.features[].properties.recommended_irrigation_mm`.

Бот не должен пересчитывать рекомендацию самостоятельно.

## Получение Статусов

Источники:

- `GET /api/v2/kornix/readiness/current`;
- `GET /api/v2/kornix/current-context`;
- `GET /api/v2/kornix/water-regime/calculation-runs/{calculationRunId}`;
- `GET /api/v2/kornix/water-regime/approvals/{approvalBatchId}` для write workflow.

## MAX Webhook Plan

Current shell:

- accepts `POST /max/webhook`;
- reads body with a small limit;
- returns `{ "ok": true }`.

Next steps:

- add signature verification using `MAX_WEBHOOK_SECRET`;
- normalize MAX event DTOs;
- map incoming text to command parser;
- call command handlers;
- send replies through MAX API with `MAX_BOT_TOKEN`.

## Endpoint Mapping For Initial Commands

- status: `current-context`, `readiness/current`, optional `calculation-runs/{id}`;
- fields: `field-seasons/catalog`;
- map/day summary: `current-context`, `methods`, `field-seasons/map`;
- profile: `current-context`, `methods`, `profile-timeseries`;
- recommendations: `profile-timeseries` and/or `field-seasons/map`;
- current irrigation: `irrigation-layer/current`;
- approve irrigation: blocked until write auth contract is decided.
