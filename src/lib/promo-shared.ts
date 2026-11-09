/** Pure promo helpers safe for client bundles (no DB / better-sqlite3). */

export function normalizePromoCode(raw: string | null | undefined) {
  return String(raw || '')
    .trim()
    .toUpperCase();
}

export function phoneDigits(phone: string | null | undefined) {
  return String(phone || '').replace(/\D/g, '');
}

export function applyPromoDiscount(
  amount: number,
  opts: { kind: 'percent' | 'fixed' | string; value: number },
) {
  if (opts.kind === 'fixed') {
    return Math.max(0, amount - opts.value);
  }
  return Math.round(amount * (1 - opts.value / 100));
}
