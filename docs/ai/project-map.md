# Project Map

This document is the broad architectural map for LOCKIN NBA.

## 1. Product Purpose

LOCKIN sells two things:

1. one premium daily NBA moneyline pick
2. one premium per-game AI chat experience

The app intentionally avoids becoming a full sportsbook UI. The public board is a marketing and context layer. The paid objects are the daily markdown card and the matchup chat access token.

## 2. Top-Level User Journeys

### Daily pick journey

1. Homepage calls `GET /api/predictions/today`.
2. Backend ensures today's prediction exists, generating it if needed.
3. User enters email and creates a checkout session.
4. If Lemon Squeezy is configured, hosted checkout opens and the app polls `GET /api/payments/status`; otherwise local mock completion is used.
5. Frontend stores token in localStorage and calls `GET /api/predictions/unlock`.
6. Backend re-validates the token and paid access before returning markdown.

### Match chat journey

1. User opens a game card.
2. Frontend creates a chat session with `POST /api/chat/session`.
3. User pays for `match_chat`.
4. Hosted Lemon Squeezy checkout or mock completion marks the session paid and returns a signed `chat` token.
5. Each message call to `POST /api/chat/message` validates payment, session, question limits, and token ownership.
6. Backend loads fresh game context, current system prompt, and prediction context, then calls OpenRouter.

### Restore access journey

1. User submits email to `POST /api/auth/magic-link`.
2. Backend checks whether the email has an active paid daily pick for the current EST day.
3. If yes, backend creates a one-hour magic link token.
4. `GET /api/auth/verify-magic/[token]` consumes the token and returns a new signed daily access token.

### Admin journey

1. Admin logs in with username/password.
2. Backend issues an HMAC-signed admin token.
3. Admin can:
   - read/save/delete predictions
   - update social proof banner
   - rotate the active system prompt

## 3. Directory Ownership

### `src/app`

- `page.tsx`
  Single public landing page.

- `admin-secure/page.tsx`
  Admin dashboard.

- `checkout-success/page.tsx`
  Hosted-checkout return page that closes popup flows or redirects back to homepage polling.

- `api/**/route.ts`
  All server endpoints.

- `globals.css`
  Global visual system and tokens.

- `layout.tsx`
  App shell metadata and providers.

### `src/components`

- `TonightsEdge.tsx`
  Daily pick hero card and unlock UI.

- `GameCard.tsx`
  Public matchup tiles with odds and live-score presentation.

- `ChatModal.tsx`
  Paid chat room UX and match-chat payment flow.

- `RestoreAccess.tsx`
  Magic-link access recovery.

- `ShareCard.tsx`
  Exportable card rendering surface.

- `MarkdownContent.tsx`
  Markdown-style rendering helper for unlocked content.

### `src/lib`

- `env.ts`
  Required/optional env readers.

- `time.ts`
  EST-centric date helpers.

- `types.ts`
  Shared domain types.

- `db.ts`
  Pool creation, schema bootstrap, RLS, and transactions.

- `store.ts`
  Persistence and business-state transitions.

- `nba.ts`
  ESPN ingestion plus deterministic game/prediction helpers.

- `daily-edge.ts`
  Refresh logic and live/cache policy.

- `llm.ts`
  OpenRouter integration with heuristic fallback.

- `lemonsqueezy.ts`
  Hosted checkout creation and webhook signature verification when Lemon Squeezy is enabled.

- `admin.ts`
  Admin credential check and token signing.

- `token.ts`
  End-user access token signing and bearer parsing.

- `rate-limit.ts`
  In-memory request throttling.

### `docs`

- human docs for deploy, persistence, sync
- `docs/ai` is the agent-facing deep-dive layer

## 4. Data Ownership Boundaries

### Lives only in DB

- predictions
- social proof banner
- system prompt history
- cached games by date
- refresh timestamps
- chat sessions
- chat messages
- checkout sessions
- payments
- magic links

### Lives only in memory/process state

- rate-limit counters
- in-flight game refresh job dedupe map

### Comes from external systems

- ESPN scoreboard feed
- OpenRouter model output

## 5. Public API Inventory

### Read routes

- `GET /api/games/today`
- `GET /api/predictions/today`
- `GET /api/social-proof`
- `GET /api/healthz`

### Paid content routes

- `GET /api/predictions/unlock`
- `POST /api/chat/session`
- `GET /api/chat/session/[id]`
- `POST /api/chat/message`

### Payment/auth routes

- `POST /api/payments/create-checkout`
- `GET /api/payments/status`
- `POST /api/payments/mock-complete`
- `POST /api/payments/webhook`
- `POST /api/auth/magic-link`
- `GET /api/auth/verify-magic/[token]`

### Admin routes

- `POST /api/admin/login`
- `GET|POST|DELETE /api/admin/predictions`
- `GET|PUT /api/admin/social-proof-banner`
- `GET|PUT /api/admin/system-prompt`

### Internal ops route

- `GET /api/internal/live-sync`

## 6. State And Time Semantics

The app is EST-centric.

- day keys use EST, not server local time
- payment validity for daily access is tied to the EST day
- live board labels are displayed in EST

This matters when changing:

- token issuance
- prediction lookup
- payment restore logic
- daily refresh behavior

## 7. What Is Cached Versus Live

For today's board:

- live scores and live status can bypass Supabase by reading ESPN directly
- cached DB rows still matter for fallback and for non-live fields when ESPN data is thin

For other dates:

- reads go through the stale-aware cache path

For predictions:

- predictions are persisted
- auto predictions refresh only on a time window
- admin predictions stay fixed until changed by admin

## 8. Current Operational Posture

- production deploys from `main`
- no always-on staging environment in AWS
- production runs on Lambda behind CloudFront
- Supabase session pooler is the expected app DB connection
- direct Lambda origin should not be the public entrypoint

## 9. Important Product Truths For Agents

- LOCKIN is closer to a premium analysis product than a general NBA data platform.
- The UI is sales-led: the board exists to support unlock conversion and chat engagement.
- The app intentionally shares one live context between homepage cards and matchup chat.
- "No edge day" is a first-class product outcome, not an error state.
- The app already contains multiple places where deterministic fallbacks exist in case LLM or upstream data is weak.
