import { useState } from 'react';

type PartnerRow = {
  id: number;
  name: string;
  type: string;
  contactName: string | null;
  phone: string | null;
  telegram: string | null;
  wholesalePrice: number | null;
  commissionPercent: number | null;
  monthOrders: number;
  amountDue: number;
  active: boolean;
};

export default function PartnersPanel({ partners: initial }: { partners: PartnerRow[] }) {
  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState({
    name: '',
    type: 'importer',
    contactName: '',
    phone: '',
    telegram: '',
    wholesalePrice: '',
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        wholesalePrice: form.wholesalePrice ? Number(form.wholesalePrice) : null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setRows((prev) => [
        {
          id: data.id,
          name: form.name,
          type: form.type,
          contactName: form.contactName || null,
          phone: form.phone || null,
          telegram: form.telegram || null,
          wholesalePrice: form.wholesalePrice ? Number(form.wholesalePrice) : null,
          commissionPercent: 0,
          monthOrders: 0,
          amountDue: 0,
          active: true,
        },
        ...prev,
      ]);
      setForm({ name: '', type: 'importer', contactName: '', phone: '', telegram: '', wholesalePrice: '' });
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
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
        <input className="admin-input" placeholder="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <select className="admin-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="importer">Импортёр</option>
          <option value="salon">Салон</option>
          <option value="diagnostic">Диагност</option>
        </select>
        <input className="admin-input" placeholder="Контакт" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
        <input className="admin-input" placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="admin-input" placeholder="Telegram" value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value })} />
        <input className="admin-input" placeholder="Опт. цена" value={form.wholesalePrice} onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} />
        <button className="admin-btn" type="submit">
          Добавить
        </button>
      </form>

      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Партнёр</th>
              <th>Тип</th>
              <th>Контакт</th>
              <th>Опт</th>
              <th>Заказов мес.</th>
              <th>К оплате</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.type}</td>
                <td>
                  {p.contactName || '—'}
                  <div style={{ color: '#8a8580' }}>{p.phone || p.telegram || ''}</div>
                </td>
                <td>{p.wholesalePrice ?? '—'}</td>
                <td>{p.monthOrders}</td>
                <td>{p.amountDue} BYN</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
