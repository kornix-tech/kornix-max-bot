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
