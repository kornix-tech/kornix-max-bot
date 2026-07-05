# Development Log

## 2026-07-05 - Step 3 MAX Messenger Read-Only Integration

### Реализовано

- Добавлены MAX DTO в `src/max/maxTypes.ts`.
- Добавлен `MaxClient` на `undici.fetch` с единым `request()`, timeout через `AbortController`, JSON handling, query serialization, логированием и ошибками `MaxApiError`, `MaxNetworkError`, `MaxValidationError`.
- Добавлен `webhookVerifier` для `X-Max-Bot-Api-Secret`.
- Расширен parser команд: `/start`, `/help`, `/status`, `/context`, `/fields`, `/methods`, `/readiness`.
- Добавлены dispatcher, typed `BotContext`, handlers и `messageFormatter`.
- `POST /max/webhook` теперь проверяет secret, парсит MAX update, исполняет только read-only text commands и отвечает через MAX API.
- KORNIX ошибки внутри команды не превращаются в HTTP `500`; бот логирует ошибку и отправляет friendly text.
- Добавлены unit tests для parser, dispatcher, formatter, MAX client, webhook verifier и webhook flow.

### Принятые Решения

- HTTP-код MAX сосредоточен в `MaxClient`, webhook и handlers не вызывают `fetch` напрямую.
- Входящие MAX DTO оставлены гибкими через `unknown`, потому что официальный payload содержит расширяемые объекты, а runtime normalization делается в webhook boundary.
- `MAX_WEBHOOK_SECRET` пустой строкой отключает проверку, чтобы локальная разработка не требовала секрета.
- Unknown MAX updates возвращают `200`, чтобы не создавать retry loop для событий вне read-only scope.
- Callback client method добавлен, но business callback flow не реализован в шаге 3.

### Проверки

- `pnpm run build`
- `pnpm run test`
- `pnpm run test:coverage`
- `git diff --check`

Coverage после шага:

- All files statements: `87.79%`
- All files branches: `71.98%`
- All files functions: `86.2%`
- All files lines: `87.79%`

### Следующий Шаг

- Code review Step 3.
- Затем выбрать Step 4: production MAX subscription/deploy hardening или backend-supported auth/user binding.
- Write approvals, drafts and irrigation mutations остаются заблокированы до отдельного решения по auth и audit attribution.

## 2026-07-05 - Step 2 KORNIX API Client

### Реализовано

- Добавлен полноценный `KornixClient` в `src/kornix/kornixClient.ts`.
- Добавлены endpoint builders в `src/kornix/kornixEndpoints.ts`.
- Добавлены DTO и параметры методов в `src/kornix/kornixTypes.ts`, синхронизированные с backend/frontend reference contracts.
- Реализован единый `request()` для всех HTTP-вызовов.
- Используется `undici.fetch`, без `axios`.
- Добавлены `ApiError`, `NetworkError`, `ValidationError`.
- Добавлены timeout через `AbortController`, JSON serialization/deserialization, query serialization, service-token headers.
- Добавлено логирование начала и завершения запроса: method, path/url, HTTP status, duration.
- Добавлены unit tests с `undici` MockAgent.

### Методы Клиента

- `getMe()`
- `getCurrentContext(seasonYear)`
- `getMethods()`
- `getReadinessCurrent(seasonYear)`
- `getCurrentIrrigationLayer(seasonYear)`
- `getFieldSeasonCatalog(seasonYear)`
- `getFieldSeasonMap(params)`
- `getProfileTimeseries(params)`
- `submitWaterRegimeApproval(payload)`
- `getApprovalStatus(approvalBatchId)`

### Принятые Решения

- `getFieldSeasonCatalog()` возвращает backend DTO `FieldSeasonCatalogDto`, а не frontend-derived `FeatureCollection`, потому что клиент должен быть backend API client, а не UI adapter.
- `fieldSeasonIds` сериализуются comma-separated, как в frontend `kornixApi`.
- `aggregation=area_weighted_mean` автоматически добавляется для `getProfileTimeseries()` при выборе нескольких полей, как делает frontend.
- Runtime validation DTO не добавлялась: клиент десериализует JSON в typed DTO и оставляет контрактные проверки backend/frontend contract tests будущему шагу.
- `KORNIX_SERVICE_TOKEN` пока используется только как bearer/internal-service header. Это не означает, что write approvals уже разрешены backend auth; ограничение зафиксировано в `docs/API_REFERENCE.md`.

### Проверки

- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run test:coverage`

Coverage после шага:

- All files statements: `75.19%`
- All files branches: `75%`
- All files functions: `66.66%`
- All files lines: `75.19%`

### Следующий Шаг

- Провести code review клиента.
- После review определить, нужна ли runtime validation DTO.
- Затем переходить к backend auth strategy для bot/service principal или к read-only command layer, не реализуя MAX/Webhook раньше утверждения клиента.
