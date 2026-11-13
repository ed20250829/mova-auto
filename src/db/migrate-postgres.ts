/**
 * Postgres migration path.
 * Usage: DATABASE_URL=postgresql://... npm run db:migrate:pg
 *
 * Generates SQL compatible with Postgres from the SQLite schema
 * and applies it when DATABASE_URL is set. For day-to-day SQLite stays default.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PG_DDL = `
CREATE TABLE IF NOT EXISTS models (
  id SERIAL PRIMARY KEY,
  brand TEXT NOT NULL,
  brand_slug TEXT NOT NULL,
  model TEXT NOT NULL,
  model_slug TEXT NOT NULL,
  year_from INTEGER NOT NULL,
  year_to INTEGER,
  generation TEXT,
  screen_type TEXT NOT NULL,
  price_base INTEGER NOT NULL,
  time_minutes INTEGER NOT NULL,
  complexity TEXT NOT NULL,
  known_issues TEXT NOT NULL DEFAULT '[]',
  requires_ota_subscription BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  cost_base INTEGER NOT NULL DEFAULT 80,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_slug, model_slug)
);

CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'importer',
  contact_name TEXT,
  phone TEXT,
  telegram TEXT,
  email TEXT,
  wholesale_price INTEGER,
  commission_percent DOUBLE PRECISION DEFAULT 0,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'percent',
  value INTEGER NOT NULL,
  first_order_only BOOLEAN NOT NULL DEFAULT TRUE,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  valid_from TEXT,
  valid_to TEXT,
  channel_note TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_telegram TEXT,
  client_telegram_chat_id TEXT,
  model_id INTEGER REFERENCES models(id),
  model_label TEXT NOT NULL,
  price INTEGER NOT NULL,
  cost INTEGER NOT NULL DEFAULT 80,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT DEFAULT 'site',
  partner_id INTEGER REFERENCES partners(id),
  scheduled_date TEXT,
  scheduled_slot TEXT,
  comment TEXT,
  options TEXT DEFAULT '[]',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  promo_code TEXT,
  promo_code_id INTEGER REFERENCES promo_codes(id),
  referral_code TEXT,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  payment_provider TEXT,
  provider_payment_id TEXT,
  amount_paid INTEGER
);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT,
  phone TEXT,
  telegram TEXT,
  model_label TEXT,
  drop_step TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  device TEXT,
  notes TEXT,
  contacted BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'new'
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_telegram TEXT,
  model_label TEXT,
  order_id INTEGER REFERENCES orders(id),
  plan TEXT NOT NULL DEFAULT 'ota_year',
  price INTEGER NOT NULL DEFAULT 150,
  started_at DATE NOT NULL,
  next_payment_at DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  last_remind_at TEXT,
  last_remind_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BYN',
  recurring BOOLEAN NOT NULL DEFAULT FALSE,
  next_payment_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  device TEXT,
  meta TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_users (
  chat_id TEXT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  state TEXT NOT NULL DEFAULT 'idle',
  draft TEXT NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_bridges (
  id SERIAL PRIMARY KEY,
  owner_message_id INTEGER NOT NULL,
  client_chat_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telegram_bridges_owner_msg_idx ON telegram_bridges(owner_message_id);
CREATE INDEX IF NOT EXISTS telegram_users_username_idx ON telegram_users(username);

CREATE TABLE IF NOT EXISTS booking_slots (
  id SERIAL PRIMARY KEY,
  time TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_cases (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_path TEXT NOT NULL,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS portfolio_cases_published_idx
  ON portfolio_cases(published, sort_order);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO site_settings (key, value)
VALUES ('show_sample_banner', '0')
ON CONFLICT (key) DO NOTHING;
`;

async function main() {
  const outDir = resolve('./drizzle');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const sqlPath = resolve(outDir, 'postgres.sql');
  writeFileSync(sqlPath, PG_DDL.trim() + '\n');
  console.log(`Wrote ${sqlPath}`);

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('DATABASE_URL not set. SQL written; skipping apply.');
    console.log('Set DATABASE_URL and re-run to apply against Postgres.');
    return;
  }

  // Dynamic import so SQLite-only installs don't require pg
  const { default: pg } = await import('pg').catch(() => {
    console.error('Install pg: npm i pg');
    process.exit(1);
    return { default: null as never };
  });

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query(readFileSync(sqlPath, 'utf8'));
  await client.end();
  console.log('Postgres schema applied.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
