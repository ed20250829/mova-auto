/** Shared optional add-on prices (BYN). Keep out of seed-data for client bundle. */
export const PRICING_OPTIONS = {
  otaInsurance: 150,
  onSiteVisit: 100,
  promoMova10Percent: 10,
} as const;

export type BookingOptionsInput = {
  ota?: boolean;
  visit?: boolean;
  appPack?: boolean;
  promoCode?: string | null;
};

export function computeOrderPrice(priceBase: number, opts: BookingOptionsInput) {
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
    // No invented price — flag only; amount clarified at booking/ops
    options.push('app_pack');
  }

  const promo = (opts.promoCode || '').trim().toUpperCase();
  if (promo === 'MOVA10') {
    price = Math.round(price * (1 - PRICING_OPTIONS.promoMova10Percent / 100));
    options.push('MOVA10');
  }

  return { price, options, promoCode: promo || null };
}

export const CALC_OPTIONS_STORAGE_KEY = 'mova_calc_options';
