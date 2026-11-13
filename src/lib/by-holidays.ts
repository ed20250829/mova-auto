/**
 * Belarus (РБ) public holidays — awareness only for admin calendar.
 * Do NOT auto-block booking; garage may work weekends/holidays.
 */

type Holiday = { date: string; name: string };

/** Orthodox Easter Sundays (Gregorian) for nearby years — for Radonitsa. */
const ORTHODOX_EASTER: Record<number, string> = {
  2025: '2025-04-20',
  2026: '2026-04-12',
  2027: '2027-05-02',
  2028: '2028-04-16',
  2029: '2029-04-08',
  2030: '2030-04-28',
};

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function fixedForYear(year: number): Holiday[] {
  return [
    { date: `${year}-01-01`, name: 'Новый год' },
    { date: `${year}-01-02`, name: 'Новый год' },
    { date: `${year}-01-07`, name: 'Рождество (правосл.)' },
    { date: `${year}-03-08`, name: '8 Марта' },
    { date: `${year}-05-01`, name: 'День труда' },
    { date: `${year}-05-09`, name: 'День Победы' },
    { date: `${year}-07-03`, name: 'День Независимости' },
    { date: `${year}-11-07`, name: 'День Октябрьской революции' },
    { date: `${year}-12-25`, name: 'Рождество (католич.)' },
  ];
}

export function belarusHolidaysForYear(year: number): Holiday[] {
  const list = [...fixedForYear(year)];
  const easter = ORTHODOX_EASTER[year];
  if (easter) {
    // Radonitsa = Tuesday, 9 days after Orthodox Easter
    list.push({ date: addDays(easter, 9), name: 'Радуница' });
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export function belarusHolidayMap(years: number[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const y of years) {
    for (const h of belarusHolidaysForYear(y)) {
      map.set(h.date, h.name);
    }
  }
  return map;
}

export function isWeekendIso(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}
