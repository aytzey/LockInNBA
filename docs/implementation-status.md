---
title: LOCKIN MVP — PRD v1.2 Implementasyon Notu
updated: 2026-03-12
---

# Durum Notu

Bu dosya, PRD V1.2 için yapılan son ilerlemeyi ve bir sonraki adımları saklar.

## Nereye Kaldık

- Ana kullanıcı akışı SPA olarak çalışır durumda:
  - Blurlu günlük tahmin kartı (canlı slate bağlamından üretilen teaser + anti-hack kuralı)
  - Günlük paywall `$5` açma
  - No Edge Day’de `$5` kapısının kapanıp `$2` LLM CTA’sına geçmesi
  - Maç listesi: canlı ESPN scoreboard + **Moneyline (American Odds)**
  - LLM sohbeti: `$2` açma, 3 soru limiti, `+3` genişleme
  - Restore akışı: `magic link` + `localStorage` token ile kurtarma
  - Insight Card üretimi (`html2canvas` ile PNG)
- Admin tarafı (`/admin-secure`):
  - Tek admin login
  - Günlük tahmin yönetimi (No Edge checkbox dahil)
  - Social Proof banner yönetimi
  - Sistem prompt geçmişi
  - Geçmiş tahmin listesi

## Tamamlanan Kod Katmanları

- Frontend/UX: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`
- Admin: `src/app/admin-secure/page.tsx`
- API:
  - `src/app/api/predictions/today/route.ts`
  - `src/app/api/predictions/unlock/route.ts`
  - `src/app/api/games/today/route.ts`
  - `src/app/api/social-proof/route.ts`
  - `src/app/api/payments/create-checkout/route.ts`
  - `src/app/api/payments/webhook/route.ts`
  - `src/app/api/payments/mock-complete/route.ts`
  - `src/app/api/auth/magic-link/route.ts`
  - `src/app/api/auth/verify-magic/[token]/route.ts`
  - `src/app/api/chat/session/route.ts`
  - `src/app/api/chat/session/[id]/route.ts`
  - `src/app/api/chat/message/route.ts`
  - `src/app/api/admin/login/route.ts`
  - `src/app/api/admin/predictions/route.ts`
  - `src/app/api/admin/social-proof-banner/route.ts`
  - `src/app/api/admin/system-prompt/route.ts`
- Uygulama katmanı:
  - `src/lib/store.ts`
  - `src/lib/token.ts`
  - `src/lib/admin.ts`
  - `src/lib/llm.ts`
  - `src/lib/time.ts`
  - `src/lib/rate-limit.ts`
- Marka assetleri:
  - `public/lockin-logo.svg`
  - `public/lockin-logo.png`

## Kısa Önemli Notlar (Henüz Tam Olmayanlar)

- Stripe Checkout gerçek canlı entegrasyon henüz mock akışında.
- OpenRouter `google/gemini-3.1-flash-lite-preview` canlı çağrısı aktif; hata durumunda deterministik fallback cevabı var.
- Kalıcı veri katmanı Supabase Postgres üzerinden çalışıyor; schema ilk server erişiminde otomatik bootstrap ediliyor.
- Korumalı live-sync endpoint korundu; canlı maç verisi artık GitHub scheduler yerine backend self-refresh ile yenileniyor ve auto prediction yenilemesi admin override’larını ezmiyor.

## Son Doğrulamalar

- `npm run lint` ✅
- `npm run build` ✅

## Sonraki Adım

1. Stripe checkout + webhook katmanını gerçek sağlayıcı doğrulamasıyla sertleştirmek
2. Supabase SQL migration dosyalarını repo içine almak
3. Günlük edge üretimini oyun değişimlerini hashleyerek daha deterministik invalidate etmek
4. Admin ve ödeme kayıtları için audit/log görünürlüğünü artırmak
