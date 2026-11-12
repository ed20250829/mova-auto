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
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function runTodayReminds() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_today_reminds', notify: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Ошибка');
      } else {
        setMsg(`На сегодня: отмечено ${data.reminded}, уведомлений ${data.notified}.`);
        // Refresh lastRemind markers locally for reminded ids
        if (Array.isArray(data.ids) && data.ids.length) {
          const today = new Date().toISOString().slice(0, 10);
          setRows((prev) =>
            prev.map((r) =>
              data.ids.includes(r.id) ? { ...r, lastRemindAt: today } : r,
            ),
          );
        }
      }
    } catch {
      setMsg('Не удалось создать напоминания');
    } finally {
      setBusy(false);
    }
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

      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '0.85rem',
        }}
      >
        <button type="button" className="admin-btn" disabled={busy} onClick={runTodayReminds}>
          {busy ? 'Создаём…' : 'Создать напоминания на сегодня'}
        </button>
        <span style={{ color: '#8a8580', fontSize: '0.85rem' }}>
          Окна −14 / −7 / −3 / 0 дней и просроченные
        </span>
      </div>
      {msg && <p style={{ color: '#c8c3bc', fontSize: '0.85rem', marginTop: 0 }}>{msg}</p>}

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
              <th>Remind</th>
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
                <td style={{ color: '#8a8580', fontSize: '0.82rem' }}>
                  {s.lastRemindAt || '—'}
                  {s.lastRemindDays != null ? ` (−${s.lastRemindDays}д)` : ''}
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
                <td colSpan={8} style={{ color: '#8a8580' }}>
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
