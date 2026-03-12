---
title: LOCKIN Supabase Postgres
updated: 2026-03-12
---

# Amaç

LOCKIN içindeki tahmin, oyun, ödeme, sohbet ve admin verilerini process belleğinden çıkarıp kalıcı olarak Supabase Postgres'te saklamak.

# Kullanılan Env

Uygulama `DATABASE_URL` bekler.

Örnek:

```bash
SUPABASE_DIRECT_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres
SUPABASE_POOLER_SESSION_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-1-YOUR_REGION.pooler.supabase.com:5432/postgres
SUPABASE_POOLER_TRANSACTION_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-1-YOUR_REGION.pooler.supabase.com:6543/postgres
DATABASE_URL=$SUPABASE_POOLER_SESSION_URL
```

Not:

- Şifre içinde `@` varsa URL içinde `%40` olarak encode edilmelidir.
- Kod tarafı `DATABASE_URL` yoksa `SUPABASE_DB_URL` değerini de okuyabilir.
- `db.<project-ref>.supabase.co:5432` direct host bazı ortamlarda yalnızca IPv6 dönebilir. IPv6 çıkışı olmayan runtime'larda pooler DSN kullanılmalıdır.
- Uygulama için önerilen varsayılan bağlantı session pooler'dır: aynı host üzerinde port `5432`.
- Transaction pooler aynı host üzerinde port `6543` çalışır ve kısa ömürlü CLI/migration işleri için uygundur.
- Pooler host öneki her zaman `aws-0` olmayabilir. Gerçek değer dashboard'da `aws-1-<region>` gibi görünebilir.
- LOCKIN uygulaması Supabase host'ları için SSL'i kod içinde açtığı için app-level env'de ayrıca `sslmode=require` şart değildir.

# Çalışma Şekli

- `src/lib/db.ts` bir `pg` pool oluşturur.
- İlk server isteğinde gerekli tabloları `CREATE TABLE IF NOT EXISTS` ile otomatik açar.
- Varsayılan sistem prompt'u boş DB'de otomatik seed eder.
- `src/lib/store.ts` artık tüm read/write işlemlerini Postgres üzerinden async çalıştırır.

# Oluşturulan Tablolar

- `predictions`
- `social_proof_banner`
- `system_prompts`
- `games`
- `chat_sessions`
- `chat_messages`
- `checkout_sessions`
- `payments`
- `magic_links`

# Sync ile İlişkisi

- `/api/internal/live-sync` ESPN'den slate çeker.
- Günlük tahmini yeniler.
- Sonuçlar Supabase'e yazıldığı için backend self-refresh çıktısı restart sonrasında da korunur.

# Doğrulama

Lokal bağlantı doğrulaması için:

```bash
node --env-file=.env -e "const { Client } = require('pg'); const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }); client.connect().then(() => client.query('select now() as now')).then((r) => { console.log(r.rows[0]); return client.end(); });"
```

Transaction pooler doğrulaması için:

```bash
node --env-file=.env -e "const { Client } = require('pg'); const client = new Client({ connectionString: process.env.SUPABASE_POOLER_TRANSACTION_URL, ssl: { rejectUnauthorized: false } }); client.connect().then(() => client.query('select current_user, now() as now')).then((r) => { console.log(r.rows[0]); return client.end(); });"
```

# İlgili Dosyalar

- [src/lib/db.ts](/home/aytzey/Desktop/lockin_nba/src/lib/db.ts)
- [src/lib/store.ts](/home/aytzey/Desktop/lockin_nba/src/lib/store.ts)
- [src/lib/daily-edge.ts](/home/aytzey/Desktop/lockin_nba/src/lib/daily-edge.ts)
