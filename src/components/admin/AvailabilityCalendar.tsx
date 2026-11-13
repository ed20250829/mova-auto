import { useEffect, useMemo, useState } from 'react';
import { belarusHolidayMap, isWeekendIso } from '../../lib/by-holidays';

type ClosureInfo = { dayClosed: boolean; closedSlots: string[] };

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function monthMatrix(year: number, month: number): (string | null)[] {
  // month 0-based; cells Mon→Sun
  const first = new Date(Date.UTC(year, month, 1));
  let startDow = first.getUTCDay(); // 0 Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // Mon=0
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push(iso);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function AvailabilityCalendar({ templateSlots }: { templateSlots: string[] }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [closures, setClosures] = useState<Record<string, ClosureInfo>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const holidayMap = useMemo(
    () => belarusHolidayMap([cursor.y - 1, cursor.y, cursor.y + 1]),
    [cursor.y],
  );

  const from = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-01`;
  const to = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(
    new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate(),
  ).padStart(2, '0')}`;

  const cells = useMemo(() => monthMatrix(cursor.y, cursor.m), [cursor]);

  async function load() {
    const res = await fetch(
      `/api/admin/closures?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
    const data = await res.json();
    setClosures(data.closures || {});
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on month change
  }, [from, to]);

  const selectedInfo = selected
    ? closures[selected] || { dayClosed: false, closedSlots: [] }
    : null;
  const holidayName = selected ? holidayMap.get(selected) : undefined;

  async function act(action: string, slotTime?: string) {
    if (!selected) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/closures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, date: selected, slotTime }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || 'Ошибка');
      return;
    }
    setClosures((prev) => ({
      ...prev,
      [selected]: {
        dayClosed: Boolean(data.dayClosed),
        closedSlots: data.closedSlots || [],
      },
    }));
    // Clear empty entry
    if (!data.dayClosed && !(data.closedSlots || []).length) {
      setClosures((prev) => {
        const next = { ...prev };
        delete next[selected];
        return next;
      });
    }
  }

  const monthLabel = new Intl.DateTimeFormat('ru-BY', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(cursor.y, cursor.m, 1)));

  return (
    <section
      style={{
        background: '#14171a',
        border: '1px solid #22262a',
        borderRadius: 12,
        padding: '0.85rem',
        display: 'grid',
        gap: '0.85rem',
      }}
    >
      <div>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Календарь доступности</h2>
        <p style={{ margin: 0, color: '#8a8580', fontSize: '0.82rem' }}>
          Закройте день или отдельные слоты. Праздники РБ и выходные подсвечены — без авто-блокировки.
          Шаблон времён ниже; перекрытия даты побеждают.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="admin-btn ghost"
          onClick={() =>
            setCursor((c) => {
              const m = c.m - 1;
              return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m };
            })
          }
        >
          ←
        </button>
        <strong style={{ textTransform: 'capitalize', minWidth: '10rem' }}>{monthLabel}</strong>
        <button
          type="button"
          className="admin-btn ghost"
          onClick={() =>
            setCursor((c) => {
              const m = c.m + 1;
              return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m };
            })
          }
        >
          →
        </button>
        <button
          type="button"
          className="admin-btn ghost"
          onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}
        >
          Сегодня
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: '0.25rem',
        }}
      >
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            style={{
              textAlign: 'center',
              fontSize: '0.7rem',
              color: '#8a8580',
              padding: '0.2rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {d}
          </div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) {
            return <div key={`e-${i}`} />;
          }
          const info = closures[iso];
          const holiday = holidayMap.get(iso);
          const weekend = isWeekendIso(iso);
          const isSel = selected === iso;
          const tint = info?.dayClosed
            ? 'rgba(255,92,92,0.18)'
            : info?.closedSlots?.length
              ? 'rgba(255,152,0,0.14)'
              : holiday || weekend
                ? 'rgba(138,133,128,0.12)'
                : 'transparent';
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelected(iso)}
              style={{
                border: isSel ? '1px solid #ff5722' : '1px solid #22262a',
                borderRadius: 8,
                background: tint,
                color: '#e8e6e3',
                padding: '0.35rem 0.25rem',
                minHeight: 52,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'grid',
                gap: '0.1rem',
                font: 'inherit',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{Number(iso.slice(8))}</span>
              {holiday && (
                <span style={{ fontSize: '0.58rem', color: '#a8a29a', lineHeight: 1.15 }}>
                  {holiday}
                </span>
              )}
              {info?.dayClosed && (
                <span style={{ fontSize: '0.58rem', color: '#ff8a80' }}>закрыт</span>
              )}
              {!info?.dayClosed && info?.closedSlots?.length ? (
                <span style={{ fontSize: '0.58rem', color: '#ffb74d' }}>
                  −{info.closedSlots.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#8a8580' }}>
        <span>■ выходной / праздник РБ</span>
        <span style={{ color: '#ffb74d' }}>■ часть слотов закрыта</span>
        <span style={{ color: '#ff8a80' }}>■ день закрыт</span>
      </div>

      {selected && selectedInfo && (
        <div
          style={{
            borderTop: '1px solid #22262a',
            paddingTop: '0.75rem',
            display: 'grid',
            gap: '0.65rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div>
              <strong>
                {selected.slice(8)}.{selected.slice(5, 7)}.{selected.slice(0, 4)}
              </strong>
              {holidayName && (
                <span style={{ color: '#a8a29a', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                  · {holidayName} (не блокируется сам)
                </span>
              )}
              {isWeekendIso(selected) && !holidayName && (
                <span style={{ color: '#a8a29a', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                  · выходной
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {selectedInfo.dayClosed ? (
                <button
                  type="button"
                  className="admin-btn"
                  disabled={busy}
                  onClick={() => void act('open_day')}
                >
                  Открыть день
                </button>
              ) : (
                <button
                  type="button"
                  className="admin-btn"
                  disabled={busy}
                  onClick={() => void act('close_day')}
                >
                  Закрыть весь день
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
              gap: '0.4rem',
            }}
          >
            {templateSlots.map((t) => {
              const closed =
                selectedInfo.dayClosed || selectedInfo.closedSlots.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  className={`admin-btn ${closed ? '' : 'ghost'}`}
                  disabled={busy}
                  onClick={() => void act(closed ? 'open_slot' : 'close_slot', t)}
                  style={
                    closed
                      ? { background: '#3a2220', color: '#ffc1b8', border: '1px solid #5a3230' }
                      : undefined
                  }
                  title={closed ? 'Открыть слот' : 'Закрыть слот'}
                >
                  {t}
                  {closed ? ' ✕' : ''}
                </button>
              );
            })}
            {templateSlots.length === 0 && (
              <p style={{ margin: 0, color: '#8a8580', gridColumn: '1 / -1' }}>
                Нет активных шаблонных слотов — сначала добавьте времена ниже.
              </p>
            )}
          </div>
          {error && <p style={{ margin: 0, color: '#ff5c5c', fontSize: '0.85rem' }}>{error}</p>}
        </div>
      )}
    </section>
  );
}
