---
title: LOCKIN AWS Deploy
updated: 2026-03-13
---

# Amaç

LOCKIN NBA uygulamasini AWS uzerinde minimum surekli maliyetle calistirmak:

- `main` -> production
- `dev` -> kod branch'i olarak kalir, AWS uzerinde surekli staging environment tutulmaz

Her `main` push'unda GitHub Actions Docker image'i ECR'ye gonderir, `Dockerrun.aws.json` bundle'i uretir ve production Elastic Beanstalk environment'ina yeni version deploy eder.
Version label formati `branch-sha-run_id-attempt` oldugu icin workflow rerun veya manuel dispatch durumlarinda da ayni commit yeniden deploy edilebilir.
Workflow deploy sonunda aktif Elastic Beanstalk `VersionLabel` degerini kontrol eder; AWS deploy'u kabul etse bile eski versiyonda kalirsa run fail olur.

# Mimari

- AWS ECR repository: container image kaynagi
- AWS Elastic Beanstalk application: `lockin-nba`
- AWS Elastic Beanstalk production environment: `main` branch hedefi
- AWS CloudFront distribution: `lockinpicks.com` ve `www.lockinpicks.com` icin HTTPS edge katmani
- AWS Route53 hosted zone: `lockinpicks.com`
- GitHub Actions workflow: [deploy-eb.yml](/home/aytzey/Desktop/lockin_nba/.github/workflows/deploy-eb.yml)

# Maliyet Kurali

Bu proje AWS tarafinda su maliyet tabanini hedefler:

- sadece 1 adet surekli calisan production EC2 instance
- staging veya preview icin surekli acik ikinci environment yok
- ECR icinde eski untagged image'lar birikmez
- deploy bucket icinde eski bundle ve release artefact'lari otomatik silinir

Su anki sabit veya yari-sabit AWS kalemleri bunlardir:

- production Elastic Beanstalk compute
- CloudFront dagitimi
- Route53 hosted zone

CloudFront burada gereksiz luks degil; tek-instance Elastic Beanstalk uzerinde `lockinpicks.com` icin HTTPS bitirmek icin en dusuk-riskli katmandir. Route53 ise nameserver kesimi AWS'ye alindigi icin aktif tutulur.

# Aktif URL'ler

- Production: `https://lockinpicks.com`
- Production alternate: `https://www.lockinpicks.com`
- Elastic Beanstalk origin: `http://lockin-main.us-east-1.elasticbeanstalk.com`

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
- `dev` branch -> AWS deploy yok, sadece kod branch'i

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
- `EB_S3_BUCKET`

# Artefact Retention

AWS tarafinda deploy artefact birikimini sinirlamak icin:

- ECR: eski untagged image'lar lifecycle policy ile temizlenir
- Elastic Beanstalk: her `main` deploy'undan sonra eski application version'lar ve source bundle'lari son 2 rollback noktasi disinda silinir
- S3: `bundles/` ve `releases/` altindaki eski zip'ler 7 gunde silinir
- S3: `deployments/dev/` altindaki eski zip'ler 3 gunde silinir

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
