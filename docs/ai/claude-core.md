# Core Project Facts

## What LOCKIN is

- A Next.js 16 App Router app for paid NBA analysis.
- The product has two monetized surfaces:
  - a daily paid moneyline pick
  - a paid per-game matchup chat with limited questions
- There is also an admin console for predictions, social proof text, and system prompts.

## Runtime stack

- Next.js 16
- React 19
- Tailwind v4 utilities plus custom global CSS
- Framer Motion and CountUp on the client
- `pg` for database access
- OpenRouter for LLM inference
- Supabase Postgres as the database host
- AWS Lambda Web Adapter behind CloudFront in production

## Read this before editing

- `src/lib/CLAUDE.md` for domain logic, persistence rules, and refresh behavior
- `src/app/api/CLAUDE.md` for route contracts and auth behavior
- `src/components/CLAUDE.md` for homepage, chat modal, and unlock UX

## Hard invariants

- Public live scores for today's active games should come straight from ESPN, not wait on Supabase freshness.
- Predictions saved with `source: "admin"` must not be overwritten by auto refresh.
- Supabase is used through direct Postgres connections, not through the Supabase JS/Data API.
- App tables enable RLS and revoke `anon` / `authenticated` table grants during bootstrap.
- Payments can run in Lemon Squeezy mode or mock mode depending on env; do not describe billing as fully mature.
- In-memory rate limiting is a known limitation, not a scalable final design.

## Commands

```bash
npm run lint
npm run build
```

Local app:

```bash
npm run dev
```

Container smoke test:

```bash
docker build -t lockin-nba:test .
docker run --rm -p 3000:3000 --env-file .env lockin-nba:test
```

## Main directories

- `src/app/page.tsx`
  Homepage orchestration.

- `src/app/api`
  Route handlers for public reads, chat, auth, admin, payments, and health.

- `src/lib`
  Business logic, persistence, LLM integration, ESPN ingestion, and optional Lemon Squeezy integration.

- `src/components`
  Client components for hero card, game board, chat modal, restore access, and share UX.

- `docs/`
  Ops and architecture docs.

## Environment variables that matter most

- `DATABASE_URL`
- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `OPENROUTER_MODEL`
- `NEXT_PUBLIC_APP_URL`
- `LOCKIN_ADMIN_*`
- `LOCKIN_TOKEN_SECRET`
- `LOCKIN_SYNC_SECRET`
- `LOCKIN_AUTO_PREDICTION_REFRESH_SECONDS`
- `ORIGIN_VERIFY_SECRET`

## Deploy reality

- Production deploys from `main`.
- Production URL is `https://lockinpicks.com`.
- CloudFront forwards to a Lambda Function URL.
- `src/proxy.ts` checks a shared origin header so direct Lambda origin access is not the intended public path.

## When making changes

- Keep edits local to the subsystem unless the task truly crosses boundaries.
- Verify the user-facing route or flow you touched.
- If you change auth, payments, or live-score logic, read the deeper docs first.
