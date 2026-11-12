import { useMemo, useState } from 'react';
import type { Order } from '../../db/schema';

const STATUSES = [
  { value: 'new', label: 'Новый' },
  { value: 'confirmed', label: 'Подтверждён' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'done', label: 'Готов' },
  { value: 'cancelled', label: 'Отменён' },
];

const PAY_METHODS = [
  { value: 'cash', label: 'Наличные' },
  { value: 'transfer', label: 'Перевод' },
  { value: 'erip', label: 'ЕРИП' },
  { value: 'epos', label: 'E-POS' },
  { value: 'card', label: 'Карта' },
  { value: 'krok', label: 'КРОК' },
  { value: 'link', label: 'Ссылка' },
  { value: 'other', label: 'Другое' },
];

export default function OrdersTable({ orders: initial }: { orders: Order[] }) {
  const [orders, setOrders] = useState(initial);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (status && o.status !== status) return false;
      if (q) {
        const s = q.toLowerCase();
        if (
          !o.clientName.toLowerCase().includes(s) &&
          !o.clientPhone.includes(s) &&
          !o.modelLabel.toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [orders, status, q]);

  async function updateStatus(id: number, next: string) {
    setBusyId(id);
    const res = await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        status: next,
        notifyClient: next === 'confirmed' || next === 'done' || next === 'in_progress' || next === 'cancelled',
      }),
    });
    if (res.ok) {
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: next } : o)));
    }
    setBusyId(null);
  }

  async function markPaid(id: number, method: string) {
    setBusyId(id);
    const res = await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, markPaid: true, paymentMethod: method }),
    });
    if (res.ok) {
      const data = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === id ? data.order : o)));
    }
    setBusyId(null);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
        <input
          className="admin-input"
          style={{ maxWidth: 240 }}
          placeholder="Поиск: имя, телефон, модель"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="admin-select" style={{ maxWidth: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Все статусы</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <a className="admin-btn ghost" href="/api/admin/orders?format=csv">
          Экспорт CSV
        </a>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Дата</th>
              <th>Клиент</th>
              <th>Модель</th>
              <th>Цена</th>
              <th>Себест.</th>
              <th>Маржа</th>
              <th>Статус</th>
              <th>Оплата</th>
              <th>Источник</th>
              <th>Слот</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.createdAt.slice(0, 16).replace('T', ' ')}</td>
                <td>
                  <div>{o.clientName}</div>
                  <div style={{ color: '#8a8580' }}>{o.clientPhone}</div>
                  {o.promoCode && (
                    <div style={{ color: '#8a8580', fontSize: '0.75rem' }}>promo {o.promoCode}</div>
                  )}
                </td>
                <td>{o.modelLabel}</td>
                <td>{o.price}</td>
                <td>{o.cost}</td>
                <td>{o.price - o.cost}</td>
                <td>
                  <select
                    className="admin-select"
                    style={{ minWidth: 120 }}
                    value={o.status}
                    disabled={busyId === o.id}
                    onChange={(e) => updateStatus(o.id, e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {o.paymentStatus === 'paid' ? (
                    <div>
                      <div style={{ color: '#3dd68c' }}>оплачено</div>
                      <div style={{ color: '#8a8580', fontSize: '0.75rem' }}>
                        {(o.paidAt || '').slice(0, 10)} · {o.paymentMethod || '—'}
                      </div>
                    </div>
                  ) : (
                    <select
                      className="admin-select"
                      style={{ minWidth: 130 }}
                      defaultValue=""
                      disabled={busyId === o.id}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) void markPaid(o.id, v);
                        e.target.value = '';
                      }}
                    >
                      <option value="">Отметить…</option>
                      {PAY_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td>{o.utmSource || o.source || '—'}</td>
                <td>
                  {o.scheduledDate || '—'} {o.scheduledSlot || ''}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} style={{ color: '#8a8580' }}>
                  Нет заказов
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
