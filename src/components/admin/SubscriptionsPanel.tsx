import { useState } from 'react';
import type { Subscription } from '../../db/schema';

export default function SubscriptionsPanel({
  subscriptions: initial,
  mrr,
  churn,
}: {
  subscriptions: Subscription[];
  mrr: number;
  churn: number;
}) {
  const [rows, setRows] = useState(initial);

  async function remind(id: number) {
    await fetch('/api/admin/subscriptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, remind: true }),
    });
  }

  async function setStatus(id: number, status: string) {
    const res = await fetch('/api/admin/subscriptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  return (
    <div>
      <div className="admin-kpi" style={{ marginBottom: '1rem' }}>
        <article>
          <span>MRR (оценка)</span>
          <strong>{mrr} BYN</strong>
        </article>
        <article>
          <span>Подписок</span>
          <strong>{rows.length}</strong>
        </article>
        <article>
          <span>Churn</span>
          <strong>{churn}%</strong>
        </article>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Модель</th>
              <th>Старт</th>
              <th>След. платёж</th>
              <th>Цена/год</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.clientName}
                  <div style={{ color: '#8a8580' }}>{s.clientPhone}</div>
                </td>
                <td>{s.modelLabel || '—'}</td>
                <td>{s.startedAt}</td>
                <td>{s.nextPaymentAt}</td>
                <td>{s.price}</td>
                <td>
                  <select
                    className="admin-select"
                    value={s.status}
                    onChange={(e) => setStatus(s.id, e.target.value)}
                  >
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="churned">churned</option>
                  </select>
                </td>
                <td>
                  <button type="button" className="admin-btn ghost" onClick={() => remind(s.id)}>
                    Напомнить
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: '#8a8580' }}>
                  Подписок пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
