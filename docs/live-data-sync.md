---
title: LOCKIN Live Data Sync
updated: 2026-03-12
---

# Amaç

Bu akış, canlı NBA slate verisini düzenli aralıklarla çekip uygulama isteği gelmeden önce store'u ısıtmak için eklendi.

# Şu Anda Ne Yapıyor

- ESPN scoreboard feed'inden güncel maç, skor, broadcast ve moneyline verisini çeker.
- Günlük tahmini yalnızca `source: "auto"` ise yeniler.
- Admin panelinden yazılmış günlük tahminleri ezmez.
- İstenirse bugünü ve yarını aynı çağrıda senkronize eder.

# Endpoint

`GET /api/internal/live-sync`

Query parametreleri:

- `date=YYYY-MM-DD`
- `includeTomorrow=true`
- `forcePrediction=true`

Auth:

- `Authorization: Bearer <LOCKIN_SYNC_SECRET>`
- Alternatif olarak `CRON_SECRET` de aynı endpoint tarafından kabul edilir.

Örnek:

```bash
curl --fail \
  -H "Authorization: Bearer $LOCKIN_SYNC_SECRET" \
  "https://your-domain.com/api/internal/live-sync?includeTomorrow=true"
```

# GitHub Actions ile 5 Dakikada Bir Çekme

Repo içinde hazır workflow dosyası vardır:

- [live-data-sync.yml](/home/aytzey/Desktop/lockin_nba/.github/workflows/live-data-sync.yml)

GitHub ayarları:

1. Repository secret: `LOCKIN_SYNC_SECRET`
2. Repository variable: `LOCKIN_BASE_URL`

Workflow her 5 dakikada bir endpoint'i vurur. Secret veya base URL yoksa sessizce skip eder.

# Vercel Cron Alternatifi

Vercel kullanıyorsan aynı endpoint cron ile de tetiklenebilir. `CRON_SECRET` tanımlandığında Vercel cron isteklerini `Authorization: Bearer <CRON_SECRET>` ile yollar.

Örnek `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/internal/live-sync?includeTomorrow=true",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

Not:

- Vercel cron sıklığı plan limitlerine bağlıdır.
- Veriler artık Supabase Postgres'e yazıldığı için process restart sonrasında sync sonucu kaybolmaz.
- Bu yüzden scheduler artık sadece cache warm değil, kalıcı veri güncellemesi de yapar.

# Referans Dokümanlar

- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
- Vercel cron security (`CRON_SECRET`): https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
- GitHub Actions schedule: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule

# İlgili Dosyalar

- [src/app/api/internal/live-sync/route.ts](/home/aytzey/Desktop/lockin_nba/src/app/api/internal/live-sync/route.ts)
- [src/lib/daily-edge.ts](/home/aytzey/Desktop/lockin_nba/src/lib/daily-edge.ts)
- [src/lib/nba.ts](/home/aytzey/Desktop/lockin_nba/src/lib/nba.ts)
- [src/lib/store.ts](/home/aytzey/Desktop/lockin_nba/src/lib/store.ts)
- [src/lib/db.ts](/home/aytzey/Desktop/lockin_nba/src/lib/db.ts)
