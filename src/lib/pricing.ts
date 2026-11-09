import { applyPromoDiscount, normalizePromoCode } from './promo-shared';

/** Shared optional add-on prices (BYN). Keep out of seed-data for client bundle. */
export const PRICING_OPTIONS = {
  otaInsurance: 150,
  onSiteVisit: 100,
  promoMova10Percent: 10,
} as const;

/** Minimal promo shape for pricing (avoid importing DB schema into client). */
export type PricingPromo = {
  code: string;
  kind: string;
  value: number;
};

export type BookingOptionsInput = {
  ota?: boolean;
  visit?: boolean;
  appPack?: boolean;
  /** When set with validated promo row — preferred path (server) */
  promo?: PricingPromo | null;
  /** Client-side preview after /api/promo/validate */
  promoPercent?: number | null;
  promoFixed?: number | null;
  promoCode?: string | null;
};

export function computeSubtotal(priceBase: number, opts: BookingOptionsInput) {
  let price = priceBase;
  const options: string[] = [];

  if (opts.ota) {
    price += PRICING_OPTIONS.otaInsurance;
    options.push('ota');
  }
  if (opts.visit) {
    price += PRICING_OPTIONS.onSiteVisit;
    options.push('visit');
  }
  if (opts.appPack) {
    options.push('app_pack');
  }

  return { subtotal: price, options };
}

export function computeOrderPrice(priceBase: number, opts: BookingOptionsInput) {
  const { subtotal, options } = computeSubtotal(priceBase, opts);
  let price = subtotal;
  const promoCode = normalizePromoCode(opts.promoCode || opts.promo?.code || '');

  if (opts.promo) {
    price = applyPromoDiscount(subtotal, opts.promo);
    options.push(opts.promo.code);
  } else if (opts.promoFixed != null && opts.promoFixed > 0) {
    price = Math.max(0, subtotal - opts.promoFixed);
    if (promoCode) options.push(promoCode);
  } else if (opts.promoPercent != null && opts.promoPercent > 0) {
    price = Math.round(subtotal * (1 - opts.promoPercent / 100));
    if (promoCode) options.push(promoCode);
  }

  return {
    price,
    subtotal,
    discount: Math.max(0, subtotal - price),
    options,
    promoCode: promoCode || null,
  };
}

export const CALC_OPTIONS_STORAGE_KEY = 'mova_calc_options';
