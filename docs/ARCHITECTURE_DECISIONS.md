# Architecture Decisions

Дата: 2026-07-05.

## ADR-001: Keep KORNIX HTTP Access In `KornixClient`

Status: accepted.

All KORNIX API calls go through `src/kornix/kornixClient.ts`. Bot handlers receive `KornixClient` through `BotContext` and never call `fetch` directly.

Reason: keeps backend DTO/auth/error behavior in one place and prevents command handlers from becoming transport-specific.

## ADR-002: Use `undici.fetch` For MAX And KORNIX

Status: accepted.

Both API clients use `undici.fetch`; `axios` is not introduced.

Reason: Node 20 runtime is enough for fetch-style HTTP, and one transport approach keeps timeout/error/logging behavior consistent.

## ADR-003: Webhook Secret Verification Is A Boundary Concern

Status: accepted.

`src/max/webhookVerifier.ts` validates `X-Max-Bot-Api-Secret` before update parsing or command dispatch. Empty configured secret disables verification.

Reason: webhook trust should be established before business logic, while local development can still run without provisioning a MAX secret.

## ADR-004: Step 3 Bot Commands Are Read-Only

Status: accepted.

Implemented commands only read KORNIX data: `/start`, `/help`, `/status`, `/context`, `/fields`, `/methods`, `/readiness`.

Reason: backend write auth/audit attribution for bot approvals is not yet designed, and reference projects show approvals are protected workflow actions.

## ADR-005: Unknown MAX Updates Return HTTP 200

Status: accepted.

Unsupported update types and malformed/empty payloads are logged and produce a success-compatible webhook result.

Reason: Step 3 intentionally handles only text messages. Returning non-2xx for ignored events could create unnecessary retries from MAX.

## ADR-006: Bot Deploys As Separate Docker Service

Status: accepted.

The bot is packaged by its own root `Dockerfile` and run by `deploy/docker-compose.bot.yml` as `kornix-max-bot`.

Reason: the bot has a separate lifecycle from backend, frontend, worker and database. Keeping it as a separate service avoids coupling MAX deployment to KORNIX API or frontend releases.

## ADR-007: `/max/webhook` Is Routed By Reverse Proxy To Bot Container

Status: accepted.

Caddy owns public TLS and routes `POST /max/webhook` to `kornix-max-bot:3000` with `handle /max/webhook`.

Reason: the existing production boundary already publishes only Caddy on ports `80/443`. `handle` preserves the request path, while `handle_path` would strip the prefix and miss the app route.

## ADR-008: Production Env Contains Secrets Outside Git

Status: accepted.

Production uses `.env.production`, created from `.env.production.example`, for `KORNIX_SERVICE_TOKEN`, `MAX_BOT_TOKEN` and `MAX_WEBHOOK_SECRET`.

Reason: secrets must stay outside git and outside Docker image layers. The template documents required variables without storing real credentials.
