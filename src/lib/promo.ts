import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { orders, promoCodes, type PromoCode } from '../db/schema';
import { normalizePromoCode, phoneDigits, applyPromoDiscount } from './promo-shared';

export { normalizePromoCode, phoneDigits, applyPromoDiscount };

export type PromoValidationOk = {
  ok: true;
  promo: PromoCode;
  code: string;
  message: string;
};

export type PromoValidationErr = {
  ok: false;
  error: string;
  code?: string;
};

export type PromoValidation = PromoValidationOk | PromoValidationErr;

function todayIsoDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Minsk',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function hasPriorOrderForPhone(phone: string) {
  const digits = phoneDigits(phone);
  if (digits.length < 9) return false;
  const rows = db.select().from(orders).all();
  return rows.some((o) => {
    if (o.status === 'cancelled') return false;
    return phoneDigits(o.clientPhone) === digits;
  });
}

export function validatePromoCode(opts: {
  code: string | null | undefined;
  phone?: string | null;
  enforceFirstOrder?: boolean;
}): PromoValidation {
  const code = normalizePromoCode(opts.code);
  if (!code) {
    return { ok: false, error: 'Введите промокод', code };
  }

  const promo = db.select().from(promoCodes).where(eq(promoCodes.code, code)).get();
  if (!promo || !promo.active) {
    return { ok: false, error: 'Код не найден', code };
  }

  const today = todayIsoDate();
  if (promo.validFrom && today < promo.validFrom) {
    return { ok: false, error: 'Код ещё не действует', code };
  }
  if (promo.validTo && today > promo.validTo) {
    return { ok: false, error: 'Срок кода истёк', code };
  }
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    return { ok: false, error: 'Лимит использований исчерпан', code };
  }

  const enforce = opts.enforceFirstOrder !== false;
  if (enforce && promo.firstOrderOnly && opts.phone) {
    if (hasPriorOrderForPhone(opts.phone)) {
      return { ok: false, error: 'Этот код уже использован для первой записи', code };
    }
  }

  const message =
    promo.kind === 'percent'
      ? promo.firstOrderOnly
        ? `Скидка −${promo.value}% на первую запись`
        : `Скидка −${promo.value}%`
      : promo.firstOrderOnly
        ? `Скидка −${promo.value} BYN на первую запись`
        : `Скидка −${promo.value} BYN`;

  return { ok: true, promo, code, message };
}

export function applyPromoToAmount(amount: number, promo: PromoCode) {
  return applyPromoDiscount(amount, promo);
}

export function bumpPromoUsage(promoId: number) {
  db.update(promoCodes)
    .set({ usedCount: sql`${promoCodes.usedCount} + 1` })
    .where(eq(promoCodes.id, promoId))
    .run();
}

export function ensureDefaultPromoCodes() {
  const existing = db.select().from(promoCodes).where(eq(promoCodes.code, 'MOVA10')).get();
  if (existing) return;
  db.insert(promoCodes)
    .values({
      code: 'MOVA10',
      kind: 'percent',
      value: 10,
      firstOrderOnly: true,
      maxUses: null,
      usedCount: 0,
      validFrom: null,
      validTo: null,
      channelNote: 'Сайтовый first-booking',
      active: true,
    })
    .run();
}
