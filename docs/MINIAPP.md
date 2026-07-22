# MAX Mini App POLIV360

Дата: 2026-07-22.

## Архитектура

```text
MAX
 ├── webhook → bot handlers
 └── Mini App → WebAppData validation → signed short session → Mini App API
                                                              ↓
                                                        MaxIdentityResolver
                                                              ↓ linked only
                                                         KornixClient
                                                              ↓
                                                       POLIV360 Backend
```

Mini App не обращается к БД, MAX Bot API или KORNIX напрямую из браузера. Поливы и осадки проходят через общий `src/kornix/operationService.ts`, который также использует чат-бот.

## Проверка MAX WebAppData

Frontend передаёт оригинальный `window.WebApp.initData` в `POST /miniapp/api/v1/auth/max`. Сервер:

1. ограничивает размер строки;
2. отклоняет повторяющиеся параметры;
3. требует `hash`, `auth_date`, `query_id` и `user`;
4. URL-декодирует значения, сортирует ключи и исключает `hash`;
5. получает secret key как `HMAC-SHA256(key="WebAppData", data=MAX_BOT_TOKEN)`;
6. подписывает строку параметров HMAC-SHA256 и сравнивает hash через `timingSafeEqual`;
7. отклоняет данные старше `MAX_MINIAPP_INIT_DATA_MAX_AGE_SECONDS` и дату из будущего;
8. извлекает MAX user ID только после успешной подписи.

Алгоритм сверен с официальной документацией: <https://dev.max.ru/docs/webapps/validation>.

После проверки сервер возвращает подписанный HMAC session token с `sid`, `sub`, `iat`, `exp`. Он хранится только в памяти вкладки, передаётся через `Authorization: Bearer` и не попадает в `localStorage`, cookie или URL.

## Связь с POLIV360

Отдельная привязка аккаунта временно отключена. После обязательной проверки подписи MAX `SharedBotIdentityResolver` даёт Mini App тот же сезон и service identity `max-bot`, которые использует чат-бот. Поэтому поля, статусы, поливы и осадки работают без экрана «Подключите POLIV360».

Этот режим предоставляет всем пользователям данного MAX-бота общий разрешённый backend scope. Он временный и должен быть заменён персональной привязкой, когда backend предоставит соответствующий контракт.

Backend POLIV360 должен предоставить серверный контракт примерно следующего смысла (точный URL и DTO определяет backend):

```text
input: verified MAX user ID + authenticated service identity
output: linked | not_linked | inactive | temporarily_unavailable
linked: internal POLIV user ID, display name, authorized season/tenant scope
```

После появления контракта нужно заменить `SharedBotIdentityResolver`, не меняя frontend API. Нельзя принимать внутренний user/tenant ID от браузера.

## Маршруты и кэш

- `GET /miniapp` и `GET /miniapp/*` — React SPA;
- `/miniapp/assets/*` — годовой immutable cache для hash-файлов;
- `index.html` — `no-cache`;
- `/miniapp/api/v1/*` — `no-store`;
- SPA fallback не пересекается с `/health` и `/max/webhook`.

API перечислено в `docs/API_REFERENCE.md`. Изменяющие запросы используют POST/DELETE, проверку Origin и Bearer session. `/auth/max` и `/drafts/current/submit` ограничены in-memory rate limiter. Тело запроса ограничено 32 KiB.

## MAX Bridge

Подключается официальный скрипт `https://st.max.ru/js/max-web-app.js`. Адаптер использует документированные `initData`, `initDataUnsafe.start_param`, `platform`, `version`, `openLink`, `openMaxLink`, closing confirmation и `BackButton`.

Текущая официальная страница <https://dev.max.ru/docs/webapps/bridge> не описывает `ready`, `expand`, `close`, `themeParams` или theme events. Они намеренно не вызываются. Светлая/тёмная тема определяется стандартным `prefers-color-scheme`; после появления официального theme API адаптер можно расширить.

## Конфигурация

```text
MAX_MINIAPP_ENABLED=false
MAX_MINIAPP_PUBLIC_URL=https://poliv360.ru/miniapp
MAX_MINIAPP_INIT_DATA_MAX_AGE_SECONDS=300
MAX_MINIAPP_SESSION_SECRET=<minimum 32 random characters>
MAX_MINIAPP_SESSION_TTL_SECONDS=3600
MAX_MINIAPP_ALLOWED_ORIGINS=https://poliv360.ru
MAX_MINIAPP_POLIV_LINK_URL=<optional account-link URL>
MAX_MINIAPP_DEV_MODE=false
```

Development-only:

```text
MAX_MINIAPP_DEV_MAX_USER_ID=miniapp-dev-user
```

`MAX_MINIAPP_DEV_MODE=true` валиден только при `NODE_ENV=development`; интерфейс показывает постоянный баннер.

## Локальный запуск

```bash
pnpm install --frozen-lockfile
MAX_MINIAPP_ENABLED=true \
MAX_MINIAPP_DEV_MODE=true \
MAX_MINIAPP_SESSION_SECRET=development-session-secret-32-chars \
pnpm run dev:server
pnpm run miniapp:dev
```

Vite работает на `http://127.0.0.1:5173` и проксирует `/miniapp/api` на порт 3000.

## Production build и Docker

```bash
pnpm run typecheck
pnpm test
pnpm run test:coverage
pnpm run build
pnpm run docker:build
docker image inspect kornix-max-bot:local
```

Один image содержит `dist/` и `dist-miniapp/`, слушает только порт 3000, работает пользователем `node` и сохраняет `/health` healthcheck. `.env`, исходники Mini App и source maps в runtime image не копируются.

## Caddy и URL

Проверенные reference Caddyfile содержат явный `/api/*`, затем общий frontend fallback; `/miniapp` не занят. Минимально рискованный вариант — `https://poliv360.ru/miniapp`: существующий TLS/DNS, тот же origin для UI/API, без CORS credentials. Snippet должен стоять до общего frontend `handle`.

Отдельный `https://max.poliv360.ru/` изолирует routing, но требует DNS, сертификат и отдельный site block. Он нужен только при будущем конфликте пути `/miniapp`.

Не применять Caddy автоматически. После ручного изменения проверить:

```bash
MAX_WEBHOOK_SECRET=<secret> MAX_MINIAPP_ENABLED=true BASE_URL=https://poliv360.ru ./deploy/smoke-test.sh
```

## Настройка MAX вручную

1. Собрать и развернуть image.
2. Проверить `https://poliv360.ru/miniapp` и HTTPS.
3. Открыть платформу MAX для партнёров.
4. Выбрать существующего бота.
5. Открыть «Расширенные настройки» → «Настроить».
6. Указать `https://poliv360.ru/miniapp`.
7. Выбрать кнопку «Открыть» и сохранить.
8. Открыть чат с ботом и проверить кнопку Mini App.
9. Проверить мобильный MAX, светлую/тёмную тему и авторизацию.
10. Выполнить только согласованную тестовую операцию.

Имя бота в репозитории не подтверждено, поэтому диплинки оставлены с placeholder:

```text
https://max.ru/<botName>?startapp
https://max.ru/<botName>?startapp=<payload>
```

Официальные шаги: <https://dev.max.ru/docs/webapps/introduction>.

## Диагностика

- 404 `miniapp_disabled`: проверить feature flag;
- 401 `invalid_init_data`: токен бота, алгоритм подписи, часы сервера;
- 401 `expired_init_data`: открыть Mini App заново;
- 403 `not_linked`: требуется backend-привязка;
- 409 `submit_in_progress`: дождаться текущего запроса;
- 409/422 backend: обновить контекст и проверить managed scope;
- 503 `miniapp_not_built`: проверить наличие `dist-miniapp` в image.

Логи рекурсивно скрывают ключи token, secret, authorization, cookie, initData и hash.

## Откат

Быстрое отключение:

```text
1. MAX_MINIAPP_ENABLED=false.
2. Перезапустить только kornix-max-bot.
3. Удалить URL Mini App в MAX.
4. Проверить /health и /max/webhook.
```

Откат кода выполнять после завершения работы по фактическому списку коммитов, в обратном порядке:

```bash
git log --oneline 70053987b2266f143fa33ff4314a9d79a20cd1b5..HEAD
git revert <newest-miniapp-commit> ... <oldest-miniapp-commit>
```

Checkpoint:

```bash
git show before-max-miniapp-20260722-1456
git diff before-max-miniapp-20260722-1456..HEAD
```

## Известные ограничения

- production identity resolver временно использует общий scope service identity `max-bot` после проверки подписи MAX;
- sessions и drafts находятся в памяти процесса и пропадают при restart;
- fixed-window rate limit также локален одному экземпляру;
- MAX theme events пока отсутствуют в официальной Bridge-документации;
- интеграционную проверку внутри реального MAX и production deploy эта работа не выполняет.
