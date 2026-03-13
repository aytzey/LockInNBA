---
title: LOCKIN AWS Deploy
updated: 2026-03-13
---

# Amaç

LOCKIN NBA uygulamasini AWS uzerinde minimum surekli maliyetle calistirmak:

- `main` -> production
- `dev` -> kod branch'i olarak kalir, AWS uzerinde surekli staging environment tutulmaz

Her `main` push'unda GitHub Actions Docker image'i ECR'ye gonderir ve production Lambda function'inin image'ini gunceller.
Lambda Web Adapter ayni Next.js standalone build'ini HTTP uygulamasi gibi Lambda icinde calistirir.

# Mimari

- AWS ECR repository: container image kaynagi
- AWS Lambda function: `lockin-nba-web`
- AWS Lambda Function URL: CloudFront origin'i
- AWS CloudFront distribution: `lockinpicks.com` ve `www.lockinpicks.com` icin HTTPS edge katmani
- AWS Route53 hosted zone: `lockinpicks.com`
- GitHub Actions workflow: [deploy-lambda.yml](/home/aytzey/Desktop/lockin_nba/.github/workflows/deploy-lambda.yml)

Lambda Function URL public auth modunda kalsa bile origin seviyesinde CloudFront secret header korumasi kullanilir.
Uygulama proxy katmani `x-lockin-origin-verify` header'ini bekler; bu header sadece CloudFront origin config'inde tanimlidir.

# Maliyet Kurali

Bu proje AWS tarafinda su maliyet tabanini hedefler:

- surekli acik EC2 instance yok
- staging veya preview icin surekli acik ikinci environment yok
- ECR icinde eski untagged image'lar birikmez
- tek surekli altyapi CloudFront + Route53 + istek bazli Lambda olarak kalir

Su anki sabit veya yari-sabit AWS kalemleri bunlardir:

- CloudFront dagitimi
- Route53 hosted zone
- ECR storage
- Lambda request/compute kullanimi

CloudFront burada gereksiz luks degil; `lockinpicks.com` HTTPS bitisini, cache katmanini ve Lambda origin'ine stabil edge erisimini saglar. Route53 ise nameserver kesimi AWS'ye alindigi icin aktif tutulur.

# Aktif URL'ler

- Production: `https://lockinpicks.com`
- Production alternate: `https://www.lockinpicks.com`
- CloudFront origin: Lambda Function URL

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
- `LAMBDA_FUNCTION_NAME` workflow icinde sabit `lockin-nba-web` olarak kullanilir

# Artefact Retention

AWS tarafinda deploy artefact birikimini sinirlamak icin:

- ECR: eski untagged image'lar lifecycle policy ile temizlenir
- Lambda deploy zinciri S3 source bundle kullanmaz

# Runtime Env

Lambda function env icinde en az su degiskenler tanimli olmali:

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
- `ORIGIN_VERIFY_SECRET`

Production env su an:

- `NEXT_PUBLIC_APP_URL=https://lockinpicks.com`
- `OPENROUTER_SITE_URL=https://lockinpicks.com`

# Lokal Duman Testi

```bash
docker build -t lockin-nba:test .
docker run --rm -p 3000:3000 --env-file .env lockin-nba:test
```
