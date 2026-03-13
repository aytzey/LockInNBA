# Operations And Deploy Guide

This document explains how the running system is wired today.

## 1. Production Architecture

Production URL:

- `https://lockinpicks.com`

Traffic path:

1. viewer hits CloudFront
2. CloudFront forwards to Lambda Function URL
3. Lambda runs the Next.js standalone container through Lambda Web Adapter
4. app reads Supabase Postgres and external providers as needed

Security detail:

- `src/proxy.ts` expects `x-lockin-origin-verify`
- CloudFront sends that header
- the raw Lambda Function URL is therefore not the intended public origin

## 2. Why This Architecture Exists

The project was moved off always-on EC2 to reduce fixed AWS cost.

Current AWS goals:

- no permanent prod EC2
- no permanent staging environment
- one production path only
- keep infra minimal while still supporting HTTPS and custom domain

## 3. Deploy Flow

Production deploy is defined by:

- `.github/workflows/deploy-lambda.yml`

Branch behavior:

- `main` deploys production
- `dev` remains a code branch and does not maintain a separate AWS environment

Artifacts:

- Docker image built from `Dockerfile`
- pushed to ECR
- Lambda function updated to the new image

## 4. Container Runtime

The Dockerfile builds a Next standalone image and includes Lambda Web Adapter.

Relevant runtime env behavior:

- app binds on port `3000`
- Lambda Web Adapter health checks `/api/healthz`
- `HOSTNAME` should be `0.0.0.0`

Local smoke test:

```bash
docker build -t lockin-nba:test .
docker run --rm -p 3000:3000 --env-file .env lockin-nba:test
```

## 5. Environment Variables

Critical app env:

- `DATABASE_URL`
- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `OPENROUTER_MODEL`
- `OPENROUTER_SITE_NAME`
- `OPENROUTER_SITE_URL`
- `NEXT_PUBLIC_APP_URL`
- `LOCKIN_ADMIN_USERNAME`
- `LOCKIN_ADMIN_PASSWORD`
- `LOCKIN_ADMIN_SECRET`
- `LOCKIN_TOKEN_SECRET`
- `LOCKIN_SYNC_SECRET`
- `LOCKIN_AUTO_PREDICTION_REFRESH_SECONDS`
- `ORIGIN_VERIFY_SECRET`
- `LOCKIN_MAIL_FROM`

Optional payment-provider env:

- `LEMONSQUEEZY_API_KEY`
- `LEMONSQUEEZY_STORE_ID`
- `LEMONSQUEEZY_VARIANT_DAILY_PICK`
- `LEMONSQUEEZY_VARIANT_MATCH_CHAT`
- `LEMONSQUEEZY_VARIANT_EXTRA_QUESTIONS`
- `LEMONSQUEEZY_WEBHOOK_SECRET`

Environment-specific notes:

- app runtime should use the Supabase session pooler on `:5432`
- direct Supabase host may be IPv6-only in some environments
- `OPENROUTER_SITE_URL` and `NEXT_PUBLIC_APP_URL` should stay aligned with production domain

## 6. Database Ops Notes

The database bootstraps itself from application code.

Meaning:

- first server-side DB access creates missing tables
- RLS and revoked grants are part of bootstrap
- a schema change done only in the live DB but not in `src/lib/db.ts` is incomplete

If you change the schema, update:

1. bootstrap SQL in `src/lib/db.ts`
2. mappers and queries in `src/lib/store.ts`
3. any route or component assumptions

## 7. Live Data Operations

Game data policy:

- request-driven refresh
- no GitHub cron
- no required scheduler
- protected manual refresh endpoint still exists

Key route:

- `GET /api/internal/live-sync`

Use it for:

- force-refresh during debugging
- warming today and optionally tomorrow
- admin intervention

Do not depend on it for normal product freshness.

## 8. Cost-Sensitive Rules

This repo is intentionally optimized around free tier / low fixed cost pressure.

Therefore:

- avoid reintroducing long-lived AWS compute without a strong reason
- avoid a permanent staging environment
- avoid background infra that duplicates request-driven logic
- keep ECR storage trimmed if image churn grows

## 9. Health Checks And Smoke Tests

Basic checks after infra or backend changes:

```bash
npm run lint
npm run build
```

Then verify:

- `GET /api/healthz`
- `/`
- `/api/games/today`
- `/api/predictions/today`

If auth or payments changed, also verify:

- checkout create
- checkout status polling
- mock complete
- hosted checkout return behavior if Lemon Squeezy is enabled
- unlock route
- chat session + message

## 10. Known Infrastructure Truths

- CloudFront is necessary for HTTPS and custom domain, not decorative
- Route53 hosts DNS for the domain
- Supabase remains the persistent data store
- OpenRouter remains the LLM provider
- direct Lambda access should stay blocked by origin verification
