/**
 * Ensure 4 published portfolio cases exist (Pexels RF cabin photos in public/cases/).
 * Safe to re-run: no-op when rows already present unless --force.
 */
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const force = process.argv.includes('--force');
const dbPath = resolve(process.env.DATABASE_PATH ?? './data/mova.db');
const sqlite = new Database(dbPath);

sqlite.exec(`
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
`);

const cases = [
  { title: 'Geely Monjaro', description: 'Меню и настройки на русском', imagePath: '/cases/geely-cabin.jpg', sortOrder: 0 },
  { title: 'BYD Song Plus', description: 'DiLink · базовое меню RU', imagePath: '/cases/byd-cabin.jpg', sortOrder: 1 },
  { title: 'Zeekr 001', description: 'Меню RU · визит 2–3 часа', imagePath: '/cases/zeekr-cabin.jpg', sortOrder: 2 },
  { title: 'Li Auto L7', description: 'Меню RU · Li OS', imagePath: '/cases/li-cabin.jpg', sortOrder: 3 },
];

if (force) sqlite.exec('DELETE FROM portfolio_cases');

const insert = sqlite.prepare(
  `INSERT INTO portfolio_cases (title, description, image_path, published, sort_order)
   VALUES (?, ?, ?, 1, ?)`,
);
const update = sqlite.prepare(
  `UPDATE portfolio_cases
   SET description = ?, image_path = ?, published = 1, sort_order = ?, updated_at = datetime('now')
   WHERE title = ?`,
);
const byTitle = sqlite.prepare(`SELECT id FROM portfolio_cases WHERE title = ?`);

for (const c of cases) {
  const disk = resolve(`./public${c.imagePath}`);
  if (!existsSync(disk)) {
    console.warn('missing', c.imagePath);
    continue;
  }
  const row = byTitle.get(c.title);
  if (row) {
    update.run(c.description, c.imagePath, c.sortOrder, c.title);
    console.log('updated', c.title, c.imagePath);
  } else {
    insert.run(c.title, c.description, c.imagePath, c.sortOrder);
    console.log('seeded', c.title, c.imagePath);
  }
}

console.log(sqlite.prepare('SELECT id, title, description, image_path, published FROM portfolio_cases').all());
