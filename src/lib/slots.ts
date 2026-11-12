import { and, asc, eq, ne } from 'drizzle-orm';
import { db } from '../db';
import { bookingSlots, orders, type BookingSlot } from '../db/schema';

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

export function occupiedSlots(date: string): Set<string> {
  const rows = db
    .select({ slot: orders.scheduledSlot })
    .from(orders)
    .where(and(eq(orders.scheduledDate, date), ne(orders.status, 'cancelled')))
    .all();
  const busy = new Set<string>();
  for (const row of rows) {
    const time = normalizeSlotTime(row.slot || '');
    if (time) busy.add(time);
  }
  return busy;
}

/** Active slots minus ones already booked that day (any status except cancelled). */
export function getFreeSlots(date: string): string[] {
  const busy = occupiedSlots(date);
  return getActiveSlotTimes().filter((t) => !busy.has(t));
}

export function isActiveSlot(time: string): boolean {
  const row = db
    .select()
    .from(bookingSlots)
    .where(and(eq(bookingSlots.time, time), eq(bookingSlots.active, true)))
    .get();
  return Boolean(row);
}
