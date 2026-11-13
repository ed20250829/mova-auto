import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as schema from './schema';

const dbPath = resolve(process.env.DATABASE_PATH ?? './data/mova.db');

function ensureDbFile(path: string) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

ensureDbFile(dbPath);

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { sqlite };

export function initSchema() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      requires_ota_subscription INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      body_style TEXT NOT NULL DEFAULT 'crossover',
      image_path TEXT,
      cost_base INTEGER NOT NULL DEFAULT 80,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'importer',
      contact_name TEXT,
      phone TEXT,
      telegram TEXT,
      email TEXT,
      wholesale_price INTEGER,
      commission_percent REAL DEFAULT 0,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS promo_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL DEFAULT 'percent',
      value INTEGER NOT NULL,
      first_order_only INTEGER NOT NULL DEFAULT 1,
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      valid_from TEXT,
      valid_to TEXT,
      channel_note TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
      paid_at TEXT,
      payment_method TEXT,
      payment_provider TEXT,
      provider_payment_id TEXT,
      amount_paid INTEGER
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
      contacted INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'new'
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      client_phone TEXT NOT NULL,
      client_telegram TEXT,
      model_label TEXT,
      order_id INTEGER REFERENCES orders(id),
      plan TEXT NOT NULL DEFAULT 'ota_year',
      price INTEGER NOT NULL DEFAULT 150,
      started_at TEXT NOT NULL,
      next_payment_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      last_remind_at TEXT,
      last_remind_days INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'BYN',
      recurring INTEGER NOT NULL DEFAULT 0,
      next_payment_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      device TEXT,
      meta TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS telegram_users (
      chat_id TEXT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      state TEXT NOT NULL DEFAULT 'idle',
      draft TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS telegram_bridges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_message_id INTEGER NOT NULL,
      client_chat_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS booking_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS portfolio_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image_path TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS models_brand_model_uidx
      ON models(brand_slug, model_slug);

    CREATE INDEX IF NOT EXISTS portfolio_cases_published_idx
      ON portfolio_cases(published, sort_order);

    CREATE INDEX IF NOT EXISTS telegram_bridges_owner_msg_idx
      ON telegram_bridges(owner_message_id);

    CREATE INDEX IF NOT EXISTS telegram_users_username_idx
      ON telegram_users(username);
  `);

  seedBookingSlots();

  ensureColumn('models', 'body_style', "TEXT NOT NULL DEFAULT 'crossover'");
  ensureColumn('models', 'image_path', 'TEXT');
  ensureColumn('orders', 'promo_code_id', 'INTEGER REFERENCES promo_codes(id)');
  ensureColumn('orders', 'payment_status', "TEXT NOT NULL DEFAULT 'unpaid'");
  ensureColumn('orders', 'paid_at', 'TEXT');
  ensureColumn('orders', 'payment_method', 'TEXT');
  ensureColumn('orders', 'payment_provider', 'TEXT');
  ensureColumn('orders', 'provider_payment_id', 'TEXT');
  ensureColumn('orders', 'amount_paid', 'INTEGER');
  ensureColumn('orders', 'client_telegram_chat_id', 'TEXT');
  ensureColumn('leads', 'status', "TEXT NOT NULL DEFAULT 'new'");
  ensureColumn('subscriptions', 'last_remind_at', 'TEXT');
  ensureColumn('subscriptions', 'last_remind_days', 'INTEGER');
  seedSiteSettings();
  backfillLeadStatuses();
}

function seedSiteSettings() {
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO site_settings (key, value) VALUES ('show_sample_banner', '0')`,
    )
    .run();
}

function backfillLeadStatuses() {
  sqlite
    .prepare(
      `UPDATE leads SET status = 'contacted'
       WHERE contacted = 1 AND (status IS NULL OR status = '' OR status = 'new')`,
    )
    .run();
  sqlite
    .prepare(
      `UPDATE leads SET status = 'new'
       WHERE (status IS NULL OR status = '') AND contacted = 0`,
    )
    .run();
}

function seedBookingSlots() {
  const count = (sqlite.prepare('SELECT COUNT(*) AS c FROM booking_slots').get() as { c: number }).c;
  if (count > 0) return;
  const defaults = ['10:00', '12:00', '14:00', '16:00', '18:00', '19:00', '20:00'];
  const insert = sqlite.prepare(
    'INSERT INTO booking_slots (time, active, sort_order) VALUES (?, 1, ?)',
  );
  const tx = sqlite.transaction(() => {
    defaults.forEach((time, i) => insert.run(time, i));
  });
  tx();
}

function ensureColumn(table: string, column: string, definition: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
