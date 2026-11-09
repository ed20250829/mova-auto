import { useState } from 'react';
import type { PromoCode } from '../../db/schema';

export default function PromosPanel({ promos: initial }: { promos: PromoCode[] }) {
  const [promos, setPromos] = useState(initial);
  const [form, setForm] = useState({
    code: '',
    kind: 'percent',
    value: '10',
    firstOrderOnly: true,
    maxUses: '',
    channelNote: '',
  });
  const [error, setError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/promos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        value: Number(form.value),
        maxUses: form.maxUses || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Ошибка');
      return;
    }
    const list = await fetch('/api/admin/promos').then((r) => r.json());
    setPromos(list.promos || []);
    setForm({ code: '', kind: 'percent', value: '10', firstOrderOnly: true, maxUses: '', channelNote: '' });
  }

  async function toggleActive(id: number, active: boolean) {
    const res = await fetch('/api/admin/promos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active }),
    });
    if (res.ok) {
      const data = await res.json();
      setPromos((prev) => prev.map((p) => (p.id === id ? data.promo : p)));
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <form
        onSubmit={create}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.5rem',
          background: '#14171a',
          padding: '0.9rem',
          borderRadius: 12,
          border: '1px solid #22262a',
        }}
      >
        <input
          className="admin-input"
          placeholder="CODE"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          required
        />
        <select
          className="admin-select"
          value={form.kind}
          onChange={(e) => setForm({ ...form, kind: e.target.value })}
        >
          <option value="percent">percent %</option>
          <option value="fixed">fixed BYN</option>
        </select>
        <input
          className="admin-input"
          type="number"
          placeholder="value"
          value={form.value}
          onChange={(e) => setForm({ ...form, value: e.target.value })}
          required
        />
        <input
          className="admin-input"
          type="number"
          placeholder="max uses"
          value={form.maxUses}
          onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
        />
        <input
          className="admin-input"
          placeholder="канал / заметка"
          value={form.channelNote}
          onChange={(e) => setForm({ ...form, channelNote: e.target.value })}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <input
            type="checkbox"
            checked={form.firstOrderOnly}
            onChange={(e) => setForm({ ...form, firstOrderOnly: e.target.checked })}
          />
          first order
        </label>
        <button className="admin-btn" type="submit">
          Создать код
        </button>
      </form>
      {error && <p style={{ color: '#ff5c5c', margin: 0 }}>{error}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Код</th>
              <th>Тип</th>
              <th>Значение</th>
              <th>First</th>
              <th>Uses</th>
              <th>Канал</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p.id}>
                <td>
                  <code>{p.code}</code>
                </td>
                <td>{p.kind}</td>
                <td>
                  {p.value}
                  {p.kind === 'percent' ? '%' : ' BYN'}
                </td>
                <td>{p.firstOrderOnly ? 'да' : 'нет'}</td>
                <td>
                  {p.usedCount}
                  {p.maxUses != null ? ` / ${p.maxUses}` : ''}
                </td>
                <td>{p.channelNote || '—'}</td>
                <td>
                  <button
                    type="button"
                    className="admin-btn ghost"
                    onClick={() => toggleActive(p.id, !p.active)}
                  >
                    {p.active ? 'выкл' : 'вкл'}
                  </button>
                </td>
              </tr>
            ))}
            {promos.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: '#8a8580' }}>
                  Нет кодов
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
