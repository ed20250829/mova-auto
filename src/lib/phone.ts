/** Belarus mobile: +375 (29|33|44|25) + 7 digits; reject all-zero / all-same subscriber. */
const BY_MOBILE = /^375(29|33|44|25)(\d{7})$/;

export function isValidPhone(phone: string): boolean {
  const digits = String(phone || '').replace(/\D/g, '');
  const m = digits.match(BY_MOBILE);
  if (!m) return false;
  const subscriber = m[2];
  if (/^0+$/.test(subscriber)) return false;
  if (/^(\d)\1{6}$/.test(subscriber)) return false;
  return true;
}
