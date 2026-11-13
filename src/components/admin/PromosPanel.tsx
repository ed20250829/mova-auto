import { useState } from 'react';
import type { PromoCode } from '../../db/schema';

function kindLabel(kind: string) {
  return kind === 'fixed' ? 'Фикс BYN' : 'Процент %';
}

function formatMinskDate(iso: string | null) {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export default function PromosPanel({ promos: initial }: { promos: PromoCode[] }) {
  const [promos, setPromos] = useState(initial);
  const [form, setForm] = useState({
    code: '',
    kind: 'percent',
    value: '10',
    firstOrderOnly: true,
    maxUses: '',
    validFrom: '',
    validTo: '',
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
        validFrom: form.validFrom || null,
        validTo: form.validTo || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Ошибка');
      return;
    }
    const list = await fetch('/api/admin/promos').then((r) => r.json());
    setPromos(list.promos || []);
    setForm({
      code: '',
      kind: 'percent',
      value: '10',
      firstOrderOnly: true,
      maxUses: '',
      validFrom: '',
      validTo: '',
      channelNote: '',
    });
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.65rem',
          background: '#14171a',
          padding: '0.9rem',
          borderRadius: 12,
          border: '1px solid #22262a',
          alignItems: 'end',
        }}
      >
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#8a8580' }}>Код</span>
          <input
            className="admin-input"
            placeholder="MOVA10"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            required
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#8a8580' }}>Тип скидки</span>
          <select
            className="admin-select"
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
          >
            <option value="percent">Процент %</option>
            <option value="fixed">Фикс BYN</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#8a8580' }}>
            {form.kind === 'fixed' ? 'Сумма, BYN' : 'Процент'}
          </span>
          <input
            className="admin-input"
            type="number"
            min={1}
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            required
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#8a8580' }}>Лимит использований</span>
          <input
            className="admin-input"
            type="number"
            min={1}
            placeholder="без лимита"
            value={form.maxUses}
            onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#8a8580' }}>Действует с (Минск)</span>
          <input
            className="admin-input"
            type="date"
            value={form.validFrom}
            onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#8a8580' }}>Действует по (Минск)</span>
          <input
            className="admin-input"
            type="date"
            value={form.validTo}
            onChange={(e) => setForm({ ...form, validTo: e.target.value })}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#8a8580' }}>Канал / заметка</span>
          <input
            className="admin-input"
            placeholder="визитка, UTM…"
            value={form.channelNote}
            onChange={(e) => setForm({ ...form, channelNote: e.target.value })}
          />
        </label>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            paddingBottom: '0.45rem',
          }}
        >
          <input
            type="checkbox"
            checked={form.firstOrderOnly}
            onChange={(e) => setForm({ ...form, firstOrderOnly: e.target.checked })}
          />
          Только первая запись
        </label>
        <button className="admin-btn" type="submit">
          Создать код
        </button>
      </form>
      <p style={{ margin: 0, color: '#8a8580', fontSize: '0.8rem' }}>
        Даты считаются по календарю Europe/Minsk. Пустые поля — без ограничения срока.
      </p>
      {error && <p style={{ color: '#ff5c5c', margin: 0 }}>{error}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Код</th>
              <th>Тип</th>
              <th>Значение</th>
              <th>Первая запись</th>
              <th>Использования</th>
              <th>С</th>
              <th>По</th>
              <th>Канал</th>
              <th>Активен</th>
            </tr>
          </thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p.id}>
                <td>
                  <code>{p.code}</code>
                </td>
                <td>{kindLabel(p.kind)}</td>
                <td>
                  {p.value}
                  {p.kind === 'percent' ? '%' : ' BYN'}
                </td>
                <td>{p.firstOrderOnly ? 'да' : 'нет'}</td>
                <td>
                  {p.usedCount}
                  {p.maxUses != null ? ` / ${p.maxUses}` : ''}
                </td>
                <td>{formatMinskDate(p.validFrom)}</td>
                <td>{formatMinskDate(p.validTo)}</td>
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
                <td colSpan={9} style={{ color: '#8a8580' }}>
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
