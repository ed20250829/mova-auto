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

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      client_name TEXT NOT NULL,
      client_phone TEXT NOT NULL,
      client_telegram TEXT,
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
      referral_code TEXT
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
      contacted INTEGER NOT NULL DEFAULT 0
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

    CREATE UNIQUE INDEX IF NOT EXISTS models_brand_model_uidx
      ON models(brand_slug, model_slug);
  `);

  ensureColumn('models', 'body_style', "TEXT NOT NULL DEFAULT 'crossover'");
  ensureColumn('models', 'image_path', 'TEXT');
}

function ensureColumn(table: string, column: string, definition: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
