# Журнал изменений

## 2026-07-10

- Production Docker network для MAX-бота переключён на фактическую сеть `kornix_prod_meteo_net`, чтобы Caddy мог резолвить `kornix-max-bot` и `/max/webhook` не возвращал 502.
- Исправлена отправка поливов из MAX-бота: approval payload теперь включает только ячейки внутри текущего `managedScope`, чтобы backend не отклонял historical irrigation layer с ошибкой `irrigationDate is outside managedScope`.
- Добавлена локальная проверка даты и поля перед отправкой полива, чтобы пользователь получал понятное сообщение без backend 422.
- Добавлен ignore для timestamp backup-файлов, появляющихся при VDS deploy-правках.
- Проверка webhook-секрета переведена в fail-closed режим: пустой секрет больше не разрешает входящие MAX webhook-запросы.
- Production-запуск теперь прекращается, если токен KORNIX, токен MAX или webhook-секрет отсутствует либо короче 32 символов.
- Добавлены проверки production-конфигурации и регрессионный тест пустого webhook-секрета.

## 2026-07-09

- Internal service identity бота изменена на отдельную `max-bot`, чтобы backend мог выдавать права записи только MAX-боту, не расширяя права `operational-scheduler`.
- Сообщение о запрете записи backend-ом сделано пользовательским, без внутреннего кода `INTERNAL_SERVICE_ROUTE_FORBIDDEN`, чтобы пользователи понимали, что нужно включить доступ бота к записи.
- Упрощён MAX UX до кнопочного сценария: `/start` и `/help` показывают кнопку выбора поля, `/fields` больше не выводит длинный список текстом, а callback webhook поддерживает реальную структуру MAX с top-level `message`.
- Добавлены inline-кнопки MAX для выбора поля, выбора типа факта и подтверждения/отмены ввода, чтобы пользователи могли проходить сценарий внесения полива/осадков без ручного набора команд.
- Исправлен список выбора полей в MAX: поля показываются по агрономическим номерам (`1.1`, `1.11`) без дублирования `SP:` и выбираются по этим номерам.
- Реализован пользовательский MAX-flow выбора поля и ввода фактов: `/fields`, `/field`, `/water`, `/rain`, `/confirm`, `/cancel`, чтобы пользователи могли вносить поливы через existing approval workflow и осадки через manual precipitation endpoint KORNIX.
- Добавлена настройка `KORNIX_INTERNAL_SERVICE_IDENTITY` с production-дефолтом `operational-scheduler`, чтобы MAX bot проходил internal-service auth текущего KORNIX backend на VDS.

## 2026-07-05

- Добавлен production deploy scaffold для VDS: `Dockerfile`, `.dockerignore`, `.env.production.example`, `deploy/docker-compose.bot.yml`, Caddy snippet, smoke script и VDS runbook, чтобы read-only MAX bot можно было собрать и подключить к существующему Caddy/Docker контуру.
- Уточнён Docker network setup для отдельного compose project: bot container получает стабильное имя и alias `kornix-max-bot`, а VDS runbook содержит команды диагностики `docker network ls` и `docker inspect`.
- Добавлены package scripts для Docker build/run/smoke и обновлены архитектурные документы с ADR-006..008, чтобы зафиксировать отдельный service deployment, reverse proxy route и хранение production secrets вне git.
- Реализована read-only интеграция с MAX Messenger: добавлены `MaxClient`, MAX DTO, webhook secret verifier, обработка `message_created` text updates и отправка ответов через MAX API, чтобы бот мог отвечать на команды без write workflow.
- Добавлены parser/dispatcher/handlers/formatter для команд `/start`, `/help`, `/status`, `/context`, `/fields`, `/methods`, `/readiness`, чтобы отделить транспорт MAX от логики KORNIX read-only ответов.
- Добавлены unit tests для MAX client, webhook verifier, webhook flow, parser, dispatcher и formatter, чтобы покрыть успешные сценарии, HTTP ошибки, timeout, invalid JSON и command routing.
- Обновлены архитектурные документы и добавлен `docs/ARCHITECTURE_DECISIONS.md`, чтобы зафиксировать решения шага 3 и сохранить approvals/user auth за пределами текущего этапа.
- Реализован `KornixClient` на `undici.fetch` с единым `request()`, timeout через `AbortController`, JSON/query handling, логированием запросов и ошибками `ApiError`, `NetworkError`, `ValidationError`, чтобы подготовить отдельный HTTP-слой интеграции с KORNIX API.
- Добавлены `src/kornix/kornixEndpoints.ts` и `src/kornix/kornixTypes.ts` с endpoint builders и DTO по reference-контрактам frontend/backend, чтобы не дублировать и не придумывать структуры API.
- Добавлены unit tests с mock HTTP и coverage script, чтобы проверить successful request, 404, 500, timeout и invalid JSON до реализации MAX, webhook, команд и auth workflow.
- Добавлен `docs/DEVELOPMENT_LOG.md` с решениями шага 2 и дальнейшими ограничениями.

## 2026-07-04

- Выполнен шаг 1 аудита reference-проектов: расширен `docs/REFERENCE_PROJECT_MAP.md`, добавлены `docs/API_REFERENCE.md`, `docs/BOT_INTEGRATION_PLAN.md` и `docs/ARCHITECTURE.md`, чтобы зафиксировать backend/frontend API, DTO, workflow поливов, auth-ограничения и границы ответственности бота.
- Подготовлен TypeScript-каркас `kornix-max-bot` с `package.json`, `tsconfig.json`, `.env.example`, `README.md`, структурой `src/` и минимальным HTTP server, чтобы проект запускался как отдельный сервис без бизнес-логики бота.
- Добавлены интерфейсные заготовки config/logger/MAX webhook/KORNIX client/command parser и smoke endpoints `GET /health`, `POST /max/webhook`, чтобы следующий этап мог реализовывать интеграцию поверх согласованных границ.
- Добавлен `docs/REFERENCE_PROJECT_MAP.md` с картой reference repositories `meteo` и `kornix_site`, чтобы зафиксировать backend/frontend контракты, workflow поливов и части API, нужные боту.
- Добавлена папка `kornix base/` в `.gitignore`, чтобы копии внешних репозиториев не попадали в основной git.
- В `AGENTS.md` закреплено правило использовать `kornix base/` только для чтения.
- Добавлены постоянные проектные инструкции для Codex в `AGENTS.md`.
- Заведен `CHANGELOG.md` для фиксации всех дальнейших изменений в репозитории.
