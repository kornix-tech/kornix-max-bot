# kornix-max-bot

`kornix-max-bot` is a planned standalone Docker service for the KORNIX/POLIV360 contour.

```text
MAX Messenger
-> kornix-max-bot
-> KORNIX Backend API
-> response to user
```

The bot must not connect to the database and must not parse the frontend. Its only KORNIX data source is the backend HTTP API.

## Current Status

Step 1 shell only:

- reference repositories audited and documented in `docs/`;
- minimal TypeScript project scaffold created;
- HTTP server exposes `GET /health` and `POST /max/webhook`;
- bot commands, MAX API calls, backend API calls, auth flows and database access are intentionally not implemented yet.

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
- `tests/` - future tests.

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

## Roadmap

1. Confirm the production backend branch/API version to use.
2. Decide bot authorization model for read-only and approval actions.
3. Add KORNIX API client implementation and contract tests.
4. Add MAX webhook verification and outgoing message client.
5. Add command handlers for read-only status, fields, map/profile summaries and irrigation workflows.
6. Add Dockerfile and production compose integration.
