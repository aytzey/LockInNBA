# LOCKIN NBA

LOCKIN is a Next.js app that surfaces a paid daily NBA moneyline edge and paid per-game AI matchup chat.

## What is live now

- Daily edge generation runs through OpenRouter using `OPENROUTER_MODEL`.
- The default model is `google/gemini-3.1-flash-lite-preview`.
- The NBA slate, scores and book lines are pulled from ESPN's live scoreboard feed.
- The homepage and matchup chat both consume the same live game context.
- Production runs on `https://lockinpicks.com`.
- `https://www.lockinpicks.com` is also active over HTTPS.

## Environment

Required environment variables:

```bash
OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=google/gemini-3.1-flash-lite-preview
OPENROUTER_SITE_NAME="LOCKIN NBA"
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-1-YOUR_REGION.pooler.supabase.com:5432/postgres
```

Optional variables already supported elsewhere in the app:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
LOCKIN_ADMIN_USERNAME=...
LOCKIN_ADMIN_PASSWORD=...
LOCKIN_ADMIN_SECRET=...
LOCKIN_TOKEN_SECRET=...
LOCKIN_SYNC_SECRET=...
LOCKIN_AUTO_PREDICTION_REFRESH_SECONDS=1800
```

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Supabase Postgres is used for persistence. The app bootstraps its own tables on first server request with `DATABASE_URL`.
Use the session pooler URL on `:5432` for the app. Keep the direct `db.<project>.supabase.co:5432` URL only as a fallback or for tools that already have IPv6 egress.
The app enables SSL itself for Supabase hosts, so the app-level `DATABASE_URL` does not need an explicit `sslmode=require` suffix.

## Notes

- Payments are still completed through the local checkout completion route.
- Supabase pooler hosts are not always `aws-0`. Check the dashboard for the exact cluster prefix such as `aws-1-<region>.pooler.supabase.com`.
- The transaction pooler variant is the same host on port `6543`; it is useful for migrations and short-lived CLI jobs.

## Continuous Sync

- Supabase Postgres is the source of truth for games and predictions.
- The backend now refreshes live ESPN slate data on demand when cached DB data becomes stale.
- `live` games refresh fastest, `upcoming` slates refresh more slowly, and completed boards back off automatically.
- Daily predictions are still regenerated only for `source: "auto"` rows.
- Admin-written daily predictions are not overwritten by automatic refreshes.
- A protected manual sync endpoint still exists at `/api/internal/live-sync`.
- Full setup notes live in [`docs/live-data-sync.md`](/home/aytzey/Desktop/lockin_nba/docs/live-data-sync.md).
- Supabase persistence notes live in [`docs/supabase-postgres.md`](/home/aytzey/Desktop/lockin_nba/docs/supabase-postgres.md).
- AWS deploy notes live in [`docs/aws-deploy.md`](/home/aytzey/Desktop/lockin_nba/docs/aws-deploy.md).
