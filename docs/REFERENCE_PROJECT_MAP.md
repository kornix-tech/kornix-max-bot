# Reference Project Map

Дата аудита: 2026-07-04.

Источник: read-only reference repositories `kornix base/meteo` и `kornix base/kornix_site`.

## Назначение

Эта карта фиксирует текущий контур KORNIX, который должен использоваться как reference для разработки бота. Reference repositories не являются частью рабочего кода бота и должны читаться только как источник контрактов, workflow и терминологии.

## Backend: `kornix base/meteo`

Backend расположен в `template/app/src/meteo_pipeline`. Это DB-first FastAPI backend поверх PostgreSQL/TimescaleDB/PostGIS. Основной production-поток водного режима:

```text
PostgreSQL source data
-> meteo.field_daily_forcing
-> canonical_water_regime_engine
-> meteo.kornix_water_regime_calculation_runs
-> meteo.kornix_calculation_parameter_snapshot_refs
-> meteo.kornix_calculation_daily_method_facts
-> canonical_water_regime_services
-> typed KORNIX API v2
```

Основные директории:

- `template/app/src/meteo_pipeline/api/` - FastAPI app, auth/session/CSRF, DTO, сервисы чтения и canonical engine.
- `template/app/src/meteo_pipeline/kornix/` - расчётные модели FAO90/FAO56, dynamic root-zone, Stage 3 SP37 input helpers.
- `template/app/src/meteo_pipeline/ops/` - CLI, scheduler, worker, bootstrap/import/apply scripts, operational checks.
- `template/app/src/meteo_pipeline/fields/` - импорт KML, geometry, field queries, soil/manual monitoring.
- `template/app/src/meteo_pipeline/equipment/` - адаптеры внешнего оборудования, отделены от weather/forcing.
- `template/app/src/meteo_pipeline/db/migrations/` и `template/db/init/` - SQL schema/migrations.
- `template/docs/` и `template/doc/` - runtime, deployment, API workflow, security docs.

Ключевые backend-модули:

- `api/app.py` - единый FastAPI app, endpoint'ы `/api/v2/*`, middleware rate limit/CSRF/internal service auth.
- `api/auth.py` - CurrentUser, роли, dev/session/trusted BFF/internal service principals.
- `api/session_auth.py` - password login, server-side sessions, bcrypt, session cookie, session-bound CSRF.
- `api/dto.py` и `api/canonical_water_regime_dto.py` - Pydantic DTO публичного API.
- `api/canonical_water_regime_services.py` - чтение current context, map/profile, irrigation layer, approval status, submit approval.
- `api/canonical_water_regime_engine.py` - immutable calculation run: forcing validation, snapshots, FAO90 facts, recommendations, publication.
- `ops/canonical_water_regime_worker.py` - постоянный worker очереди `meteo.kornix_calculation_jobs`.
- `ops/operational_scheduler.py`, `ops/operational_watchdog.py` - daily operational контур.

## Авторизация Backend

Основной production-режим - server-side session:

- `POST /api/v2/auth/login` проверяет `meteo.kornix_users`, создаёт `meteo.kornix_user_sessions`, ставит `kornix_session` HttpOnly cookie и `kornix_csrf`.
- `GET /api/v2/me` возвращает `CurrentUserDto`.
- Unsafe методы требуют `X-CSRF-Token`; в session mode CSRF привязан к server-side session.
- `POST /api/v2/auth/logout` удаляет session и cookies.

Роли:

- `viewer` - read-only.
- `farm_operator`, `admin`, `service_admin` - могут отправлять approvals.

Есть read-only internal service principal через `X-Kornix-Internal-Service` + `Authorization: Bearer <token>`, но он разрешён только для allowlisted GET endpoint'ов operational monitoring. Для POST approvals он запрещён.

## Backend API V2

Публичные endpoint'ы:

- `GET /api/v2/health`
- `GET /api/v2/me`
- `GET /api/v2/auth/login`
- `POST /api/v2/auth/login`
- `GET /api/v2/auth/csrf`
- `POST /api/v2/auth/logout`
- `GET /api/v2/kornix/current-context?seasonYear=2026`
- `GET /api/v2/kornix/field-seasons/catalog?seasonYear=2026`
- `GET /api/v2/kornix/irrigation-layer/current?seasonYear=2026`
- `POST /api/v2/kornix/water-regime/approvals`
- `GET /api/v2/kornix/water-regime/approvals/{approvalBatchId}`
- `GET /api/v2/kornix/water-regime/calculation-runs/{calculationRunId}`
- `GET /api/v2/kornix/field-seasons/map?calculationRunId=...&methodCode=...&day=YYYY-MM-DD`
- `GET /api/v2/kornix/water-regime/profile-timeseries?calculationRunId=...&methodCode=...&fieldSeasonIds=...&aggregation=area_weighted_mean`
- `GET /api/v2/kornix/readiness/current?seasonYear=2026`
- `GET /api/v2/kornix/methods`

Admin endpoints живут отдельно в admin app/docs (`/api/admin/v1/*`, `/admin/*`) и не должны быть источником публичных данных для бота без отдельного решения.

## DTO И Контракты

Основные DTO:

- `CurrentUserDto` - пользователь, организация, роли.
- `KornixV2CurrentContextDto` - server date, forecast window, managed scope, current run ids, readiness, available methods, submit flags.
- `KornixV2ManagedScopeDto` - `dateFrom`, `dateTo`, `fieldSeasonIds`, `scopeVersion`, `scopeHash`.
- `KornixV2FieldSeasonCatalogDto` - список текущих сезонов полей с геометрией, площадью, культурой и границами регулирования.
- `KornixV2IrrigationLayerCurrentDto` - активная projection поливов из ledger.
- `KornixV2ApprovalRequestDto` - strict DTO для approval: `seasonYear`, `baseCalculationRunId`, `managedScope` без `scopeHash`, положительный `irrigationLayer`, optional `clientDiff`.
- `KornixV2ApprovalResponseDto` и `KornixV2ApprovalStatusDto` - batch/job polling.
- `FieldSeasonMapFeatureCollectionDto` - GeoJSON FeatureCollection с daily field metrics.
- `KornixProfileTimeseriesDto` - series по выбранным полям, рекомендации и warnings.

Важно: `irrigationMm` в approval должен быть строго `> 0`. Пустая ячейка означает отсутствие активного полива. Ноль и отрицательные значения не отправляются.

## Модели Данных Backend

Основные таблицы:

- `meteo.organizations` - tenant/organization.
- `meteo.agro_fields` - агрономические поля организации.
- `meteo.field_seasons` - сезонные ревизии полей; `is_current=true` - активный срез; `metadata` хранит параметры расчёта.
- `meteo.crop_types`, `meteo.soil_types`, `meteo.soil_tests` - культура и почва.
- `meteo.field_daily_forcing` - единственный operational input погоды/forcing для canonical water regime.
- `meteo.kornix_tenant_calculation_activations` - включение frontend/user approvals/daily operational для tenant-season.
- `meteo.kornix_method_registry`, `meteo.kornix_operational_method_sets`, `meteo.kornix_operational_method_set_members`, `meteo.kornix_operational_method_set_activations` - registry и активный набор методов.
- `meteo.kornix_irrigation_approval_batches` - immutable batch пользовательского утверждения.
- `meteo.kornix_irrigation_ledger_events` - ledger событий поливов: `upsert`/`delete`, `pending`/`active`/`rejected`/`superseded`.
- `meteo.kornix_water_regime_calculation_runs` - canonical runs, publication flags `published_as_current_operational` и `published_as_current_applied`.
- `meteo.kornix_calculation_jobs` - очередь worker'а.
- `meteo.kornix_calculation_weather_daily_snapshot` - immutable weather snapshots.
- `meteo.kornix_calculation_irrigation_input_snapshot` - immutable irrigation projection для конкретного run.
- `meteo.kornix_calculation_parameter_snapshot_refs` - immutable soil/crop/method snapshots.
- `meteo.kornix_calculation_daily_method_facts` - daily facts, которые читают map/profile endpoint'ы.
- `meteo.kornix_calculation_irrigation_recommendations` - рекомендации полива.
- `meteo.kornix_users`, `meteo.kornix_user_sessions`, `meteo.kornix_auth_audit_log` - auth/session/audit.

## Расчётные Модели

Активный public/default method:

- `simple_eto_single_layer_soil`
- method set: `operational_method_set_canonical_20260614`
- API schema: `kornix_api_v2_canonical_water_regime_20260614`

Доступные методы в контракте:

- `ivanov_single_layer_soil`
- `simple_eto_single_layer_soil`
- `aquacrop_eto_single_layer_soil`
- `aquacrop_eto_aquacrop_soil` как candidate.

FAO90 single-layer chain считает:

- root-zone depth, TAW/RAW;
- effective precipitation и effective irrigation;
- soil water start/end, depletion, productive water;
- Kc/Kcb/Ke/Kr, potential/actual ET;
- water stress coefficient;
- crop stage, days after sowing;
- cumulative ET/temperature and diagnostics.

Начальные влагозапасы, soil/crop/root-zone параметры и границы регулирования берутся из `field_seasons.metadata`, затем попадают в immutable parameter snapshots. Python/env fallback для production запрещён.

## Workflow Поливов

1. Клиент получает `GET /api/v2/kornix/current-context`.
2. Клиент получает активный слой `GET /api/v2/kornix/irrigation-layer/current`.
3. Пользователь или бот формирует слой только из положительных ячеек `irrigationMm > 0` внутри `managedScope`.
4. `POST /api/v2/kornix/water-regime/approvals` проверяет роль, CSRF/session, tenant scope, `baseCalculationRunId == currentAppliedCalculationRunId`, managed scope и окно дат.
5. Backend сравнивает submitted layer с active projection из `kornix_irrigation_ledger_events`.
6. Если изменений нет, создаётся batch со статусом `no_changes`, расчёт переиспользуется.
7. Если есть изменения, создаётся `approval_batch`, pending ledger events и queued `kornix_calculation_jobs` с новым `calculationRunId`.
8. `canonical_water_regime_worker` забирает job, запускает `execute_calculation_run`, создаёт snapshots, daily facts и recommendations.
9. При успехе pending ledger events становятся active, approval получает `applied`, run публикуется как current applied.
10. Клиент polling'ом читает `GET /api/v2/kornix/water-regime/approvals/{approvalBatchId}` и после `applied` перечитывает current context/map/profile.
11. При ошибке approval получает `calculation_failed`, pending ledger events становятся rejected.

## Frontend: `kornix base/kornix_site`

Frontend - Vite/React/TypeScript SPA с React Router и TanStack Query. Backend является security boundary; frontend не хранит JWT/access/refresh/session id.

Основные директории:

- `src/api/` - API facade (`kornixApi.ts`) и legacy static fields fallback.
- `src/shared/api/httpClient.ts` - typed fetch wrapper, credentials include, CSRF bootstrap/retry, normalized API errors.
- `src/features/auth/` - BFF/session auth client, provider, guard, login page.
- `src/features/water-regime/derivedWaterMetrics.ts` - derived UI metrics.
- `src/kornix/kornixTypes.ts` - TypeScript mirror DTO.
- `src/workspace/` - основная рабочая зона: карта, график, ввод поливов, экспорт, URL/session state.
- `src/config/metrics.ts` - frontend metric catalog.

Роуты:

- `/login`
- `/fields/:organizationCode/:seasonYear`
- `/water-regime/:organizationCode/:seasonYear`
- `/irrigation-input/:organizationCode/:seasonYear`
- legacy `/map`, `/water-regime`, `/irrigation`, `/workspace`

Frontend API facade вызывает только `/api/v2/*`. `requestJson` всегда отправляет `credentials: include`, для unsafe методов получает `GET /api/v2/auth/csrf` и ставит `X-CSRF-Token`.

Основные frontend workflows:

- На старте `AuthProvider` вызывает `/api/v2/me`; 401 переводит в anonymous/login.
- `WorkspacePage` читает `current-context`, выбирает current applied run и default method.
- Для карты читает `field-seasons/map`; если run ещё нет, использует `field-seasons/catalog`.
- Для графика читает `water-regime/profile-timeseries`.
- Для ввода поливов `IrrigationInputTable` читает active irrigation layer, гидратирует локальный draft, отправляет approval и polling'ом ждёт финала.

## Что Будет Использоваться Ботом

Боту нужно опираться на public API v2 и backend workflow, а не на admin routes и не на прямое изменение таблиц.

Минимальный набор для read-only сценариев:

- `GET /api/v2/me`
- `GET /api/v2/kornix/current-context`
- `GET /api/v2/kornix/readiness/current`
- `GET /api/v2/kornix/field-seasons/catalog`
- `GET /api/v2/kornix/field-seasons/map`
- `GET /api/v2/kornix/water-regime/profile-timeseries`
- `GET /api/v2/kornix/irrigation-layer/current`
- `GET /api/v2/kornix/methods`

Минимальный набор для сценариев полива:

- Получить `current-context` и сохранить `currentAppliedCalculationRunId`.
- Получить `irrigation-layer/current`.
- Сформировать full replacement layer по managed scope, включая существующие active поливы, которые надо сохранить.
- Исключить `0`, отрицательные, NaN, пустые значения и поля вне `managedScope`.
- Отправить `POST /api/v2/kornix/water-regime/approvals`.
- Poll `GET /api/v2/kornix/water-regime/approvals/{approvalBatchId}` до `applied`, `no_changes` или ошибки.
- После успеха перечитать `current-context`, map/profile и active irrigation layer.

## Ветки Reference Repositories

Аудит веток выполнен 2026-07-04 без изменения файлов внутри `kornix base/`.

### Backend `meteo`

Текущее состояние рабочей копии:

- checked-out branch: `main`;
- `main` и `origin/main`: `2cbad8fb30b51e04154a1c506d0d8475bbbe5a0f` (`Fix VDS http bootstrap app health`);
- remote branches: `origin/v1.1`, `origin/v1.2`.

Сравнение:

- `origin/v1.1` содержит 207 коммитов поверх `main`;
- `origin/v1.2` содержит 319 коммитов поверх `main`;
- `main` не содержит уникальных коммитов относительно этих веток по `rev-list --left-right --count`.

Ключевые отличия `origin/v1.2`:

- public API выделен из монолитного `api/app.py` в routers/services: `kornix_routes.py`, `equipment_routes.py`, `integration_routes.py`, `paths.py`;
- canonical read/write команды вынесены в сервисные границы: `canonical_public_read_commands.py`, `canonical_write_commands.py`, `field_map/service.py`, `profile_timeseries/service.py`, `field_catalog/service.py`, `frontend_context/service.py`, `approval_status/service.py`, `calculation_status/service.py`, `current_layers.py`;
- добавлены equipment/read endpoints, precipitation manual layer, irrigation report, daily DAG status;
- расширены runtime methods: 2L/3L/W3L/N4L/4L, Ivanov/microclimate, verified precipitation, KAIPOS/Natlogger diagnostics;
- добавлены operational DAG scheduler, production gates, runtime profile registry, source routing и новые migrations `116+`;
- CORS/observability расширены headers `X-Kornix-Process-Time-Ms` и `X-Kornix-Organization-Code`;
- internal service и public endpoints стали более формализованными, но write approvals всё равно требуют calculate role через backend auth.

Следствие для бота: перед реализацией бизнес-команд нужно подтвердить, какой backend branch/API contract является production source of truth. Текущий каркас и `API_REFERENCE.md` основаны на checked-out `main`, но отмечают endpoints из `origin/v1.2`.

### Frontend `kornix_site`

Текущее состояние рабочей копии:

- checked-out branch: `main`;
- `main` и `origin/main`: `6ff9a7afcac1fb9b4d8caa0aec5b197c27e6c1b3` (`Harden frontend VDS deployment readiness`);
- remote branch: `origin/v1.1`.

Сравнение:

- `origin/v1.1` содержит 60 коммитов поверх `main`;
- `main` не содержит уникальных коммитов относительно `origin/v1.1`.

Ключевые отличия `origin/v1.1`:

- маршруты API вынесены в `src/api/kornixApiRoutes.ts`;
- frontend дополнительно использует `integration-guide`, `public-endpoints`, precipitation layer/manual submit, irrigation report, equipment sources/devices/streams, field source Gantt;
- workspace получил отдельные precipitation/equipment pages and prefetched profile/device data;
- water regime UI расширен для новых methods/runtime diagnostics.

Следствие для бота: frontend `main` подтверждает базовый KORNIX v2 irrigation workflow, а `origin/v1.1` показывает вероятное следующее API-поле, которое может стать релевантным для будущих команд.

Ограничения для бота:

- Не считать local draft источником истины; истина - backend projection из `irrigation-layer/current` и applied calculation run.
- Не использовать `scopeHash` в strict approval DTO.
- Не отправлять `irrigationMm=0`.
- Не пытаться использовать internal service principal для POST approvals: он read-only.
- Не обращаться к admin API без отдельной задачи и отдельного auth/security решения.
- При конфликте `BASE_CALCULATION_RUN_IS_NOT_CURRENT_APPLIED` нужно перечитать context и повторить submit с новым base run.
