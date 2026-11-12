import { useState } from 'react';
import type { BookingSlot } from '../../db/schema';

export default function SlotsPanel({ slots: initial }: { slots: BookingSlot[] }) {
  const [slots, setSlots] = useState(initial);
  const [time, setTime] = useState('11:00');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  async function refresh() {
    const data = await fetch('/api/admin/slots').then((r) => r.json());
    setSlots(data.slots || []);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Ошибка');
      return;
    }
    await refresh();
    setTime('11:00');
  }

  async function toggle(id: number, active: boolean) {
    setBusyId(id);
    await fetch('/api/admin/slots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active }),
    });
    await refresh();
    setBusyId(null);
  }

  async function remove(id: number) {
    if (!confirm('Удалить слот?')) return;
    setBusyId(id);
    await fetch('/api/admin/slots', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await refresh();
    setBusyId(null);
  }

  async function move(id: number, dir: -1 | 1) {
    const idx = slots.findIndex((s) => s.id === id);
    const swap = slots[idx + dir];
    if (!swap || idx < 0) return;
    setBusyId(id);
    await Promise.all([
      fetch('/api/admin/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, sortOrder: swap.sortOrder }),
      }),
      fetch('/api/admin/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: swap.id, sortOrder: slots[idx].sortOrder }),
      }),
    ]);
    await refresh();
    setBusyId(null);
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <p style={{ color: '#8a8580', margin: 0 }}>
        Эти слоты показываются в форме записи на сайте и в Telegram-боте. Выключенный слот клиентам не виден.
      </p>

      <form
        onSubmit={create}
        style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          background: '#14171a',
          padding: '0.9rem',
          borderRadius: 12,
          border: '1px solid #22262a',
          alignItems: 'center',
        }}
      >
        <input
          className="admin-input"
          style={{ maxWidth: 140 }}
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
        />
        <button className="admin-btn" type="submit">
          Добавить слот
        </button>
      </form>
      {error && <p style={{ color: '#ff5c5c', margin: 0 }}>{error}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Время</th>
              <th>Статус</th>
              <th>Порядок</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s, i) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 700, fontSize: '1.05rem' }}>{s.time}</td>
                <td>
                  <button
                    className="admin-btn ghost"
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => toggle(s.id, !s.active)}
                  >
                    {s.active ? 'Включён' : 'Выключен'}
                  </button>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      className="admin-btn ghost"
                      type="button"
                      disabled={i === 0 || busyId === s.id}
                      onClick={() => move(s.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      className="admin-btn ghost"
                      type="button"
                      disabled={i === slots.length - 1 || busyId === s.id}
                      onClick={() => move(s.id, 1)}
                    >
                      ↓
                    </button>
                  </div>
                </td>
                <td>
                  <button
                    className="admin-btn ghost"
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => remove(s.id)}
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
