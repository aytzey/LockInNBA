---
title: LOCKIN AWS Deploy
updated: 2026-03-13
---

# Amaç

LOCKIN NBA uygulamasini AWS Elastic Beanstalk uzerinde iki ayri ortamla calistirmak:

- `main` -> production
- `dev` -> staging

Her `main` veya `dev` push'unda GitHub Actions Docker image'i ECR'ye gonderir, branch'e ozel `Dockerrun.aws.json` bundle'i uretir ve ilgili Elastic Beanstalk environment'ina yeni version deploy eder.
Version label formati `branch-sha-run_id-attempt` oldugu icin workflow rerun veya manuel dispatch durumlarinda da ayni commit yeniden deploy edilebilir.
Workflow deploy sonunda aktif Elastic Beanstalk `VersionLabel` degerini kontrol eder; AWS deploy'u kabul etse bile eski versiyonda kalirsa run fail olur.

# Mimari

- AWS ECR repository: container image kaynagi
- AWS Elastic Beanstalk application: `lockin-nba`
- AWS Elastic Beanstalk production environment: `main` branch hedefi
- AWS Elastic Beanstalk staging environment: `dev` branch hedefi
- AWS CloudFront distribution: `lockinpicks.com` ve `www.lockinpicks.com` icin HTTPS edge katmani
- AWS Route53 hosted zone: `lockinpicks.com`
- GitHub Actions workflow: [deploy-eb.yml](/home/aytzey/Desktop/lockin_nba/.github/workflows/deploy-eb.yml)

# Aktif URL'ler

- Production: `https://lockinpicks.com`
- Production alternate: `https://www.lockinpicks.com`
- Elastic Beanstalk origin: `http://lockin-main.us-east-1.elasticbeanstalk.com`
- Staging: `http://lockin-dev.us-east-1.elasticbeanstalk.com`

# Registrar Kesimi

GoDaddy registrar tarafinda nameserver'lar Route53 hosted zone'a cevrildi:

- `ns-1048.awsdns-03.org`
- `ns-582.awsdns-08.net`
- `ns-1802.awsdns-33.co.uk`
- `ns-217.awsdns-27.com`

Route53 zone icinde su kayitlar tutulur:

- apex `A` ve `AAAA` alias -> CloudFront
- `www` `A` ve `AAAA` alias -> CloudFront
- Mailgun `MX`, `TXT` ve `email` `CNAME` kayitlari
- ACM validation `CNAME` kayitlari

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
- `EB_APPLICATION_NAME`
- `EB_ENVIRONMENT_MAIN`
- `EB_ENVIRONMENT_DEV`
- `EB_S3_BUCKET`

# Runtime Env

Her Elastic Beanstalk environment'inda en az su env'ler tanimli olmali:

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

Production environment su an:

- `NEXT_PUBLIC_APP_URL=https://lockinpicks.com`
- `OPENROUTER_SITE_URL=https://lockinpicks.com`

# Lokal Duman Testi

```bash
docker build -t lockin-nba:test .
docker run --rm -p 3000:3000 --env-file .env lockin-nba:test
```
