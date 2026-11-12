import { useMemo, useState } from 'react';

type Props = {
  value: string;
  min?: string;
  onChange: (iso: string) => void;
  error?: string;
};

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function toIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatRu(iso: string) {
  if (!iso) return 'Выберите дату';
  const d = parseIso(iso);
  return d.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function BookingCalendar({ value, min, onChange, error }: Props) {
  const minIso = min || toIso(new Date());
  const selected = value ? parseIso(value) : new Date();
  const [cursor, setCursor] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const [open, setOpen] = useState(true);

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    // Monday-first
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { iso: string; day: number; inMonth: boolean; disabled: boolean }[] = [];

    for (let i = 0; i < startPad; i++) {
      cells.push({ iso: '', day: 0, inMonth: false, disabled: true });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = toIso(new Date(year, month, day));
      cells.push({
        iso,
        day,
        inMonth: true,
        disabled: iso < minIso,
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ iso: '', day: 0, inMonth: false, disabled: true });
    }
    return cells;
  }, [cursor, minIso]);

  const title = cursor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  function shiftMonth(delta: number) {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <div className="booking-cal">
      <button
        type="button"
        className="booking-cal-trigger admin-input"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{formatRu(value)}</span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="booking-cal-panel" role="dialog" aria-label="Календарь">
          <div className="booking-cal-head">
            <button type="button" className="booking-cal-nav" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц">
              ‹
            </button>
            <div className="booking-cal-title">{title}</div>
            <button type="button" className="booking-cal-nav" onClick={() => shiftMonth(1)} aria-label="Следующий месяц">
              ›
            </button>
          </div>

          <div className="booking-cal-weekdays">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="booking-cal-grid">
            {days.map((cell, i) =>
              !cell.inMonth ? (
                <span key={`e-${i}`} className="booking-cal-day is-empty" />
              ) : (
                <button
                  key={cell.iso}
                  type="button"
                  className={[
                    'booking-cal-day',
                    cell.iso === value ? 'is-selected' : '',
                    cell.disabled ? 'is-disabled' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={cell.disabled}
                  onClick={() => {
                    onChange(cell.iso);
                    setOpen(false);
                  }}
                >
                  {cell.day}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {error && <span style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{error}</span>}
    </div>
  );
}
