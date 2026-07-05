# Журнал изменений

## 2026-07-05

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
