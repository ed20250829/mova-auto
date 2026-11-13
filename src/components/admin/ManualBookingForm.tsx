import { useEffect, useMemo, useState } from 'react';

type ModelOpt = { id: number; brand: string; model: string; priceBase: number; active: boolean };
type PartnerOpt = { id: number; name: string; active: boolean };

export default function ManualBookingForm({
  models,
  partners,
  onCreated,
}: {
  models: ModelOpt[];
  partners: PartnerOpt[];
  onCreated?: (order: unknown) => void;
}) {
  const activeModels = useMemo(() => models.filter((m) => m.active !== false), [models]);
  const activePartners = useMemo(() => partners.filter((p) => p.active), [partners]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    clientName: '',
    clientPhone: '',
    clientTelegram: '',
    modelId: '',
    scheduledDate: '',
    scheduledSlot: '',
    price: '',
    partnerId: '',
    comment: '',
    leadId: '',
  });
  const [slots, setSlots] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    if (p.get('book') !== '1') return;
    setOpen(true);
    setForm((prev) => ({
      ...prev,
      clientName: p.get('name') || prev.clientName,
      clientPhone: p.get('phone') || prev.clientPhone,
      clientTelegram: p.get('telegram') || prev.clientTelegram,
      comment: p.get('model') ? `Лид: ${p.get('model')}` : prev.comment,
      leadId: p.get('leadId') || prev.leadId,
      scheduledDate: p.get('date') || prev.scheduledDate,
    }));
  }, []);

  useEffect(() => {
    if (!form.scheduledDate) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/slots?date=${encodeURIComponent(form.scheduledDate)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data.slots) ? data.slots : Array.isArray(data.free) ? data.free : [];
        setSlots(list.map(String));
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.scheduledDate]);

  useEffect(() => {
    if (!form.modelId) return;
    const m = activeModels.find((x) => String(x.id) === form.modelId);
    if (m && !form.price) {
      setForm((prev) => ({ ...prev, price: String(m.priceBase) }));
    }
  }, [form.modelId, activeModels, form.price]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    const res = await fetch('/api/admin/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: form.clientName,
        clientPhone: form.clientPhone,
        clientTelegram: form.clientTelegram || null,
        modelId: Number(form.modelId),
        scheduledDate: form.scheduledDate,
        scheduledSlot: form.scheduledSlot,
        price: form.price ? Number(form.price) : null,
        partnerId: form.partnerId ? Number(form.partnerId) : null,
        comment: form.comment || null,
        leadId: form.leadId ? Number(form.leadId) : null,
        status: 'confirmed',
        source: 'admin',
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || 'Не удалось создать запись');
      return;
    }
    setOk(`Запись #${data.order?.id} создана`);
    onCreated?.(data.order);
    setForm({
      clientName: '',
      clientPhone: '',
      clientTelegram: '',
      modelId: '',
      scheduledDate: '',
      scheduledSlot: '',
      price: '',
      partnerId: '',
      comment: '',
      leadId: '',
    });
    if (typeof window !== 'undefined' && window.location.search.includes('book=')) {
      window.history.replaceState({}, '', '/admin/orders');
    }
  }

  if (!open) {
    return (
      <div style={{ marginBottom: '0.85rem' }}>
        <button type="button" className="admin-btn" onClick={() => setOpen(true)}>
          + Ручная запись
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '0.55rem',
        background: '#14171a',
        border: '1px solid #22262a',
        borderRadius: 12,
        padding: '0.85rem',
        marginBottom: '1rem',
        alignItems: 'end',
      }}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
        <strong style={{ fontSize: '0.95rem' }}>Ручная запись</strong>
        <button type="button" className="admin-btn ghost" onClick={() => setOpen(false)}>
          Скрыть
        </button>
      </div>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.72rem', color: '#8a8580' }}>Имя</span>
        <input
          className="admin-input"
          required
          value={form.clientName}
          onChange={(e) => setForm({ ...form, clientName: e.target.value })}
        />
      </label>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.72rem', color: '#8a8580' }}>Телефон</span>
        <input
          className="admin-input"
          required
          value={form.clientPhone}
          onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
          placeholder="+375…"
        />
      </label>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.72rem', color: '#8a8580' }}>Telegram</span>
        <input
          className="admin-input"
          value={form.clientTelegram}
          onChange={(e) => setForm({ ...form, clientTelegram: e.target.value })}
        />
      </label>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.72rem', color: '#8a8580' }}>Модель</span>
        <select
          className="admin-select"
          required
          value={form.modelId}
          onChange={(e) => {
            const m = activeModels.find((x) => String(x.id) === e.target.value);
            setForm({
              ...form,
              modelId: e.target.value,
              price: m ? String(m.priceBase) : form.price,
            });
          }}
        >
          <option value="">Выберите</option>
          {activeModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.brand} {m.model} · {m.priceBase}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.72rem', color: '#8a8580' }}>Дата</span>
        <input
          className="admin-input"
          type="date"
          required
          value={form.scheduledDate}
          onChange={(e) => setForm({ ...form, scheduledDate: e.target.value, scheduledSlot: '' })}
        />
      </label>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.72rem', color: '#8a8580' }}>Слот</span>
        <select
          className="admin-select"
          required
          value={form.scheduledSlot}
          onChange={(e) => setForm({ ...form, scheduledSlot: e.target.value })}
          disabled={!form.scheduledDate}
        >
          <option value="">{form.scheduledDate ? 'Свободные…' : 'Сначала дата'}</option>
          {slots.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.72rem', color: '#8a8580' }}>Цена, BYN</span>
        <input
          className="admin-input"
          type="number"
          min={0}
          required
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
        />
      </label>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.72rem', color: '#8a8580' }}>Партнёр</span>
        <select
          className="admin-select"
          value={form.partnerId}
          onChange={(e) => setForm({ ...form, partnerId: e.target.value })}
        >
          <option value="">Нет</option>
          {activePartners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: '0.2rem', gridColumn: 'span 2' }}>
        <span style={{ fontSize: '0.72rem', color: '#8a8580' }}>Комментарий</span>
        <input
          className="admin-input"
          value={form.comment}
          onChange={(e) => setForm({ ...form, comment: e.target.value })}
        />
      </label>
      <button className="admin-btn" type="submit" disabled={busy}>
        {busy ? 'Сохраняю…' : 'Создать запись'}
      </button>
      {error && (
        <p style={{ margin: 0, color: '#ff5c5c', gridColumn: '1 / -1', fontSize: '0.85rem' }}>{error}</p>
      )}
      {ok && (
        <p style={{ margin: 0, color: '#3dd68c', gridColumn: '1 / -1', fontSize: '0.85rem' }}>{ok}</p>
      )}
    </form>
  );
}
