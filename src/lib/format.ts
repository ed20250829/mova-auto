export function formatByn(amount: number): string {
  return `${new Intl.NumberFormat('ru-BY').format(amount)} BYN`;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export function complexityLabel(c: string): string {
  switch (c) {
    case 'easy':
      return 'Простая';
    case 'medium':
      return 'Средняя';
    case 'hard':
      return 'Сложная';
    default:
      return c;
  }
}

export function statusLabel(s: string): string {
  switch (s) {
    case 'new':
      return 'Новый';
    case 'in_progress':
      return 'В работе';
    case 'done':
      return 'Готов';
    case 'cancelled':
      return 'Отменён';
    default:
      return s;
  }
}

export function parseIssues(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function csvEscape(value: unknown): string {
  const s = String(value ?? '');
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
