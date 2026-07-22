# kornix-max-bot

`kornix-max-bot` is a standalone Docker-ready service for the KORNIX/POLIV360 contour.

```text
MAX Messenger
-> kornix-max-bot
-> KORNIX Backend API
-> response to user
```

The same service can also serve the optional MAX Mini App:

```text
MAX Mini App -> /miniapp -> authenticated /miniapp/api/v1/* -> KornixClient -> POLIV360
```

The bot must not connect to the database and must not parse the frontend. Its only KORNIX data source is the backend HTTP API.

## Current Status

Current implementation:

- reference repositories audited and documented in `docs/`;
- KORNIX and MAX API clients implemented;
- MAX webhook verification and handling implemented;
- read-only commands: `/start`, `/help`, `/status`, `/context`, `/fields`, `/methods`, `/readiness`;
- button-based field selection and current field status;
- irrigation and precipitation entry with date and millimeter selection;
- queued changes for multiple fields with review, confirmation and cancellation before submission;
- HTTP server exposes `GET /health` and `POST /max/webhook`;
- feature-flagged React Mini App with server-side MAX launch-data validation, signed sessions and drafts;
- production Docker deployment is available in `deploy/`.

The complete baseline feature set is released as `v1.0.0`.

## Structure

- `src/config/` - environment configuration.
- `src/bot/` - command parsing interfaces.
- `src/max/` - MAX webhook contracts.
- `src/kornix/` - KORNIX backend client contracts.
- `src/handlers/` - HTTP route handlers.
- `src/middlewares/` - request helpers.
- `src/types/` - shared TypeScript contracts.
- `src/utils/` - logging and small utilities.
- `docs/` - reference audit, API reference, integration and architecture notes.
- `deploy/` - Docker Compose, Caddy snippet and VDS deployment smoke helpers.
- `miniapp/` - React, TypeScript and Vite mobile client.
- `tests/` - unit tests.

## Run

```bash
pnpm install
pnpm run build
pnpm start
```

For local development:

```bash
MAX_MINIAPP_ENABLED=true MAX_MINIAPP_DEV_MODE=true MAX_MINIAPP_SESSION_SECRET=development-session-secret-32-chars pnpm run dev:server
pnpm run miniapp:dev
```

The development Mini App shows a visible banner and accepts only `MAX_MINIAPP_DEV_MAX_USER_ID`. This bypass is rejected outside `NODE_ENV=development`.

Useful checks:

```bash
pnpm run typecheck
pnpm test
pnpm run test:coverage
pnpm run build
```

Default port is `3000`. Copy `.env.example` to `.env` when real credentials are introduced.

## Docker

```bash
pnpm run docker:build
pnpm run docker:run
```

For VDS deployment, use:

```bash
cd deploy
docker compose -f docker-compose.bot.yml up -d --build
```

Detailed production notes are in `deploy/README_DEPLOY_VDS.md`.

Mini App architecture, security, API, MAX setup and rollback are documented in `docs/MINIAPP.md`. The feature is disabled by default with `MAX_MINIAPP_ENABLED=false`.

## Roadmap

Development after `v1.0.0` focuses on incremental UX improvements, reliability hardening and new bot features.
