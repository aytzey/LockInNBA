# Backend And Data Guide

This document covers the parts of LOCKIN that most often break when refactors ignore product rules.

## 1. Database Model

The app uses a direct `pg` pool created in `src/lib/db.ts`.

Important details:

- the pool is cached on `globalThis`
- schema bootstrap runs lazily on first DB use
- SSL is enabled automatically for Supabase hosts
- max pool size is intentionally small
- bootstrap enables RLS on all app tables
- bootstrap revokes `anon` and `authenticated` grants on app tables

Created tables:

- `predictions`
- `social_proof_banner`
- `site_copy`
- `system_prompts`
- `games`
- `data_refresh_state`
- `chat_sessions`
- `chat_messages`
- `checkout_sessions`
- `payments`
- `magic_links`

The app never depends on Supabase REST/Data API semantics. Every route uses server-side Postgres.

## 2. Store Layer Responsibilities

`src/lib/store.ts` is the business-state backbone.

Main responsibilities:

- CRUD for predictions
- social proof and system prompt persistence
- site copy persistence for CTA, no-edge, header, and footer text
- cached games storage
- chat session and message storage
- checkout/payment state transitions
- magic-link issuance and consumption
- access-state checks

If a change affects business state, it probably belongs in `store.ts` rather than directly inside a route.

## 3. Prediction Model

`predictions.source` can be:

- `auto`
- `admin`

This field is not decorative.

Rules:

- `auto` predictions may be regenerated on refresh
- `admin` predictions must not be auto-overwritten
- `isNoEdgeDay` is a real state and should short-circuit daily purchase
- empty or invalid prediction content should trigger regeneration for `auto` rows

Prediction generation path:

1. `GET /api/predictions/today`
2. `getOrCreateTodayPrediction()`
3. `refreshPredictionForDate()`
4. `generateDailyPrediction()`
5. fallback to deterministic heuristic if the model fails or returns unusable JSON

## 4. Game Data Model

Source:

- ESPN scoreboard API

Stored fields include:

- team abbreviations and display names
- records and leader summaries
- tip time
- status and status detail
- scores
- moneylines
- spread and total
- broadcast and venue
- game URL

Important nuance:

- odds data from ESPN can be partial or absent
- `0`, `Line pending`, and `Market pending` are currently meaningful placeholders that indicate upstream absence, not arbitrary dummy UI text

## 5. Refresh Strategy

Core file:

- `src/lib/daily-edge.ts`

Refresh windows:

- live games: fastest refresh
- upcoming slate today: cached from DB after the first daily fixture sync
- finals: slower refresh
- empty slate: slowest refresh

Mechanics:

- stale-aware DB reads use `data_refresh_state`
- in-flight refreshes are deduped per date in process memory
- same-day public board only bypasses cache once tipoff is near or live data is needed

Most important rule:

- today's active live games should feel live even if Supabase refresh state is stale

That is why `getPublicGames()` does this:

1. fetch and persist the daily fixture once when the DB has no slate for that EST date
2. serve the cached schedule from Postgres before tipoff
3. switch to direct ESPN no-store reads only when a scheduled game is near/after tipoff or already live
4. merge the live snapshot over cached betting context and write it back asynchronously so finals eventually settle in DB

Do not "simplify" this back into a DB-only path unless product requirements change.

## 6. LLM Integration

Core file:

- `src/lib/llm.ts`

Provider model:

- OpenRouter base URL
- model configurable via env
- current default model is `google/gemini-3.1-flash-lite-preview`

There are two LLM products:

### Daily prediction generation

- input is the whole slate context
- expected output is strict JSON
- if parsing fails, deterministic heuristic fallback is used

### Match chat generation

- input is one selected game
- model is instructed to answer only for that matchup
- output is tight markdown with `## Read`, `## Signal`, `## Risk`
- if model call fails, deterministic matchup fallback is used

Do not remove the fallback paths unless the product explicitly accepts degraded availability during provider failures.

## 7. Chat Model

Chat session lifecycle:

1. create unpaid session with zero question limit
2. user purchases `match_chat`
3. session becomes paid and gets at least 3 questions
4. each `extra_questions` purchase adds 3 more
5. each sent user message increments `questionsUsed`

Validation on chat send:

- rate limit
- session exists
- bearer token exists
- token type is `chat`
- token `sessionId` matches request session
- session is paid
- remaining question capacity exists
- game context can be loaded

The route also loads fresh game context each time so chat stays aligned with the evolving board.

## 8. Payments

Current reality:

- checkout sessions are persisted
- payments are persisted
- checkout can run in two modes:
  - Lemon Squeezy hosted checkout when configured
  - local mock completion when provider env is absent

Routes involved:

- `POST /api/payments/create-checkout`
- `GET /api/payments/status`
- `POST /api/payments/mock-complete`
- `POST /api/payments/webhook`

Hosted-checkout notes:

- `src/lib/lemonsqueezy.ts` creates Lemon Squeezy checkout sessions
- webhook signature verification is implemented for Lemon Squeezy
- frontend can poll checkout status until the persisted checkout session becomes `paid`
- `src/app/checkout-success/page.tsx` handles popup-close or redirect-return behavior
- checkout rows may be created before the buyer enters an email
- Lemon Squeezy webhook completion should hydrate the real customer email back onto local checkout and payment rows

Current amounts:

- `daily_pick = 5`
- `match_chat = 2`
- `extra_questions = 1`

If product pricing changes, update the central pricing helper rather than scattering amounts.

## 9. Token System

There are two token families.

### Admin token

Defined in `src/lib/admin.ts`.

- HMAC-signed
- carries role and username
- eight-hour validity

### Access token

Defined in `src/lib/token.ts`.

Types:

- `daily`
- `chat`

Daily token fields:

- `sub`
- `date`

Chat token fields:

- `sub`
- `date`
- `sessionId`
- `gameId`

Routes verify token type before using it. Preserve that distinction.

## 10. Magic Link Restore Flow

Magic-link behavior is intentionally narrow:

- only emails with an active daily payment for the current EST day qualify
- tokens expire after one hour
- tokens are one-time use
- successful verification issues a new signed daily access token
- when `LOCKIN_MAIL_FROM` is configured, the route sends the restore link by email through SES
- without mail configuration, the route falls back to returning the direct verification link for local/dev workflows

This is an access restoration feature, not a passwordless account system.

## 11. Security-Sensitive Areas

Be careful in these files:

- `src/lib/db.ts`
- `src/lib/admin.ts`
- `src/lib/token.ts`
- `src/proxy.ts`
- `src/app/api/internal/live-sync/route.ts`
- `src/app/api/auth/**`
- `src/app/api/admin/**`

Current sensitive implementation notes:

- raw DB credentials live in env, not code
- RLS is enabled even though the app uses direct Postgres
- origin access is protected by a shared header secret
- internal sync accepts bearer or query secret
- session tokens and magic-link tokens are stored in DB

## 12. Known Weak Spots

These are the most likely future migrations:

- hardening the Lemon Squeezy integration or replacing it with a different provider
- real email sending for magic links
- external rate limiter for serverless scale
- webhook signature verification and idempotency hardening
- maybe queueing async side effects

Do not hide these limitations in docs or comments. Keep them explicit.
