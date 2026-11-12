import { applyPromoDiscount, normalizePromoCode } from './promo-shared';

/** Shared optional add-on prices (BYN). Keep out of seed-data for client bundle. */
export const PRICING_OPTIONS = {
  otaInsurance: 150,
  onSiteVisit: 100,
  /** Yandex apps pack — mass Geely/BYD/Changan/Leapmotor… */
  appPackMass: 220,
  /** Yandex apps pack — Li / Zeekr / Avatr and similar complex stacks */
  appPackComplex: 450,
  promoMova10Percent: 10,
} as const;

/** Brands where apps install is the complex tier (Li/Zeekr/Avatr). */
const COMPLEX_APP_BRANDS = new Set(['li auto', 'zeekr', 'avatr']);

export function getAppPackPrice(brand: string): number {
  return COMPLEX_APP_BRANDS.has(brand.trim().toLowerCase())
    ? PRICING_OPTIONS.appPackComplex
    : PRICING_OPTIONS.appPackMass;
}

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
  /** Brand for app-pack tier (mass 220 / complex 450). */
  brand?: string | null;
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
    price += getAppPackPrice(opts.brand || '');
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
