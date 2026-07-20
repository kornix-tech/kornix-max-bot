# Журнал изменений

## 2026-07-20

- Из пользовательских подтверждений отправки полива и осадков удалены внутренние `approvalStatus`, `calculationStatus` и batch ID, чтобы сообщение содержало только понятные пользователю данные.
- Выбор полей в MAX приведён к frontend KORNIX: бот использует поля текущей карты, сортирует агрономические номера по числовым частям и больше не обрезает список первыми 40 кнопками.
- Поля карты дополнительно ограничены `managedScope.fieldSeasonIds`, чтобы сервисный токен бота не показывал поля, отсутствующие в пользовательском frontend.
- Статус поля теперь показывается сразу после выбора с временем завершения расчёта, коэффициентом водного стресса, влажностью корнеобитаемого слоя в процентах НВ и рекомендацией полива; отдельная кнопка статуса удалена.

## 2026-07-15

- Нормализованы метаданные 26 исторических коммитов с именами `gregkorneev` и `Григорий Корнеев`: автор и коммитер теперь используют единые имя и email, чтобы история корректно связывалась с профилем GitHub.
- Выпущена стабильная версия `v1.0.0`: базовые функции MAX-бота завершены, проверены и зафиксированы как отправная точка для дальнейших улучшений.
- Перед общим подтверждением бот теперь показывает все поливы и осадки, добавленные в текущий черновик, чтобы пользователь мог проверить изменения по каждому полю.
- На production восстановлен маршрут Caddy `/max/webhook` к контейнеру бота: сообщения MAX снова доходят до webhook вместо frontend nginx с ответом 405.
- На production восстановлена backend-аутентификация identity `max-bot` с отдельным токеном и узким allowlist чтения/записи, чтобы выбор полей и подтверждение фактов снова работали после обновления KORNIX v1.2.

## 2026-07-12

- Добавлена очередь поливов и осадков с кнопками «Утверждаю» и «Добавить еще»: пользователь может подготовить изменения для нескольких полей, а бот отправляет их пакетами в KORNIX только после общего подтверждения.
- После выбора поля добавлена кнопка «Статус поля», которая показывает текущие метрики, качество данных и рекомендацию полива из того же endpoint карты, который использует frontend KORNIX.
- Даты в подтверждениях и итоговых сообщениях приведены к пользовательскому формату `DD.MM.YYYY`.
- В сценарий полива и осадков добавлены кнопки всех дней текущего месяца и отдельный числовой ввод миллиметров после выбора даты, чтобы пользователю не приходилось вводить дату вручную.
- Удалены мёртвые bot/MAX-прослойки, лишние barrel-файлы, дублирующий журнал разработки и прямая зависимость, уже предоставляемая `c8`, чтобы сократить структуру без изменения поведения.
- Удалены неиспользуемые KORNIX endpoints, DTO карты/графиков/статусов и мёртвые env-настройки, чтобы клиент содержал только API, реально используемое ботом.
- Создан актуальный граф проекта в `codebase-memory-mcp`, а в `AGENTS.md` закреплён приоритет графовых инструментов для навигации и анализа кода.

## 2026-07-10

- Исправлена отправка ручных осадков из MAX-бота: payload приведён к live backend contract `precipitation-layer/manual` с `baseCalculationRunId`, precipitation `managedScope` и sparse `clientDiff`.
- Добавлена локальная проверка даты осадков по precipitation managed scope, чтобы не отправлять будущие даты и не получать backend 422.
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
