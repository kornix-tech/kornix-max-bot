# Architecture

Дата: 2026-07-05.

## Text Scheme

```text
MAX Messenger
    |
    v
Webhook: POST /max/webhook
    |
    v
kornix-max-bot
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

The current repository now contains the Step 3 read-only integration:

- `GET /health` returns `{ "status": "ok" }`;
- `POST /max/webhook` verifies `X-Max-Bot-Api-Secret`, parses MAX updates and replies to text commands;
- `src/max/maxClient.ts` sends outgoing messages through MAX API using `undici.fetch`;
- `src/max/webhookVerifier.ts` validates webhook secret without touching command logic;
- `src/kornix/kornixClient.ts` is the only KORNIX HTTP layer;
- `src/bot/commandParser.ts` maps read-only commands through a registry;
- `src/bot/commandDispatcher.ts` routes parsed commands to handlers;
- `src/bot/handlers/*` call only `KornixClient`, not raw HTTP;
- `src/bot/messageFormatter.ts` owns user-facing bot text.

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
- Docker/deploy/CI changes.

## Future Production Concerns

- Define official bot auth contract with backend.
- Decide whether bot is read-only or can submit approvals.
- Add Dockerfile and compose integration next to backend/frontend.
- Add structured logs and request IDs.
- Add retry/backoff for backend reads.
- Add idempotency handling for MAX events.
- Add contract tests against backend DTO fixtures.
