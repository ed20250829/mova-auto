import { useMemo, useState } from 'react';
import type { Order } from '../../db/schema';

const STATUSES = [
  { value: 'new', label: 'Новый' },
  { value: 'confirmed', label: 'Подтверждён' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'done', label: 'Готов' },
  { value: 'cancelled', label: 'Отменён' },
];

function slotSortKey(slot: string | null) {
  if (!slot) return 9999;
  const [h, m] = slot.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export default function GarageToday({
  orders: initial,
  today,
}: {
  orders: Order[];
  today: string;
}) {
  const [orders, setOrders] = useState(initial);
  const [busyId, setBusyId] = useState<number | null>(null);

  const todayOrders = useMemo(() => {
    return orders
      .filter((o) => o.scheduledDate === today && o.status !== 'cancelled')
      .sort((a, b) => slotSortKey(a.scheduledSlot) - slotSortKey(b.scheduledSlot));
  }, [orders, today]);

  async function updateStatus(id: number, next: string) {
    setBusyId(id);
    const res = await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        status: next,
        notifyClient: next === 'confirmed' || next === 'done' || next === 'in_progress',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === id ? data.order : o)));
    }
    setBusyId(null);
  }

  const [, , d] = today.split('-');
  const titleDate = `${d}.${today.slice(5, 7)}.${today.slice(0, 4)}`;

  return (
    <section
      style={{
        background: '#14171a',
        border: '1px solid #22262a',
        borderRadius: 12,
        padding: '0.85rem 1rem',
        marginBottom: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          marginBottom: '0.65rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
          Сегодня в гараже · {titleDate}
        </h2>
        <a href="/admin/orders" style={{ color: '#8a8580', fontSize: '0.85rem' }}>
          Все заказы →
        </a>
      </div>

      {todayOrders.length === 0 ? (
        <p style={{ margin: 0, color: '#8a8580', fontSize: '0.9rem' }}>
          На сегодня записей нет. Добавить — в «Заказах» → ручная запись.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table" style={{ fontSize: '0.84rem' }}>
            <thead>
              <tr>
                <th>Слот</th>
                <th>Клиент</th>
                <th>Модель</th>
                <th>Цена</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {todayOrders.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {o.scheduledSlot || '—'}
                  </td>
                  <td>
                    <div>{o.clientName}</div>
                    <a href={`tel:${o.clientPhone}`} style={{ color: '#8a8580', fontSize: '0.8rem' }}>
                      {o.clientPhone}
                    </a>
                  </td>
                  <td>{o.modelLabel}</td>
                  <td>{o.price} BYN</td>
                  <td>
                    <select
                      className="admin-select"
                      style={{ minWidth: 120 }}
                      value={o.status}
                      disabled={busyId === o.id}
                      onChange={(e) => void updateStatus(o.id, e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
