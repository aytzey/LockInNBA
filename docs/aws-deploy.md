---
title: LOCKIN AWS Deploy
updated: 2026-03-13
---

# Amaç

LOCKIN NBA uygulamasini AWS App Runner uzerinde iki ayri ortamla calistirmak:

- `main` -> production
- `dev` -> staging

Her `main` veya `dev` push'unda GitHub Actions Docker image'i ECR'ye gonderir ve ilgili App Runner servisine yeni deployment baslatir.

# Mimari

- AWS ECR repository: container image kaynagi
- AWS App Runner `lockin-nba-main`: production servis
- AWS App Runner `lockin-nba-dev`: staging servis
- GitHub Actions workflow: [deploy-apprunner.yml](/home/aytzey/Desktop/lockin_nba/.github/workflows/deploy-apprunner.yml)

# Branch Kurali

- `main` branch push/merge -> production deploy
- `dev` branch push -> staging deploy

# GitHub Repo Secret/Variable Seti

Secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `LOCKIN_SYNC_SECRET`

Variables:

- `AWS_REGION`
- `ECR_REPOSITORY`
- `APP_RUNNER_SERVICE_ARN_MAIN`
- `APP_RUNNER_SERVICE_ARN_DEV`
- `LOCKIN_BASE_URL`

# Runtime Env

Her App Runner servisinde en az su env'ler tanimli olmali:

- `DATABASE_URL`
- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `OPENROUTER_MODEL`
- `OPENROUTER_SITE_NAME`
- `NEXT_PUBLIC_APP_URL`
- `OPENROUTER_SITE_URL`
- `LOCKIN_ADMIN_USERNAME`
- `LOCKIN_ADMIN_PASSWORD`
- `LOCKIN_ADMIN_SECRET`
- `LOCKIN_TOKEN_SECRET`
- `LOCKIN_SYNC_SECRET`
- `LOCKIN_AUTO_PREDICTION_REFRESH_SECONDS`

# Lokal Duman Testi

```bash
docker build -t lockin-nba:test .
docker run --rm -p 3000:3000 --env-file .env lockin-nba:test
```
