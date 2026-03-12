---
title: LOCKIN Live Data Sync
updated: 2026-03-12
---

# Amaç

Bu akış, canlı NBA slate verisini Supabase üzerinde tutup backend isteği geldiğinde stale kontrolü ile yenilemek için kullanılır.

# Şu Anda Ne Yapıyor

- ESPN scoreboard feed'inden güncel maç, skor, broadcast ve moneyline verisini çeker.
- Varsayılan çalışma şekli request-driven'dır; ayrı bir cron veya GitHub scheduler gerekmez.
- Backend önce Supabase'teki son senkron zamanına bakar, veri bayatsa ESPN'den yeniden çeker.
- `live` maçlar en sık, `upcoming` slate daha seyrek, `final` ve boş günler en seyrek yenilenir.
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

# Çalışma Modeli

- Homepage `/api/predictions/today` ve `/api/games/today` çağrılarında backend stale kontrolü yapar.
- Chat tarafı soru geldiğinde aynı stale-aware oyun senkronizasyonunu tekrar kullanır.
- Bu yüzden ayrı GitHub Actions cron'u olmadan da güncel maç verisi akmaya devam eder.
- `GET /api/internal/live-sync` artık sadece manuel veya admin amaçlı force-refresh aracıdır.

# İlgili Dosyalar

- [src/app/api/internal/live-sync/route.ts](/home/aytzey/Desktop/lockin_nba/src/app/api/internal/live-sync/route.ts)
- [src/lib/daily-edge.ts](/home/aytzey/Desktop/lockin_nba/src/lib/daily-edge.ts)
- [src/lib/nba.ts](/home/aytzey/Desktop/lockin_nba/src/lib/nba.ts)
- [src/lib/store.ts](/home/aytzey/Desktop/lockin_nba/src/lib/store.ts)
- [src/lib/db.ts](/home/aytzey/Desktop/lockin_nba/src/lib/db.ts)
