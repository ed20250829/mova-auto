import { eq } from 'drizzle-orm';
import { db } from '../db';
import { orders, subscriptions, type Order, type Subscription } from '../db/schema';
import { getMinskParts } from './minsk-hours';
import { PRICING_OPTIONS } from './pricing';
import { notifyClientStatus } from './telegram';

export const OTA_REMIND_WINDOWS = [14, 7, 3, 0] as const;

export function orderHasOta(optionsJson: string | null | undefined): boolean {
  try {
    const opts = JSON.parse(optionsJson || '[]');
    return Array.isArray(opts) && opts.includes('ota');
  } catch {
    return false;
  }
}

function addYears(isoDate: string, years = 1): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso.slice(0, 10)}T12:00:00Z`);
  const b = Date.parse(`${toIso.slice(0, 10)}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function todayMinsk(): string {
  return getMinskParts().date;
}

/** Create OTA subscription for an order that has the ota option (idempotent). */
export function ensureOtaSubscriptionForOrder(order: Order): { id: number; created: boolean } | null {
  if (!orderHasOta(order.options)) return null;

  const byOrder = db.select().from(subscriptions).where(eq(subscriptions.orderId, order.id)).get();
  if (byOrder) return { id: byOrder.id, created: false };

  const started =
    (order.scheduledDate || order.paidAt || order.createdAt || todayMinsk()).slice(0, 10) || todayMinsk();
  const nextPaymentAt = addYears(started, 1);

  const result = db
    .insert(subscriptions)
    .values({
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      clientTelegram: order.clientTelegram,
      modelLabel: order.modelLabel,
      orderId: order.id,
      plan: 'ota_year',
      price: PRICING_OPTIONS.otaInsurance,
      startedAt: started,
      nextPaymentAt,
      status: 'active',
      notes: 'Авто из заказа с OTA',
    })
    .run();

  return { id: Number(result.lastInsertRowid), created: true };
}

/** Backfill missing subscriptions for paid/done orders that already have ota in options. */
export function syncOtaSubscriptionsFromOrders(): { created: number; scanned: number } {
  const rows = db.select().from(orders).all();
  let created = 0;
  let scanned = 0;
  for (const order of rows) {
    if (!orderHasOta(order.options)) continue;
    if (order.status === 'cancelled') continue;
    scanned += 1;
    const res = ensureOtaSubscriptionForOrder(order);
    if (res?.created) created += 1;
  }
  return { created, scanned };
}

export type OtaRemindCandidate = {
  subscription: Subscription;
  daysUntil: number;
  window: number;
  overdue: boolean;
};

export function listOtaRemindCandidates(today = todayMinsk()): OtaRemindCandidate[] {
  const active = db
    .select()
    .from(subscriptions)
    .all()
    .filter((s) => s.status === 'active');

  const out: OtaRemindCandidate[] = [];
  for (const s of active) {
    const daysUntil = daysBetween(today, s.nextPaymentAt);
    const overdue = daysUntil < 0;
    let window: number | null = null;
    if (overdue) {
      window = 0;
    } else if ((OTA_REMIND_WINDOWS as readonly number[]).includes(daysUntil)) {
      window = daysUntil;
    }
    if (window == null) continue;

    // One remind per window (14/7/3/0); overdue can repeat once per day.
    if (!overdue && s.lastRemindDays === window) continue;
    if (overdue && s.lastRemindAt && s.lastRemindAt.slice(0, 10) === today) continue;

    out.push({ subscription: s, daysUntil, window, overdue });
  }

  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function listOtaDueForInbox(today = todayMinsk(), withinDays = 7): Subscription[] {
  return db
    .select()
    .from(subscriptions)
    .all()
    .filter((s) => {
      if (s.status !== 'active') return false;
      const daysUntil = daysBetween(today, s.nextPaymentAt);
      return daysUntil <= withinDays;
    })
    .sort((a, b) => a.nextPaymentAt.localeCompare(b.nextPaymentAt));
}

export async function runOtaRemindsToday(opts: {
  notify?: boolean;
  today?: string;
} = {}): Promise<{
  candidates: number;
  reminded: number;
  notified: number;
  ids: number[];
}> {
  const today = opts.today || todayMinsk();
  const notify = opts.notify !== false;
  const candidates = listOtaRemindCandidates(today);
  let reminded = 0;
  let notified = 0;
  const ids: number[] = [];

  for (const c of candidates) {
    const noteTag = c.overdue
      ? `due ${today}`
      : `remind −${c.window}d ${today}`;
    const prevNotes = c.subscription.notes || '';
    const notes = prevNotes.includes(noteTag) ? prevNotes : [prevNotes, noteTag].filter(Boolean).join(' · ');

    db.update(subscriptions)
      .set({
        lastRemindAt: today,
        lastRemindDays: c.window,
        notes,
      })
      .where(eq(subscriptions.id, c.subscription.id))
      .run();

    reminded += 1;
    ids.push(c.subscription.id);

    if (notify) {
      const when = c.overdue
        ? `платёж просрочен (${c.subscription.nextPaymentAt})`
        : c.window === 0
          ? `платёж сегодня (${c.subscription.nextPaymentAt})`
          : `платёж через ${c.window} дн. (${c.subscription.nextPaymentAt})`;
      await notifyClientStatus({
        phone: c.subscription.clientPhone,
        telegram: c.subscription.clientTelegram,
        message: `Мова: напоминание об OTA-страховке — ${when}.`,
      });
      notified += 1;
    }
  }

  return { candidates: candidates.length, reminded, notified, ids };
}
