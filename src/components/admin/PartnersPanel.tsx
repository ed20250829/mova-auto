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

const TYPE_LABELS: Record<string, string> = {
  importer: 'Импортёр',
  salon: 'Салон',
  diagnostic: 'Диагност',
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
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState({
    name: '',
    type: 'importer',
    contactName: '',
    phone: '',
    telegram: '',
    wholesalePrice: '',
    active: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
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
    } else {
      setError('Не удалось добавить партнёра');
    }
  }

  function startEdit(p: PartnerRow) {
    setEditId(p.id);
    setDraft({
      name: p.name,
      type: p.type,
      contactName: p.contactName || '',
      phone: p.phone || '',
      telegram: p.telegram || '',
      wholesalePrice: p.wholesalePrice != null ? String(p.wholesalePrice) : '',
      active: p.active,
    });
    setError('');
  }

  async function saveEdit() {
    if (!editId) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/partners', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editId,
        name: draft.name,
        type: draft.type,
        contactName: draft.contactName || null,
        phone: draft.phone || null,
        telegram: draft.telegram || null,
        wholesalePrice: draft.wholesalePrice ? Number(draft.wholesalePrice) : null,
        active: draft.active,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError('Не удалось сохранить');
      return;
    }
    setRows((prev) =>
      prev.map((p) =>
        p.id === editId
          ? {
              ...p,
              name: draft.name,
              type: draft.type,
              contactName: draft.contactName || null,
              phone: draft.phone || null,
              telegram: draft.telegram || null,
              wholesalePrice: draft.wholesalePrice ? Number(draft.wholesalePrice) : null,
              active: draft.active,
            }
          : p,
      ),
    );
    setEditId(null);
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
          padding: '0.85rem',
          borderRadius: 12,
          border: '1px solid #22262a',
        }}
      >
        <input
          className="admin-input"
          placeholder="Название"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <select
          className="admin-select"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          <option value="importer">Импортёр</option>
          <option value="salon">Салон</option>
          <option value="diagnostic">Диагност</option>
        </select>
        <input
          className="admin-input"
          placeholder="Контакт"
          value={form.contactName}
          onChange={(e) => setForm({ ...form, contactName: e.target.value })}
        />
        <input
          className="admin-input"
          placeholder="Телефон"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          className="admin-input"
          placeholder="Telegram"
          value={form.telegram}
          onChange={(e) => setForm({ ...form, telegram: e.target.value })}
        />
        <input
          className="admin-input"
          placeholder="Опт. цена"
          value={form.wholesalePrice}
          onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })}
        />
        <button className="admin-btn" type="submit">
          Добавить
        </button>
      </form>
      {error && <p style={{ color: '#ff5c5c', margin: 0 }}>{error}</p>}

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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: '#8a8580' }}>
                  Партнёров пока нет
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const editing = editId === p.id;
              return (
                <tr key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
                  <td>
                    {editing ? (
                      <input
                        className="admin-input"
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      />
                    ) : (
                      <>
                        {p.name}
                        {!p.active && (
                          <div style={{ color: '#8a8580', fontSize: '0.75rem' }}>выкл</div>
                        )}
                      </>
                    )}
                  </td>
                  <td>
                    {editing ? (
                      <select
                        className="admin-select"
                        value={draft.type}
                        onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                      >
                        <option value="importer">Импортёр</option>
                        <option value="salon">Салон</option>
                        <option value="diagnostic">Диагност</option>
                      </select>
                    ) : (
                      TYPE_LABELS[p.type] || p.type
                    )}
                  </td>
                  <td>
                    {editing ? (
                      <div style={{ display: 'grid', gap: '0.3rem' }}>
                        <input
                          className="admin-input"
                          placeholder="Контакт"
                          value={draft.contactName}
                          onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
                        />
                        <input
                          className="admin-input"
                          placeholder="Телефон"
                          value={draft.phone}
                          onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                        />
                        <input
                          className="admin-input"
                          placeholder="Telegram"
                          value={draft.telegram}
                          onChange={(e) => setDraft({ ...draft, telegram: e.target.value })}
                        />
                      </div>
                    ) : (
                      <>
                        {p.contactName || '—'}
                        <div style={{ color: '#8a8580' }}>{p.phone || p.telegram || ''}</div>
                      </>
                    )}
                  </td>
                  <td>
                    {editing ? (
                      <input
                        className="admin-input"
                        value={draft.wholesalePrice}
                        onChange={(e) => setDraft({ ...draft, wholesalePrice: e.target.value })}
                      />
                    ) : (
                      p.wholesalePrice ?? '—'
                    )}
                  </td>
                  <td>{p.monthOrders}</td>
                  <td>{p.amountDue} BYN</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {editing ? (
                      <>
                        <label
                          style={{
                            display: 'inline-flex',
                            gap: '0.3rem',
                            alignItems: 'center',
                            marginRight: '0.45rem',
                            fontSize: '0.8rem',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={draft.active}
                            onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                          />
                          Активен
                        </label>
                        <button
                          type="button"
                          className="admin-btn"
                          disabled={busy}
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
                      <button type="button" className="admin-btn ghost" onClick={() => startEdit(p)}>
                        Править
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
