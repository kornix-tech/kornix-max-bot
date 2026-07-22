# Development Log

## 2026-07-22 — MAX Mini App

- Baseline `70053987b2266f143fa33ff4314a9d79a20cd1b5`, local tag `before-max-miniapp-20260722-1456`.
- Существующий webhook, bot state, KornixClient, write DTO, Docker и tests проаудированы до изменений.
- Добавлены feature-flagged Mini App auth/API, общий сервис операций, React/Vite frontend, Docker/Caddy/smoke и security tests.
- Production user binding намеренно оставлен `not_linked` до появления backend resolver contract.
- Production deploy, Caddy reload, MAX settings and git push не выполнялись.
