import { and, asc, eq, gte, isNull, lte, ne } from 'drizzle-orm';
import { db } from '../db';
import {
  bookingSlots,
  orders,
  slotClosures,
  type BookingSlot,
  type SlotClosure,
} from '../db/schema';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export function normalizeSlotTime(raw: string): string | null {
  const v = String(raw || '').trim();
  if (!TIME_RE.test(v)) return null;
  return v.slice(0, 5);
}

export function listBookingSlots(): BookingSlot[] {
  return db.select().from(bookingSlots).orderBy(asc(bookingSlots.sortOrder), asc(bookingSlots.time)).all();
}

export function getActiveSlotTimes(): string[] {
  return listBookingSlots()
    .filter((s) => s.active)
    .map((s) => s.time);
}

export function occupiedSlots(date: string, excludeOrderId?: number | null): Set<string> {
  const rows = db
    .select({ id: orders.id, slot: orders.scheduledSlot })
    .from(orders)
    .where(and(eq(orders.scheduledDate, date), ne(orders.status, 'cancelled')))
    .all();
  const busy = new Set<string>();
  for (const row of rows) {
    if (excludeOrderId != null && row.id === excludeOrderId) continue;
    const time = normalizeSlotTime(row.slot || '');
    if (time) busy.add(time);
  }
  return busy;
}

export function listClosuresForDate(date: string): SlotClosure[] {
  return db.select().from(slotClosures).where(eq(slotClosures.date, date)).all();
}

export function listClosuresInRange(from: string, to: string): SlotClosure[] {
  return db
    .select()
    .from(slotClosures)
    .where(and(gte(slotClosures.date, from), lte(slotClosures.date, to)))
    .all();
}

/** Whole day closed if a day-level closure exists (slotTime null). */
export function isDayClosed(date: string): boolean {
  const row = db
    .select()
    .from(slotClosures)
    .where(and(eq(slotClosures.date, date), isNull(slotClosures.slotTime)))
    .get();
  return Boolean(row);
}

export function closedSlotTimes(date: string): Set<string> {
  const rows = listClosuresForDate(date);
  const closed = new Set<string>();
  for (const row of rows) {
    if (row.slotTime) {
      const t = normalizeSlotTime(row.slotTime);
      if (t) closed.add(t);
    }
  }
  return closed;
}

/**
 * Active template slots minus bookings and date-level overrides.
 * Day closure → empty list.
 */
export function getFreeSlots(date: string, excludeOrderId?: number | null): string[] {
  if (isDayClosed(date)) return [];
  const busy = occupiedSlots(date, excludeOrderId);
  const closed = closedSlotTimes(date);
  return getActiveSlotTimes().filter((t) => !busy.has(t) && !closed.has(t));
}

export function isActiveSlot(time: string): boolean {
  const row = db
    .select()
    .from(bookingSlots)
    .where(and(eq(bookingSlots.time, time), eq(bookingSlots.active, true)))
    .get();
  return Boolean(row);
}

export function closeDay(date: string, note?: string | null) {
  // Replace any prior closures for the day with a single day block
  db.delete(slotClosures).where(eq(slotClosures.date, date)).run();
  db.insert(slotClosures)
    .values({ date, slotTime: null, note: note || null })
    .run();
}

export function openDay(date: string) {
  db.delete(slotClosures).where(eq(slotClosures.date, date)).run();
}

export function closeSlot(date: string, slotTime: string, note?: string | null) {
  const time = normalizeSlotTime(slotTime);
  if (!time) throw new Error('bad slot');
  if (isDayClosed(date)) return; // already fully closed
  const existing = db
    .select()
    .from(slotClosures)
    .where(and(eq(slotClosures.date, date), eq(slotClosures.slotTime, time)))
    .get();
  if (existing) return;
  db.insert(slotClosures)
    .values({ date, slotTime: time, note: note || null })
    .run();
}

export function openSlot(date: string, slotTime: string) {
  const time = normalizeSlotTime(slotTime);
  if (!time) return;
  // Opening a single slot while day is closed: convert day→all other slots closed
  if (isDayClosed(date)) {
    const times = getActiveSlotTimes().filter((t) => t !== time);
    db.delete(slotClosures).where(eq(slotClosures.date, date)).run();
    for (const t of times) {
      db.insert(slotClosures).values({ date, slotTime: t }).run();
    }
    return;
  }
  db.delete(slotClosures)
    .where(and(eq(slotClosures.date, date), eq(slotClosures.slotTime, time)))
    .run();
}

export function dayClosureSummary(date: string): {
  dayClosed: boolean;
  closedSlots: string[];
} {
  const rows = listClosuresForDate(date);
  const dayClosed = rows.some((r) => r.slotTime == null);
  const closedSlots = rows
    .map((r) => r.slotTime)
    .filter((t): t is string => Boolean(t))
    .sort();
  return { dayClosed, closedSlots };
}
