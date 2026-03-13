# LOCKIN NBA Agent Guide

This repository uses a layered AI-doc approach on purpose.

- OpenAI documents `AGENTS.md` as persistent repository context for Codex, especially for naming conventions, business logic, and repo quirks that are not obvious from code alone.
- Anthropic documents `CLAUDE.md` as concise, scoped memory that works best when it stays specific, modular, and path-aware.
- Because of that, this root `AGENTS.md` is the Codex-oriented entrypoint and routing table, while detailed project knowledge lives in linked docs and subtree `CLAUDE.md` files.

Primary external references used when writing this doc set:

- OpenAI, "Introducing Codex": https://openai.com/index/introducing-codex/
- OpenAI, "Introducing upgrades to Codex": https://openai.com/index/introducing-upgrades-to-codex/
- OpenAI, "How OpenAI uses Codex": https://cdn.openai.com/pdf/6a2631dc-783e-479b-b1a4-af0cfbd38630/how-openai-uses-codex.pdf
- Anthropic, "How Claude remembers your project": https://code.claude.com/docs/en/memory
- Anthropic, "Claude Code best practices": https://www.anthropic.com/engineering/claude-code-best-practices

## Read Order

Before making changes, read in this order:

1. `README.md`
2. `docs/ai/README.md`
3. The most relevant deep-dive doc in `docs/ai/`
4. The closest subtree `CLAUDE.md` if you are working under `src/lib`, `src/app/api`, or `src/components`

If a task is large, start by restating the affected subsystem and the verification plan before editing.

## Product Snapshot

LOCKIN NBA is a paid NBA picks and matchup-analysis product built with Next.js App Router.

Core user-facing flows:

- Daily paid pick: one premium moneyline lean per day
- Match chat: paid per-game AI chat room with limited questions
- Restore access: magic-link flow for daily unlocks
- Admin console: predictions, social proof, and system prompt management
- Live game board: public slate with live scores and betting context

Current monetization is hybrid:

- checkout sessions and payment state are real application logic
- if Lemon Squeezy env is configured, hosted checkout is used
- if Lemon Squeezy env is missing, the app falls back to local mock completion
- webhook support exists for Lemon Squeezy, but the billing surface is still simpler than a full mature payments stack

## Architecture Snapshot

Frontend/runtime:

- Next.js 16 App Router
- React 19
- Tailwind CSS v4 utilities plus custom CSS variables
- Framer Motion and CountUp for UI motion and number animation

Backend/data:

- Route handlers inside `src/app/api/**`
- Direct Postgres access through `pg`
- Supabase Postgres is used as the database host, but the app does not use the Supabase Data API or Supabase JS client
- Schema bootstraps automatically in `src/lib/db.ts`
- RLS is enabled for app tables and `anon`/`authenticated` table grants are revoked

External services:

- ESPN scoreboard feed for live NBA slate, scores, and line context
- OpenRouter for LLM calls
- AWS Lambda Web Adapter for production runtime
- CloudFront + Route53 for public edge/domain

Production shape:

- `https://lockinpicks.com`
- CloudFront sits in front of a Lambda Function URL
- raw Lambda Function URL is gated by a shared origin header checked in `src/proxy.ts`
- there is no always-on EC2 instance anymore

## Non-Negotiable Domain Rules

These rules matter more than stylistic preferences.

1. Today's public live scores should not depend on Supabase freshness.
   - `src/lib/daily-edge.ts:getPublicGames()` intentionally bypasses Supabase for active same-day live games by pulling fresh ESPN data and merging it with cached betting/context fields.

2. Supabase is still the source of truth for persistence.
   - Predictions, games cache, admin state, payments, sessions, messages, and magic links all persist in Postgres.

3. Admin-written predictions must not be overwritten by automatic refresh.
   - `predictions.source = 'admin'` is a hard stop for automatic regeneration.

4. The product is request-driven.
   - Do not reintroduce GitHub cron or constant polling jobs on the backend just to keep games warm.
   - `/api/internal/live-sync` exists only for protected manual/admin force refresh.

5. Payment and auth semantics are simple but intentional.
   - daily access uses a signed `daily` token
   - chat access uses a signed `chat` token with `sessionId`
   - restore-access magic links only restore valid daily access, not arbitrary entitlements

6. In-memory rate limiting is currently a known limitation.
   - `src/lib/rate-limit.ts` is process-local and not durable across parallel/serverless instances.
   - If you touch rate limiting, treat it as an infrastructure decision, not a refactor detail.

## Directory Map

- `src/app/page.tsx`
  Main landing page, orchestration of prediction load, live board polling, chat modal, restore access, and share card state.

- `src/app/admin-secure/page.tsx`
  Client-side admin interface for login and content operations.

- `src/app/api/**`
  Route handlers for public data, auth, admin, payments, chat, and health checks.

- `src/lib/db.ts`
  Postgres pool creation, SSL behavior, schema bootstrap, RLS setup.

- `src/lib/store.ts`
  Main persistence layer. Almost all business state transitions land here.

- `src/lib/daily-edge.ts`
  Stale-aware refresh logic, live-score bypass behavior, prediction refresh policy.

- `src/lib/nba.ts`
  ESPN ingestion and deterministic game/prediction helpers.

- `src/lib/llm.ts`
  OpenRouter integration plus heuristic fallback behavior.

- `src/lib/lemonsqueezy.ts`
  Optional Lemon Squeezy checkout creation and webhook verification.

- `src/proxy.ts`
  Origin verification gate for production requests behind CloudFront.

- `docs/`
  Human-readable operational docs. AI-specific deep dives live under `docs/ai/`.

## Commands

Local development:

```bash
npm install
npm run dev
```

Quality gates:

```bash
npm run lint
npm run build
```

Container smoke test:

```bash
docker build -t lockin-nba:test .
docker run --rm -p 3000:3000 --env-file .env lockin-nba:test
```

## Environment Model

Required:

- `DATABASE_URL`
- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `OPENROUTER_MODEL`

Important optional/runtime:

- `NEXT_PUBLIC_APP_URL`
- `OPENROUTER_SITE_URL`
- `OPENROUTER_SITE_NAME`
- `LOCKIN_ADMIN_USERNAME`
- `LOCKIN_ADMIN_PASSWORD`
- `LOCKIN_ADMIN_SECRET`
- `LOCKIN_TOKEN_SECRET`
- `LOCKIN_SYNC_SECRET`
- `LOCKIN_AUTO_PREDICTION_REFRESH_SECONDS`
- `ORIGIN_VERIFY_SECRET`
- `LOCKIN_MAIL_FROM`

Database connection guidance:

- Use the Supabase session pooler on port `5432` for the app runtime.
- Direct `db.<project>.supabase.co:5432` is only a fallback for IPv6-capable environments and tooling.

## API Surface Summary

Public read:

- `GET /api/games/today`
- `GET /api/predictions/today`
- `GET /api/social-proof`

Public paid flow:

- `GET /api/predictions/unlock`
- `POST /api/chat/session`
- `GET /api/chat/session/[id]`
- `POST /api/chat/message`
- `POST /api/payments/create-checkout`
- `GET /api/payments/status`
- `POST /api/payments/mock-complete`
- `POST /api/payments/webhook`
- `POST /api/auth/magic-link`
- `GET /api/auth/verify-magic/[token]`

Admin:

- `POST /api/admin/login`
- `GET|POST|DELETE /api/admin/predictions`
- `GET|PUT /api/admin/social-proof-banner`
- `GET|PUT /api/admin/system-prompt`

Protected ops:

- `GET /api/internal/live-sync`
- `GET /api/healthz`

## Change Safety Rules

When modifying the repo:

- Preserve the distinction between live ESPN reads and cached DB reads.
- Preserve `admin` vs `auto` prediction behavior.
- Preserve token payload compatibility unless you are deliberately doing a migration.
- Preserve the current payment amounts and question increments unless a product change explicitly asks for it.
- Do not silently switch persistence from Postgres back to memory.
- Do not add background jobs or permanent staging infrastructure to AWS without a cost reason.
- Do not remove RLS or table grant revocations from bootstrap unless the app architecture changes.

## Verification Expectations

Minimum expectation after non-trivial changes:

```bash
npm run lint
npm run build
```

Also verify the most relevant runtime path:

- live board changes: `GET /api/games/today`
- prediction changes: `GET /api/predictions/today` and unlock flow
- chat changes: session create, pay, message send
- auth changes: magic link + token verification
- infra changes: health check, root page, and protected origin behavior

## Known Intentional Limitations

These are current product realities, not accidental bugs:

- payments are still simpler than a full production billing system and may run in Lemon Squeezy or mock mode depending on env
- no durable external rate limiter yet
- no real email sender yet; magic link endpoint returns a link payload
- hosted checkout currently depends on optional Lemon Squeezy configuration
- daily prediction quality depends on OpenRouter success, but heuristic fallback exists

## Deep-Dive Docs

Project-wide docs:

- `docs/ai/README.md`
- `docs/ai/project-map.md`
- `docs/ai/backend-and-data.md`
- `docs/ai/frontend-and-ux.md`
- `docs/ai/operations-and-deploy.md`
- `docs/ai/change-playbook.md`

Scoped Claude memory files:

- `CLAUDE.md`
- `src/lib/CLAUDE.md`
- `src/app/api/CLAUDE.md`
- `src/components/CLAUDE.md`

## How To Use This Doc Set

For Codex-like agents:

- treat this file as the root navigation layer
- read the deeper docs before large edits
- use the nearest subtree `CLAUDE.md` as additional local context

For Claude Code:

- keep the root `CLAUDE.md` concise
- rely on imports and subtree `CLAUDE.md` files for on-demand context
- prefer specific, testable instructions over generic preferences
