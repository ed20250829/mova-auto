import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '../db';
import { orders } from '../db/schema';
import { ensureDb } from './models';
import { getMinskParts } from './minsk-hours';
import { getFreeSlots } from './slots';

export type TickerItem = {
  id: string;
  text: string;
  href?: string;
  role?: 'manifesto' | 'social';
};

type TickerFile = {
  manifesto: TickerItem[];
  socialFallback: TickerItem[];
};

const NAME_RE = /^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё-]{1,20}$/u;
const CACHE_MS = 5 * 60 * 1000;

let fileCache: { at: number; data: TickerFile } | null = null;
let socialCache: { at: number; items: TickerItem[] } | null = null;

function tickerPath() {
  return resolve(process.env.TICKER_PATH ?? './data/ticker.json');
}

export function loadTickerFile(): TickerFile {
  const now = Date.now();
  if (fileCache && now - fileCache.at < CACHE_MS) return fileCache.data;
  const path = tickerPath();
  if (!existsSync(path)) {
    const empty: TickerFile = { manifesto: [], socialFallback: [] };
    fileCache = { at: now, data: empty };
    return empty;
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as TickerFile;
  const data: TickerFile = {
    manifesto: Array.isArray(raw.manifesto) ? raw.manifesto : [],
    socialFallback: Array.isArray(raw.socialFallback) ? raw.socialFallback : [],
  };
  fileCache = { at: now, data };
  return data;
}

export function getManifestoItems(): TickerItem[] {
  return loadTickerFile().manifesto.map((item) => ({
    ...item,
    role: 'manifesto' as const,
  }));
}

/** Public first name only — never phone, telegram, or order id. */
export function anonymizeClientName(raw: string | null | undefined): string {
  const first = String(raw || '')
    .trim()
    .split(/\s+/)[0]
    ?.replace(/[.,;:]+$/g, '');
  if (first && NAME_RE.test(first)) {
    return first.charAt(0).toUpperCase() + first.slice(1);
  }
  return 'Клиент';
}

function parseSqliteUtc(ts: string): Date {
  // SQLite datetime('now') is UTC-ish "YYYY-MM-DD HH:MM:SS"
  const normalized = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z';
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function relativeTimeRu(from: Date, to = new Date()): string {
  const sec = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
  if (sec < 60) return 'только что';
  const min = Math.floor(sec / 60);
  if (min < 60) {
    if (min === 1) return '1 минуту назад';
    if (min >= 2 && min <= 4) return `${min} минуты назад`;
    return `${min} минут назад`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    if (hr === 1) return '1 час назад';
    if (hr >= 2 && hr <= 4) return `${hr} часа назад`;
    return `${hr} часов назад`;
  }
  const days = Math.floor(hr / 24);
  if (days === 1) return 'вчера';
  if (days >= 2 && days <= 4) return `${days} дня назад`;
  return `${days} дней назад`;
}

function sevenDaysAgoIso(): string {
  const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function buildSocialFromOrders(): TickerItem[] {
  ensureDb();
  const since = sevenDaysAgoIso();
  const rows = db
    .select({
      id: orders.id,
      clientName: orders.clientName,
      modelLabel: orders.modelLabel,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
    })
    .from(orders)
    .where(and(eq(orders.status, 'done'), gte(orders.createdAt, since)))
    .orderBy(desc(orders.createdAt))
    .limit(12)
    .all();

  return rows.map((row) => {
    const when = parseSqliteUtc(row.paidAt || row.createdAt);
    const name = anonymizeClientName(row.clientName);
    const model = String(row.modelLabel || 'авто').trim();
    return {
      id: `order-${row.id}`,
      text: `${name} · ${model} · меню на русском · ${relativeTimeRu(when)}`,
      href: '/#booking',
      role: 'social' as const,
    };
  });
}

function slotProofItem(): TickerItem | null {
  try {
    ensureDb();
    const { date } = getMinskParts();
    const free = getFreeSlots(date);
    if (free.length === 0) return null;
    const n = free.length;
    const word =
      n === 1 ? 'слот' : n >= 2 && n <= 4 ? 'слота' : 'слотов';
    return {
      id: `slots-${date}`,
      text: `Сегодня свободно ${n} ${word} · запись онлайн`,
      href: '/#booking',
      role: 'social',
    };
  } catch {
    return null;
  }
}

/** Live social proof (done orders, 7d) + optional slots line. Cached 5 min. */
export function getSocialItems(opts?: { bypassCache?: boolean }): TickerItem[] {
  const now = Date.now();
  if (!opts?.bypassCache && socialCache && now - socialCache.at < CACHE_MS) {
    return socialCache.items;
  }

  const file = loadTickerFile();
  let items: TickerItem[] = [];
  try {
    items = buildSocialFromOrders();
  } catch {
    items = [];
  }

  const slot = slotProofItem();
  if (slot) items = [slot, ...items];

  if (items.length === 0) {
    items = (file.socialFallback.length ? file.socialFallback : file.manifesto).map(
      (item) => ({
        ...item,
        role: 'social' as const,
      }),
    );
  }

  socialCache = { at: now, items };
  return items;
}

export function getTickerPayload() {
  return {
    manifesto: getManifestoItems(),
    social: getSocialItems(),
    cachedForMs: CACHE_MS,
  };
}
