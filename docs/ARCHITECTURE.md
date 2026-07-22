# Architecture

Дата: 2026-07-05.

## Text Scheme

```text
MAX Messenger
    |-- Webhook: POST /max/webhook -> bot handlers
    |
    `-- Mini App: GET /miniapp/* -> validated session -> /miniapp/api/v1/*
                                                       |
                                                       v
                                                  KornixClient
    |
    v
KORNIX Backend API /api/v2/*
    |
    v
PostgreSQL / TimescaleDB / PostGIS
    |
    v
KORNIX Backend API response
    |
    v
kornix-max-bot formats response
    |
    v
MAX Messenger user
```

## Service Responsibility

### MAX Messenger

- Delivers webhook events.
- Receives bot replies.
- Owns messenger-specific user/channel/message identifiers.

### `kornix-max-bot`

- Verifies MAX webhooks.
- Parses user commands.
- Calls existing KORNIX Backend API.
- Formats compact responses for MAX.
- Stores no KORNIX source-of-truth data.
- Does not calculate water regime.
- Does not mutate DB directly.

### KORNIX Backend API

- Authenticates/authorizes tenant users or service principals.
- Owns all DTO contracts.
- Reads and writes KORNIX operational data.
- Owns approvals, ledger events, calculation jobs and publication state.
- Owns current context, readiness, field catalog, map, profile and recommendations.

### Database

- Backend-owned persistence only.
- Not accessible from bot.

## Runtime Boundary

Expected VDS placement:

```text
reverse proxy
  |-- frontend
  |-- backend api
  |-- kornix-max-bot
  |-- worker / scheduler / watchdog
  |-- postgres
```

The bot should be independently deployable and restartable. Backend and worker remain the only components that know DB schema and calculation internals.

## Mini App Boundary

- `src/miniapp/auth` verifies original MAX `initData` and signs a short-lived bearer token.
- The token stays in frontend memory and is never written to `localStorage`.
- `MaxIdentityResolver` is the only allowed MAX user → POLIV360 user boundary.
- The production default resolver returns `not_linked`; it never grants the shared service tenant to an unknown MAX user.
- `src/miniapp/miniAppHandler.ts` owns the isolated API, in-memory drafts, idempotency and static delivery.
- `src/kornix/operationService.ts` is shared by the chat bot and Mini App for irrigation and precipitation submissions.
- `MAX_MINIAPP_ENABLED=false` removes both the UI and Mini App API while `/health` and `/max/webhook` keep working.

## Data Boundary

Allowed for bot:

- HTTP request to `/api/v2/*`;
- MAX webhook/request payload;
- environment variables/secrets for its own integration.

Forbidden for bot:

- direct SQL;
- reading backend local files in production;
- parsing frontend build output;
- reimplementing KORNIX calculation rules.

## Current Implementation

The current repository now contains the Step 4 read-only production deploy scaffold:

- `GET /health` returns `{ "status": "ok" }`;
- `POST /max/webhook` verifies `X-Max-Bot-Api-Secret`, parses MAX updates and replies to text commands;
- `src/max/maxClient.ts` sends outgoing messages through MAX API using `undici.fetch`;
- `src/max/webhookVerifier.ts` validates webhook secret without touching command logic;
- `src/kornix/kornixClient.ts` is the only KORNIX HTTP layer;
- `src/bot/commandParser.ts` maps read-only commands through a registry;
- `src/bot/commandDispatcher.ts` routes parsed commands to handlers;
- `src/bot/handlers/*` call only `KornixClient`, not raw HTTP;
- `src/bot/messageFormatter.ts` owns user-facing bot text.
- `Dockerfile` builds a production image from compiled `dist/`;
- `deploy/docker-compose.bot.yml` runs the bot as a separate service on the Caddy-accessible Docker network;
- `deploy/Caddyfile.bot.snippet` routes public `/max/webhook` to `kornix-max-bot:3000` without rewriting the path;
- `.env.production.example` documents production runtime variables without secrets.

Implemented commands:

- `/start`
- `/help`
- `/status`
- `/context`
- `/fields`
- `/methods`
- `/readiness`

Still intentionally not implemented:

- MAX subscription management;
- user authorization/login;
- write approvals;
- draft irrigation commands;
- persistence/database;
- GitHub Actions/CI/CD changes.

## Future Production Concerns

- Define official bot auth contract with backend.
- Decide whether bot is read-only or can submit approvals.
- Validate VDS Caddy network name and route insertion during deployment.
- Add structured logs and request IDs.
- Add retry/backoff for backend reads.
- Add idempotency handling for MAX events.
- Add contract tests against backend DTO fixtures.
