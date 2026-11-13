import { useEffect, useMemo, useState } from 'react';
import type { Order } from '../../db/schema';
import ManualBookingForm from './ManualBookingForm';

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

type ModelOpt = { id: number; brand: string; model: string; priceBase: number; active: boolean };
type PartnerOpt = { id: number; name: string; active: boolean };

export default function OrdersTable({
  orders: initial,
  models,
  partners,
}: {
  orders: Order[];
  models: ModelOpt[];
  partners: PartnerOpt[];
}) {
  const [orders, setOrders] = useState(initial);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editSlot, setEditSlot] = useState('');
  const [editPartner, setEditPartner] = useState('');
  const [freeSlots, setFreeSlots] = useState<string[]>([]);
  const [editError, setEditError] = useState('');

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

  useEffect(() => {
    if (!editId || !editDate) {
      setFreeSlots([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/slots?date=${encodeURIComponent(editDate)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list: string[] = Array.isArray(data.slots) ? data.slots.map(String) : [];
        const current = orders.find((o) => o.id === editId);
        if (
          current?.scheduledSlot &&
          current.scheduledDate === editDate &&
          !list.includes(current.scheduledSlot)
        ) {
          list.push(current.scheduledSlot);
          list.sort();
        }
        setFreeSlots(list);
      })
      .catch(() => {
        if (!cancelled) setFreeSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [editId, editDate, orders]);

  async function updateStatus(id: number, next: string) {
    setBusyId(id);
    const res = await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        status: next,
        notifyClient:
          next === 'confirmed' || next === 'done' || next === 'in_progress' || next === 'cancelled',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === id ? data.order : o)));
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

  function startEdit(o: Order) {
    setEditId(o.id);
    setEditDate(o.scheduledDate || '');
    setEditSlot(o.scheduledSlot || '');
    setEditPartner(o.partnerId != null ? String(o.partnerId) : '');
    setEditError('');
  }

  async function saveEdit() {
    if (!editId) return;
    setBusyId(editId);
    setEditError('');
    const res = await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editId,
        scheduledDate: editDate || null,
        scheduledSlot: editSlot || null,
        partnerId: editPartner ? Number(editPartner) : null,
        notifyClient: false,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setEditError(data.error || 'Не удалось сохранить');
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === editId ? data.order : o)));
    setEditId(null);
  }

  return (
    <div>
      <ManualBookingForm
        models={models}
        partners={partners}
        onCreated={(order) => {
          if (order && typeof order === 'object' && 'id' in order) {
            setOrders((prev) => [order as Order, ...prev]);
          }
        }}
      />

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <input
          className="admin-input"
          style={{ maxWidth: 240 }}
          placeholder="Поиск: имя, телефон, модель"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="admin-select"
          style={{ maxWidth: 180 }}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
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
              <th>Клиент</th>
              <th>Модель</th>
              <th>Цена</th>
              <th>Маржа</th>
              <th>Статус</th>
              <th>Оплата</th>
              <th>Партнёр / слот</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => {
              const partnerName = partners.find((p) => p.id === o.partnerId)?.name;
              const editing = editId === o.id;
              return (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>
                    <div>{o.clientName}</div>
                    <div style={{ color: '#8a8580' }}>{o.clientPhone}</div>
                    {o.promoCode && (
                      <div style={{ color: '#8a8580', fontSize: '0.75rem' }}>промо {o.promoCode}</div>
                    )}
                  </td>
                  <td>{o.modelLabel}</td>
                  <td>{o.price}</td>
                  <td>{o.price - o.cost}</td>
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
                        style={{ minWidth: 120 }}
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
                  <td style={{ minWidth: 160 }}>
                    {editing ? (
                      <div style={{ display: 'grid', gap: '0.35rem' }}>
                        <input
                          className="admin-input"
                          type="date"
                          value={editDate}
                          onChange={(e) => {
                            setEditDate(e.target.value);
                            setEditSlot('');
                          }}
                        />
                        <select
                          className="admin-select"
                          value={editSlot}
                          onChange={(e) => setEditSlot(e.target.value)}
                        >
                          <option value="">Слот…</option>
                          {freeSlots.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <select
                          className="admin-select"
                          value={editPartner}
                          onChange={(e) => setEditPartner(e.target.value)}
                        >
                          <option value="">Без партнёра</option>
                          {partners
                            .filter((p) => p.active || p.id === o.partnerId)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                        {editError && (
                          <span style={{ color: '#ff5c5c', fontSize: '0.75rem' }}>{editError}</span>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          {o.scheduledDate || '—'} {o.scheduledSlot || ''}
                        </div>
                        <div style={{ color: '#8a8580', fontSize: '0.75rem' }}>
                          {partnerName || 'без партнёра'}
                        </div>
                      </>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {editing ? (
                      <>
                        <button
                          type="button"
                          className="admin-btn"
                          disabled={busyId === o.id}
                          onClick={() => void saveEdit()}
                        >
                          OK
                        </button>{' '}
                        <button
                          type="button"
                          className="admin-btn ghost"
                          onClick={() => setEditId(null)}
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <button type="button" className="admin-btn ghost" onClick={() => startEdit(o)}>
                        Перенос
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ color: '#8a8580' }}>
                  Нет заказов по фильтру. Создайте ручную запись выше.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
