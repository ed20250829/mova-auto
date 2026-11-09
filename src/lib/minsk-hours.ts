/** Business hours for Мова callback promises: 08:00–22:00 Europe/Minsk, every day. */

export function getMinskParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Minsk',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return {
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    date: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

/** After-hours window: 22:00–08:00 Europe/Minsk */
export function isAfterHoursMinsk(date = new Date()) {
  const { hour } = getMinskParts(date);
  return hour >= 22 || hour < 8;
}

export function callbackSuccessCopy(afterHours: boolean) {
  if (afterHours) {
    return 'Приняли заявку. Перезвоним в рабочее время — с 08:00 до 22:00 (Минск).';
  }
  return 'Свяжемся в ближайшее время.';
}
