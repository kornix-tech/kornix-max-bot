# API Reference For Bot Integration

Дата аудита: 2026-07-05.

Источники:

- backend main: `kornix base/meteo/template/app/src/meteo_pipeline/api/app.py`;
- backend main DTO: `api/dto.py`, `api/canonical_water_regime_dto.py`;
- frontend main facade: `kornix base/kornix_site/src/api/kornixApi.ts`;
- frontend `origin/v1.1` route registry: `src/api/kornixApiRoutes.ts`;
- backend `origin/v1.2` router: `template/app/src/meteo_pipeline/api/kornix_routes.py`.
- MAX official API docs:
  - `https://dev.max.ru/docs-api/methods/POST/messages`;
  - `https://dev.max.ru/docs-api/methods/POST/answers`;
  - `https://dev.max.ru/docs-api/methods/POST/subscriptions`;
  - `https://dev.max.ru/docs-api/objects/Update`;
  - `https://dev.max.ru/docs-api/objects/Message`.

## Общие Правила

Бот должен использовать только public HTTP API backend. Прямой доступ к PostgreSQL/TimescaleDB/PostGIS и парсинг frontend запрещены.

Production backend использует server-side session auth для браузера. Internal service principal существует, но в `main` разрешён только для allowlisted GET endpoints:

- `/api/v2/health`;
- `/api/v2/kornix/current-context`;
- `/api/v2/kornix/readiness/current`;
- `/api/v2/kornix/field-seasons/map`;
- `/api/v2/kornix/water-regime/profile-timeseries`;
- `/api/v2/kornix/water-regime/calculation-runs/{calculationRunId}`.

POST approvals через internal service token в `main` запрещён. Для бота это открытый архитектурный вопрос: нужен либо backend-supported bot/service auth с calculate role, либо user-bound session/OIDC delegation.

Error shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "requestId": "req_..."
  }
}
```

## Endpoints Main

### GET `/api/v2/health`

Назначение: backend healthcheck.

Frontend: используется инфраструктурно, не как рабочий KORNIX data endpoint.

Обязателен для бота: да, для startup/readiness checks.

Request DTO: нет.

Response DTO:

```json
{ "status": "ok" }
```

### GET `/api/v2/me`

Назначение: получить authenticated principal и tenant scope.

Frontend: да, `kornixApi.getMe()` и auth provider.

Обязателен для бота: да для проверки выбранной auth-схемы; read-only internal service в `main` не allowlisted для `/me`.

Response DTO `CurrentUserDto`:

```json
{
  "id": "user-id",
  "displayName": "KORNIX User",
  "email": "user@example.com",
  "organizationCode": "SP",
  "organizationName": "СП",
  "roles": ["viewer"],
  "farmId": null,
  "farmName": null
}
```

### GET `/api/v2/auth/csrf`

Назначение: получить/обновить CSRF cookie/token для unsafe browser requests.

Frontend: да, автоматически в `requestJson` перед POST/PUT/PATCH/DELETE.

Обязателен для бота: только если бот будет использовать session auth.

Response DTO `AuthCsrfDto`:

```json
{ "csrfToken": "token" }
```

### POST `/api/v2/auth/login`

Назначение: password login в session auth mode.

Frontend: да.

Обязателен для бота: нет для production bot, пока не принято решение об auth delegation.

Request DTO `AuthLoginRequestDto`:

```json
{ "username": "operator", "password": "secret" }
```

Response DTO `AuthLoginDto`:

```json
{
  "ok": true,
  "user": { "id": "user-id", "displayName": "Operator", "roles": ["farm_operator"] },
  "csrfToken": "token",
  "expiresAt": "2026-07-05T12:00:00+03:00"
}
```

### POST `/api/v2/auth/logout`

Назначение: revoke server-side session and cookies.

Frontend: да.

Обязателен для бота: нет, если бот не хранит user sessions.

Response DTO:

```json
{ "ok": true }
```

### GET `/api/v2/kornix/current-context?seasonYear=2026`

Назначение: главный operational context для tenant-season.

Frontend: да, старт Workspace/Irrigation flow.

Обязателен для бота: да.

Response DTO `KornixV2CurrentContextDto`:

```json
{
  "organizationCode": "SP",
  "organizationName": "СП",
  "seasonYear": 2026,
  "serverDate": "2026-07-04",
  "forecastStartDate": "2026-07-05",
  "forecastEndDate": "2026-07-11",
  "calculationWindow": { "from": "2026-04-01", "to": "2026-07-11", "timezone": "Europe/Moscow" },
  "managedScope": {
    "dateFrom": "2026-06-13",
    "dateTo": "2026-07-11",
    "fieldSeasonIds": ["uuid"],
    "scopeVersion": "scope_server_date_21_7_all_tenant_fields_20260614",
    "scopeHash": "hash"
  },
  "currentOperationalBaseCalculationRunId": "cwr_operational_...",
  "currentAppliedCalculationRunId": "cwr_applied_...",
  "frontendMode": "current_editable",
  "submitAllowed": true,
  "submitBlockedReason": null,
  "readinessDetailsUrl": "/api/v2/kornix/readiness/current",
  "defaultMethodCode": "simple_eto_single_layer_soil",
  "fieldCount": 37,
  "warnings": []
}
```

### GET `/api/v2/kornix/field-seasons/catalog?seasonYear=2026`

Назначение: список current field seasons, геометрия и агрономические атрибуты.

Frontend: да, fallback до первого расчёта и источник списка полей.

Обязателен для бота: да.

Response DTO `KornixV2FieldSeasonCatalogDto`:

```json
{
  "organizationCode": "SP",
  "seasonYear": 2026,
  "generatedAt": "2026-07-04T12:00:00+03:00",
  "fields": [
    {
      "fieldId": "uuid",
      "fieldSeasonId": "uuid",
      "fieldKey": "KAA-001",
      "fieldName": "Поле 1",
      "areaHa": 120.5,
      "cropName": "Картофель",
      "cropSowingDate": "2026-05-10",
      "koef_upper_limit": 0.9,
      "koef_optimum": 0.75,
      "koef_lower_limit": 0.6,
      "geometry": { "type": "MultiPolygon", "coordinates": [] }
    }
  ]
}
```

### GET `/api/v2/kornix/irrigation-layer/current?seasonYear=2026`

Назначение: active projection approved irrigation ledger inside managed scope.

Frontend: да, гидратация таблицы поливов.

Обязателен для бота: да для поливов и read-only summaries.

Response DTO `KornixV2IrrigationLayerCurrentDto`:

```json
{
  "organizationCode": "SP",
  "seasonYear": 2026,
  "managedScope": {
    "dateFrom": "2026-06-13",
    "dateTo": "2026-07-11",
    "fieldSeasonIds": ["uuid"],
    "scopeVersion": "scope_server_date_21_7_all_tenant_fields_20260614",
    "scopeHash": "hash"
  },
  "irrigationLayer": [
    {
      "fieldSeasonId": "uuid",
      "irrigationDate": "2026-07-06",
      "irrigationMm": 12,
      "sourceLedgerEventId": "uuid",
      "approvedAt": "2026-07-04T12:00:00+03:00",
      "zone": "forecast_planned"
    }
  ],
  "projectionHash": "hash",
  "generatedAt": "2026-07-04T12:00:00+03:00"
}
```

### POST `/api/v2/kornix/water-regime/approvals`

Назначение: submit full replacement irrigation layer for managed scope.

Frontend: да.

Обязателен для бота: да только после решения auth для write actions.

Request DTO `KornixV2ApprovalRequestDto`:

```json
{
  "seasonYear": 2026,
  "baseCalculationRunId": "cwr_applied_...",
  "approvalClientGeneratedAt": "2026-07-04T12:00:00+03:00",
  "managedScope": {
    "dateFrom": "2026-06-13",
    "dateTo": "2026-07-11",
    "fieldSeasonIds": ["uuid"],
    "scopeVersion": "scope_server_date_21_7_all_tenant_fields_20260614"
  },
  "irrigationLayer": [
    { "fieldSeasonId": "uuid", "irrigationDate": "2026-07-06", "irrigationMm": 12 }
  ],
  "clientDiff": { "added": [], "updated": [], "deleted": [] }
}
```

Important constraints:

- `baseCalculationRunId` must equal `currentAppliedCalculationRunId`;
- `managedScope` is copied from current-context but excludes `scopeHash`;
- each `irrigationMm` must be strictly `> 0`;
- omit empty, zero, negative and NaN cells;
- include existing active cells that must be preserved, because backend compares full projection.

Response DTO `KornixV2ApprovalResponseDto`:

```json
{
  "approvalBatchId": "uuid",
  "calculationRunId": "cwr_user_...",
  "approvalStatus": "pending_calculation",
  "calculationStatus": "queued",
  "reusedPreviousCalculation": false,
  "pollRequired": true,
  "pollAfterMs": 2000,
  "statusUrl": "/api/v2/kornix/water-regime/approvals/uuid",
  "warnings": []
}
```

### GET `/api/v2/kornix/water-regime/approvals/{approvalBatchId}`

Назначение: polling approval/job status.

Frontend: да.

Обязателен для бота: да для write workflow.

Response DTO:

```json
{
  "approvalBatchId": "uuid",
  "approvalStatus": "applied",
  "ledgerEventsStatus": "active",
  "calculationRunId": "cwr_user_...",
  "calculationStatus": "completed",
  "resultAvailable": true,
  "pollRequired": false,
  "warnings": [],
  "error": null,
  "timing": { "createdAt": "2026-07-04T12:00:00+03:00", "updatedAt": "2026-07-04T12:01:00+03:00" }
}
```

### GET `/api/v2/kornix/water-regime/calculation-runs/{calculationRunId}`

Назначение: calculation run metadata/status.

Frontend: да.

Обязателен для бота: полезен для diagnostics/status.

Response DTO:

```json
{
  "calculationRunId": "cwr_user_...",
  "runKind": "user_approval",
  "status": "completed",
  "organizationCode": "SP",
  "seasonYear": 2026,
  "serverDate": "2026-07-04",
  "calculationWindow": { "from": "2026-04-01", "to": "2026-07-11", "timezone": "Europe/Moscow" },
  "operationalMethodSetCode": "operational_method_set_canonical_20260614",
  "defaultMethodCode": "simple_eto_single_layer_soil",
  "warnings": [],
  "error": null
}
```

### GET `/api/v2/kornix/field-seasons/map?calculationRunId=...&methodCode=...&day=YYYY-MM-DD`

Назначение: GeoJSON FeatureCollection with daily field metrics.

Frontend: да, карта и irrigation hints.

Обязателен для бота: да для карты, field status summaries и рекомендаций по конкретному дню.

Response DTO: `FieldSeasonMapFeatureCollectionDto`.

```json
{
  "type": "FeatureCollection",
  "organizationCode": "SP",
  "seasonYear": 2026,
  "calculationRunId": "cwr_applied_...",
  "day": "2026-07-04",
  "generatedAt": "2026-07-04T12:00:00+03:00",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "MultiPolygon", "coordinates": [] },
      "properties": {
        "fieldSeasonId": "uuid",
        "fieldKey": "KAA-001",
        "latestStatus": "ok",
        "soil_water_content_mm": 120,
        "recommended_irrigation_date": "2026-07-06",
        "recommended_irrigation_mm": 12,
        "dataQuality": {
          "calculationAvailable": true,
          "forcingComplete": true,
          "hasActiveMapping": true,
          "messages": [],
          "forcingKind": "field_daily_forcing",
          "metricSourceVersion": "kornix_api_v2_canonical_water_regime_20260614"
        }
      }
    }
  ],
  "warnings": []
}
```

### GET `/api/v2/kornix/water-regime/profile-timeseries`

Query: `calculationRunId`, `methodCode`, `fieldSeasonIds` comma-separated, optional `aggregation=area_weighted_mean`.

Назначение: time series metrics and recommendations for selected fields.

Frontend: да, графики.

Обязателен для бота: да для графиков/сводок/рекомендаций.

Response DTO `KornixProfileTimeseriesDto`:

```json
{
  "organizationCode": "SP",
  "seasonYear": 2026,
  "serverDate": "2026-07-04",
  "forecastStartDate": "2026-07-05",
  "forecastEndDate": "2026-07-11",
  "calculationRunId": "cwr_applied_...",
  "window": { "from": "2026-04-01", "to": "2026-07-11", "timezone": "Europe/Moscow" },
  "selectedFieldSeasonIds": ["uuid"],
  "aggregation": null,
  "metrics": [
    {
      "long_name_for_code": "soil_water_content_mm",
      "label": "Soil water content",
      "unit": "mm",
      "valueKind": "scalar",
      "chartKind": "line",
      "points": [{ "day": "2026-07-04", "value": 120 }]
    }
  ],
  "recommendations": [
    {
      "fieldSeasonId": "uuid",
      "recommended_irrigation_date": "2026-07-06",
      "recommended_irrigation_mm": 12,
      "recommended_irrigation_reason_code": "below_optimum",
      "recommended_irrigation_priority": "warning",
      "recommended_irrigation_confidence": 0.9
    }
  ],
  "warnings": []
}
```

### GET `/api/v2/kornix/readiness/current?seasonYear=2026`

Назначение: readiness details for current operational/publication state.

Frontend: да.

Обязателен для бота: да для `/status`/health summaries.

Response DTO `KornixV2ReadinessDto` includes:

```json
{
  "serverDate": "2026-07-04",
  "status": "pass",
  "productionStatus": "ready",
  "currentAppliedCalculationRunId": "cwr_applied_...",
  "methodCode": "simple_eto_single_layer_soil",
  "scope": { "organizationCode": "SP", "seasonYear": 2026, "fieldCount": 37 },
  "blockingErrors": [],
  "warnings": []
}
```

### GET `/api/v2/kornix/methods`

Назначение: available water-regime calculation methods.

Frontend: да.

Обязателен для бота: да для выбора `methodCode`.

Response DTO:

```json
{
  "defaultMethodCode": "simple_eto_single_layer_soil",
  "operationalMethodSetCode": "operational_method_set_canonical_20260614",
  "methods": [
    {
      "methodCode": "simple_eto_single_layer_soil",
      "label": "Simple ETo single-layer soil",
      "methodFamily": "fao90",
      "version": "20260614",
      "isDefault": true,
      "isCandidate": false,
      "isRequired": true
    }
  ]
}
```

## Endpoints Seen In Newer Branches

`meteo origin/v1.2` and `kornix_site origin/v1.1` add/consume extra endpoints:

- `GET /api/v2/integration-guide`;
- `GET /api/v2/public-endpoints`;
- `GET /api/v2/kornix/precipitation-layer/current`;
- `POST /api/v2/kornix/precipitation-layer/manual`;
- `POST /api/v2/kornix/irrigation-report`;
- `GET /api/v2/kornix/dag/status`;
- `GET /api/v2/kornix/equipment/sources`;
- `GET /api/v2/kornix/equipment/devices`;
- `GET /api/v2/kornix/equipment/devices/{equipmentDeviceId}/daily-timeseries`;
- `GET /api/v2/kornix/equipment/streams`;
- `GET /api/v2/kornix/equipment/field-source-gantt`.

До реализации команд бота нужно выбрать production branch/API contract. Для шага 1 каркас фиксирует только main endpoints, обязательные для текущего irrigation workflow.

## MAX Messenger API

Шаг 3 использует только исходящие replies и webhook secret verification. Авторизация пользователя KORNIX, approvals и callback business actions не реализуются.

Base URL по умолчанию: `https://platform-api2.max.ru`.

Auth header для outgoing MAX API:

```text
Authorization: <MAX_BOT_TOKEN>
```

### POST `/messages?user_id=...`

Назначение: отправить сообщение конкретному пользователю.

Использование ботом: fallback, если incoming update не содержит `chat_id`.

Query:

- `user_id`: MAX user id;
- `disable_link_preview`: optional boolean.

Request body:

```json
{
  "text": "Ответ бота",
  "notify": true
}
```

### POST `/messages?chat_id=...`

Назначение: отправить сообщение в чат.

Использование ботом: основной reply path для `message_created`.

Query:

- `chat_id`: MAX chat id;
- `disable_link_preview`: optional boolean.

Request body совпадает с user message body.

### POST `/answers?callback_id=...`

Назначение: ответить на callback от inline controls.

Использование ботом: клиентский метод добавлен для полноты MAX client, но command workflow шага 3 не создаёт inline controls и не исполняет callback business actions.

Query:

- `callback_id`: MAX callback id.

Request body:

```json
{
  "notification": "Готово",
  "message": null
}
```

### Webhook Updates

Webhook endpoint бота: `POST /max/webhook`.

Secret verification:

- incoming header: `X-Max-Bot-Api-Secret`;
- если `MAX_WEBHOOK_SECRET` пустой, проверка отключена;
- если secret задан, missing/mismatch возвращает `401`.

Обрабатывается только read-only text update:

```json
{
  "update_type": "message_created",
  "timestamp": 1780000000,
  "message": {
    "sender": { "user_id": "user-1" },
    "recipient": { "chat_id": "chat-1" },
    "body": { "text": "/status" }
  }
}
```

Неизвестные update types логируются и завершаются HTTP `200`, чтобы MAX не ретраил события, которые бот сознательно игнорирует.
