# Контекст проекта для Codex

Актуальность сводки: 2026-07-22. Проверенная кодовая база: `main` на `e2e13a2` до добавления этой документации. При расхождении приоритет имеют текущий код, свежий `CHANGELOG.md` и Git-история.

## Назначение

`kornix-max-bot` — отдельный TypeScript/Node.js 20 сервис для MAX и KORNIX/POLIV360. Один процесс:

- принимает `POST /max/webhook` и отвечает пользователю MAX;
- раздаёт React Mini App на `/miniapp`;
- предоставляет защищённый API `/miniapp/api/v1/*`;
- читает данные и отправляет поливы/осадки только через KORNIX Backend HTTP API;
- не подключается к БД и не рассчитывает водный режим самостоятельно.

```text
MAX chat ──webhook──┐
                    ├─> kornix-max-bot ──HTTP──> KORNIX Backend ──> БД/расчёты
MAX Mini App ──API──┘
```

## Текущее поведение

- Чат-бот больше не ведёт старые сценарии полива: `/start`, сообщения, команды и callback-кнопки возвращают справку по открытию Mini App. Старый workflow пока остаётся в коде как неиспользуемая реализация.
- Mini App показывает доступные хозяйство/поля и статус поля, позволяет собрать черновик из нескольких операций полива и осадков, удалить позиции, отменить или подтвердить пакет.
- Поливы и осадки проходят через `src/kornix/operationService.ts`, соблюдают backend `managedScope` и запускают существующий отложенный расчёт KORNIX с пятиминутным debounce-окном.
- Mini App по умолчанию выключено флагом `MAX_MINIAPP_ENABLED=false`.
- MAX `initData` проверяется на сервере; короткая HMAC-сессия хранится только в памяти вкладки. Origin, размер body, rate limit, idempotency и маскирование секретов проверяются сервером.
- После валидной подписи `SharedBotIdentityResolver` временно даёт всем пользователям этого MAX-бота общий сезон и service scope `max-bot`. Персональной связи MAX user → POLIV360 user пока нет.
- Сессии, черновики, revoked-session set и rate limits находятся в памяти одного процесса и теряются при перезапуске.
- Репозиторий содержит Docker/Caddy scaffold, но Git не подтверждает фактическое состояние VDS, Caddy и настроек MAX. Перед утверждениями о production всегда проверять внешнее окружение по явному запросу.

## Архитектурная карта

| Область | Основные файлы | Ответственность |
|---|---|---|
| Запуск HTTP | `src/server.ts`, `src/config/config.ts` | config, клиенты, обработчики, маршрутизация |
| MAX transport | `src/handlers/maxWebhookHandler.ts`, `src/max/*` | secret verification, update parsing, отправка сообщений |
| Чат | `src/bot/commandDispatcher.ts`, `src/bot/messageFormatter.ts` | сейчас единая справка Mini App; legacy workflow лежит рядом |
| KORNIX API | `src/kornix/kornixClient.ts`, `kornixEndpoints.ts`, `kornixTypes.ts` | единственный HTTP-слой KORNIX и DTO |
| Запись операций | `src/kornix/operationService.ts` | общие submit/managed-scope правила для irrigation/precipitation |
| Mini App backend | `src/miniapp/miniAppHandler.ts`, `auth/*`, `draftStore.ts`, `identityResolver.ts`, `rateLimiter.ts` | auth, session, API, drafts, static SPA |
| Mini App frontend | `miniapp/src/App.tsx`, `api/client.ts`, `max/maxBridge.ts`, `state/navigation.ts`, `styles.css` | мобильный React UI и MAX bridge |
| Production scaffold | `Dockerfile`, `deploy/`, `.env.production.example` | image, Compose, Caddy snippet, smoke/runbook |
| Проверки | `tests/`, `miniapp/src/*.test.ts*` | Node test runner и Vitest |

Ключевые публичные маршруты: `GET /health`, `POST /max/webhook`, `GET /miniapp`, `/miniapp/assets/*`, `/miniapp/api/v1/auth/max`, `/me`, `/fields`, `/drafts/current`, `/drafts/current/items`, `/drafts/current/submit`, `/auth/logout`.

## Неподвижные решения и границы

- Backend KORNIX владеет DTO, авторизацией, managed scope, approvals, расчётами и данными; бот не дублирует эти правила и не делает SQL.
- `KornixClient` — единственная точка HTTP-доступа к KORNIX. Handler не должен вызывать KORNIX через raw `fetch`.
- MAX webhook secret и production-токены проверяются fail-closed; обязательные production-секреты не могут быть пустыми или короче установленного минимума.
- Логгер рекурсивно скрывает token/secret/authorization/cookie/initData/hash.
- Mini App auth доверяет MAX user ID только после серверной проверки подписи. Внутренний user/tenant ID нельзя принимать от браузера.
- Feature flag должен позволять отключить Mini App без остановки `/health` и `/max/webhook`.

## История по вехам

- **2026-07-04:** создан TypeScript-каркас, карта внешних reference-проектов и постоянные инструкции Codex.
- **2026-07-05:** реализованы KORNIX/MAX HTTP-клиенты, webhook и read-only команды; добавлен Docker/VDS scaffold.
- **2026-07-09 — 2026-07-12:** добавлены field workflow, inline-кнопки, запись поливов/осадков, managed-scope проверки, пакетный черновик и статус поля.
- **2026-07-15:** восстановлены production webhook/auth, выпущена базовая версия `v1.0.0`, нормализована Git-история авторов.
- **2026-07-20:** фильтрация полей согласована с frontend scope, callbacks исправлены, операции переведены на отложенный расчёт.
- **2026-07-22:** добавлена безопасная React Mini App, общий operation service, Docker-интеграция и тесты; затем чат переведён в режим справки Mini App, UI упрощён и приведён к стилю KORNIX.

Полная детализация изменений находится в `CHANGELOG.md`; точные diff и порядок — в `git log`. Не копировать сюда каждый коммит.

## Известные долги и следующие направления

1. Заменить общий `SharedBotIdentityResolver` на подтверждённую backend-привязку MAX user → POLIV360 user/tenant/season.
2. Если нужна устойчивость или горизонтальное масштабирование, вынести sessions/drafts/rate limits/idempotency из памяти в согласованное хранилище.
3. После подтверждённого отказа от чат-сценариев удалить legacy field workflow и связанные тесты отдельной проверяемой задачей.
4. Синхронизировать старые документы, где всё ещё встречается формулировка read-only; до этого текущим источником считать этот файл и код.
5. Production deploy, URL Mini App и настройки MAX проверять отдельно: локальная история не является доказательством их текущего состояния.

## Команды разработки и проверки

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run test:coverage
pnpm run build
```

Локальный Mini App:

```bash
MAX_MINIAPP_ENABLED=true \
MAX_MINIAPP_DEV_MODE=true \
MAX_MINIAPP_SESSION_SECRET=development-session-secret-32-chars \
pnpm run dev:server
pnpm run miniapp:dev
```

`MAX_MINIAPP_DEV_MODE=true` допустим только с `NODE_ENV=development`. Секреты брать из локального `.env`, не читать их в вывод и не коммитить.

## Карта документации

| Документ | Использовать для |
|---|---|
| `CHANGELOG.md` | подробная история фактически выполненных изменений |
| `docs/MINIAPP.md` | auth, API, bridge, security, настройка и rollback Mini App |
| `docs/API_REFERENCE.md` | KORNIX и Mini App HTTP contracts |
| `docs/ARCHITECTURE_DECISIONS.md` | ранние ADR; сверять старые read-only решения с текущим кодом |
| `docs/REFERENCE_PROJECT_MAP.md` | где искать backend/frontend reference-контракты |
| `deploy/README_DEPLOY_VDS.md` | команды VDS; некоторые вводные устарели, сверять с Mini App docs и compose |
| `docs/DEVELOPMENT_LOG.md` | исторический снимок начала Mini App, не текущий статус |

## Протокол завершения любой значимой задачи

1. Запустить минимально достаточные проверки для затронутого кода.
2. Обновить `CHANGELOG.md`; при изменении актуального состояния — этот файл.
3. Проверить `git status` и diff, исключить секреты и посторонние изменения.
4. Сделать осмысленный commit и push по правилам `AGENTS.md`.
5. Сообщить пользователю проверки, commit и результат push, а также все неподтверждённые production-действия.
