# kornix-max-bot

`kornix-max-bot` is a standalone Docker-ready service for the KORNIX/POLIV360 contour.

```text
MAX Messenger
-> kornix-max-bot
-> KORNIX Backend API
-> response to user
```

The bot must not connect to the database and must not parse the frontend. Its only KORNIX data source is the backend HTTP API.

## Current Status

Current implementation:

- reference repositories audited and documented in `docs/`;
- TypeScript project scaffold created;
- KORNIX API client implemented;
- MAX API client implemented;
- MAX webhook verifier and handler implemented;
- read-only commands: `/start`, `/help`, `/status`, `/context`, `/fields`, `/methods`, `/readiness`;
- HTTP server exposes `GET /health` and `POST /max/webhook`;
- production Docker/deploy scaffold is available in `deploy/`;
- auth flows, user binding, database access and write irrigation commands are intentionally not implemented yet.

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
- `tests/` - unit tests.

## Run

```bash
pnpm install
pnpm run build
pnpm start
```

For local development:

```bash
pnpm run dev
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

## Roadmap

1. Confirm the production backend branch/API version to use.
2. Decide bot authorization model for read-only and approval actions.
3. Add KORNIX API client implementation and contract tests.
4. Add MAX webhook verification and outgoing message client.
5. Add command handlers for read-only status, fields, map/profile summaries and irrigation workflows.
6. Add production subscription/idempotency hardening.
7. Decide auth/user binding before any write workflow.
