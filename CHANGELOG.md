# Журнал изменений

## 2026-07-04

- Выполнен шаг 1 аудита reference-проектов: расширен `docs/REFERENCE_PROJECT_MAP.md`, добавлены `docs/API_REFERENCE.md`, `docs/BOT_INTEGRATION_PLAN.md` и `docs/ARCHITECTURE.md`, чтобы зафиксировать backend/frontend API, DTO, workflow поливов, auth-ограничения и границы ответственности бота.
- Подготовлен TypeScript-каркас `kornix-max-bot` с `package.json`, `tsconfig.json`, `.env.example`, `README.md`, структурой `src/` и минимальным HTTP server, чтобы проект запускался как отдельный сервис без бизнес-логики бота.
- Добавлены интерфейсные заготовки config/logger/MAX webhook/KORNIX client/command parser и smoke endpoints `GET /health`, `POST /max/webhook`, чтобы следующий этап мог реализовывать интеграцию поверх согласованных границ.
- Добавлен `docs/REFERENCE_PROJECT_MAP.md` с картой reference repositories `meteo` и `kornix_site`, чтобы зафиксировать backend/frontend контракты, workflow поливов и части API, нужные боту.
- Добавлена папка `kornix base/` в `.gitignore`, чтобы копии внешних репозиториев не попадали в основной git.
- В `AGENTS.md` закреплено правило использовать `kornix base/` только для чтения.
- Добавлены постоянные проектные инструкции для Codex в `AGENTS.md`.
- Заведен `CHANGELOG.md` для фиксации всех дальнейших изменений в репозитории.
