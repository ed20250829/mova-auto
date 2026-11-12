# Мова (Mova)

Русификация китайских авто в Минске. Клиентский сайт + калькулятор + бронь + админка + финансы.

## Quick start

```bash
cp .env.example .env
npm install
npm run db:seed
npm run dev
```

Local: [http://127.0.0.1:4321](http://127.0.0.1:4321)

Admin: [http://127.0.0.1:4321/admin](http://127.0.0.1:4321/admin) — token from `ADMIN_TOKEN` in `.env` (default in example: `dev-admin-token-change-me`).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build (Vercel adapter) |
| `npm run preview` | Preview build |
| `npm run db:seed` | Seed 40+ models + domain expense |
| `npm run db:seed:force` | Reseed models |
| `npm run db:migrate:pg` | Write/apply Postgres DDL |

## Env

See `.env.example` and [`docs/setup.md`](docs/setup.md): `ADMIN_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `DATABASE_PATH`, optional partner bot, `DATABASE_URL` for Postgres, optional `PUBLIC_YANDEX_METRIKA_ID`, optional `PUBLIC_GTM_ID`.

## Deploy

Vercel-ready (`@astrojs/vercel`). Point domain `mova-auto.tech`. For production DB prefer Postgres/Turso — SQLite file is for local/single-node. Brand notes: `IDEAS.md`.
