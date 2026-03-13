# `src/lib` Memory

This directory contains the product logic that should be treated as source-of-truth behavior, not just helpers.

## Files That Matter Most

- `db.ts`
- `store.ts`
- `daily-edge.ts`
- `nba.ts`
- `llm.ts`
- `admin.ts`
- `token.ts`
- `rate-limit.ts`

## Core Invariants

- Supabase is used as Postgres hosting only; the app talks to Postgres through `pg`.
- Schema bootstrap in `db.ts` is authoritative for app tables and RLS setup.
- `store.ts` is the canonical place for durable state transitions.
- Today's live public board can bypass Supabase cache via ESPN direct fetch in `daily-edge.ts`.
- Admin predictions must survive automatic refresh.
- LLM failures should degrade into deterministic fallbacks, not blank UX.

## Refresh Rules

- `getFreshGames()` is the stale-aware cache path.
- `getPublicGames()` is the public-route path and may return `source: "live"`.
- same-day schedules should stay DB-backed until tipoff; live windows are special.
- in-flight refresh dedupe is process-local and intentional.

## Persistence Rules

If you add or change a field:

1. update schema bootstrap
2. update row mapper
3. update read/write queries
4. update any API response shapes that expose the field

## Auth And Token Rules

- admin auth and end-user access tokens are separate systems
- chat tokens are tied to `sessionId`
- daily tokens are tied to the EST date
- magic links restore daily entitlements only

## Known Limitations

- rate limiting is in-memory
- payments are mock
- transactional email delivery is optional and currently depends on SES plus `LOCKIN_MAIL_FROM`

If you change any of those areas, document the new truth in `docs/ai/backend-and-data.md` too.
