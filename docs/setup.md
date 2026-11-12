# Setup

## Env

Copy `.env.example` → `.env` (local) or set the same keys on the hoster.

| Key | Required | Notes |
| --- | --- | --- |
| `ADMIN_TOKEN` | yes (prod) | Long random secret for admin cookie |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | for leads | Owner notifications |
| `DATABASE_PATH` / `DATABASE_URL` | yes | SQLite local; Postgres preferred in prod |
| `PUBLIC_SITE_URL` | yes | Canonical site, e.g. `https://mova-auto.tech` |
| `PUBLIC_YANDEX_METRIKA_ID` | optional | Counter number from Metrika. Empty = script not loaded |

## Yandex Metrika

1. Create a counter in [Yandex Metrika](https://metrika.yandex.ru/) for `mova-auto.tech`.
2. Put the counter id in hoster env: `PUBLIC_YANDEX_METRIKA_ID=12345678` (no quotes).
3. Redeploy / restart so the public env is available at runtime (and at build if the hoster bakes `PUBLIC_*`).

**Cookie consent:** the counter loads only after the visitor clicks «Принять» on the cookie banner (or if consent was already stored as `accepted` in `localStorage`). Decline → no Metrika. Goals that fire before accept (e.g. `calc_open`) are queued and sent after init. Align privacy policy text with this.

### Goals to create in Metrika UI

| Goal id (identifier) | When it fires |
| --- | --- |
| `booking_success` | Booking form submitted successfully |
| `callback_success` | Callback («жду звонка») submitted successfully |
| `calc_open` | Calculator mounted |
| `promo_apply` | Promo code validated successfully (calc or booking) |

Create them as JavaScript goals / `reachGoal` with the exact identifiers above.

### UTM

Keep ad links consistent, e.g. `?utm_source=kufar&utm_medium=cpc&utm_campaign=model_fix`. UTM is stored with first-party events and orders; Metrika also picks up query params automatically when the counter is loaded.
