# Change Playbook

Use this file when you already understand the architecture and want the safest path for a concrete change.

## 1. If You Need To Change Daily Pick Logic

Read first:

- `src/lib/daily-edge.ts`
- `src/lib/llm.ts`
- `src/lib/nba.ts`
- `src/lib/store.ts`

Be careful about:

- `auto` vs `admin` prediction sources
- no-edge-day behavior
- EST date boundaries
- not overwriting admin content
- keeping heuristic fallback usable

Verify:

- `GET /api/predictions/today`
- unlock flow if markdown shape changed

## 2. If You Need To Change Live Games Or Scores

Read first:

- `src/lib/nba.ts`
- `src/lib/daily-edge.ts`
- `src/app/api/games/today/route.ts`
- `src/components/GameCard.tsx`
- `src/app/page.tsx`

Be careful about:

- today's live-score bypass path
- stale-window logic
- merge behavior between cached and live data
- polling cadence on the homepage

Verify:

- `GET /api/games/today`
- homepage live card rendering
- selected chat game still updates when scores change

## 3. If You Need To Change Chat

Read first:

- `src/app/api/chat/session/route.ts`
- `src/app/api/chat/message/route.ts`
- `src/components/ChatModal.tsx`
- `src/lib/store.ts`
- `src/lib/token.ts`

Be careful about:

- session ownership
- paid token type and session match
- question limits
- rate limiting
- game context freshness

Verify:

- session create
- match-chat purchase
- first question
- question exhaustion
- extra-questions purchase

## 4. If You Need To Change Payments

Read first:

- `src/app/api/payments/create-checkout/route.ts`
- `src/app/api/payments/mock-complete/route.ts`
- `src/app/api/payments/webhook/route.ts`
- `src/lib/store.ts`

Be careful about:

- central pricing helper
- idempotency around checkout completion
- token issuance payload shape
- chat entitlement changes on successful payment
- dual-mode behavior: Lemon Squeezy when configured, mock fallback otherwise

Current warning:

- this is not a fully mature billing stack yet

## 5. If You Need To Change Admin

Read first:

- `src/app/admin-secure/page.tsx`
- `src/app/api/admin/login/route.ts`
- `src/app/api/admin/predictions/route.ts`
- `src/app/api/admin/social-proof-banner/route.ts`
- `src/app/api/admin/system-prompt/route.ts`
- `src/lib/admin.ts`

Be careful about:

- bearer token auth
- preserving admin token compatibility
- keeping prediction management authoritative over auto refresh

## 6. If You Need To Change Schema Or Persistence

Read first:

- `src/lib/db.ts`
- `src/lib/store.ts`

Do all of the following together:

1. update bootstrap SQL
2. update TS mappers
3. update queries
4. update route assumptions
5. run `npm run build`

Do not:

- change the live DB manually and forget the bootstrap file
- remove RLS or grant revocations casually
- switch to Supabase JS just because the DB host is Supabase

## 7. If You Need To Change Infra

Read first:

- `Dockerfile`
- `.github/workflows/deploy-lambda.yml`
- `src/proxy.ts`
- `docs/aws-deploy.md`

Be careful about:

- health check path
- origin verification secret
- keeping the public domain on CloudFront
- not adding permanent staging cost

## 8. If You Need To Improve Reliability

Highest-value reliability upgrades still open:

1. externalize rate limiting
2. introduce real payment/webhook idempotency handling
3. add real email delivery for magic links
4. make side effects queue-friendly if payment/mail volume grows

## 9. Anti-Patterns

Avoid these:

- moving server truth into client-only state
- replacing request-driven freshness with blind background jobs
- overwriting admin predictions during auto refresh
- treating mock payment routes as production-complete billing
- assuming one runtime process for rate limiting or job coordination
- removing fallback behavior from LLM-dependent paths

## 10. Minimum Verification Matrix

Small UI-only change:

- `npm run lint`
- relevant page/manual flow

Backend or schema change:

- `npm run lint`
- `npm run build`
- hit affected API route(s)

Auth/payment/chat change:

- `npm run lint`
- `npm run build`
- full user flow from session/create to token-validated read or chat send
