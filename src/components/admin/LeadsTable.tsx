import { useMemo, useState } from 'react';
import type { Lead } from '../../db/schema';
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from '../../lib/leads';

function leadStatus(lead: Lead): LeadStatus {
  if (lead.status && (LEAD_STATUSES as readonly string[]).includes(lead.status)) {
    return lead.status as LeadStatus;
  }
  return lead.contacted ? 'contacted' : 'new';
}

const STEP_LABELS: Record<string, string> = {
  calc: 'Калькулятор',
  form: 'Форма',
  contact: 'Контакт',
  callback: 'Обратный звонок',
  partner: 'Партнёр',
  manual: 'Вручную',
};

export default function LeadsTable({ leads: initial }: { leads: Lead[] }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<'all' | LeadStatus>('all');
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  const visible = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((l) => leadStatus(l) === filter);
  }, [rows, filter]);

  async function setStatus(id: number, status: LeadStatus) {
    setBusyId(id);
    const res = await fetch('/api/admin/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    setBusyId(null);
    if (res.ok) {
      setRows((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, status, contacted: status !== 'new' } : l,
        ),
      );
    }
  }

  async function saveNotes(id: number) {
    const notes = notesDraft[id] ?? rows.find((l) => l.id === id)?.notes ?? '';
    setBusyId(id);
    const res = await fetch('/api/admin/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, notes }),
    });
    setBusyId(null);
    if (res.ok) {
      const data = await res.json();
      setRows((prev) => prev.map((l) => (l.id === id ? data.lead : l)));
      setNotesDraft((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  function bookUrl(l: Lead) {
    const p = new URLSearchParams({ book: '1', leadId: String(l.id) });
    if (l.name) p.set('name', l.name);
    if (l.phone) p.set('phone', l.phone);
    if (l.telegram) p.set('telegram', l.telegram);
    if (l.modelLabel) p.set('model', l.modelLabel);
    return `/admin/orders?${p.toString()}`;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <button
          type="button"
          className={`admin-btn ${filter === 'all' ? '' : 'ghost'}`}
          onClick={() => setFilter('all')}
        >
          Все · {rows.length}
        </button>
        {LEAD_STATUSES.map((s) => {
          const n = rows.filter((l) => leadStatus(l) === s).length;
          return (
            <button
              key={s}
              type="button"
              className={`admin-btn ${filter === s ? '' : 'ghost'}`}
              onClick={() => setFilter(s)}
            >
              {LEAD_STATUS_LABELS[s]} · {n}
            </button>
          );
        })}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Когда</th>
              <th>Контакт</th>
              <th>Модель</th>
              <th>Шаг</th>
              <th>Статус</th>
              <th>Заметка</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((l) => {
              const status = leadStatus(l);
              const noteValue = notesDraft[l.id] ?? l.notes ?? '';
              const noteDirty = notesDraft[l.id] !== undefined && notesDraft[l.id] !== (l.notes || '');
              return (
                <tr key={l.id}>
                  <td>{l.id}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {l.createdAt.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td>
                    <div>{l.name || '—'}</div>
                    <div style={{ color: '#8a8580' }}>{l.phone || l.telegram || '—'}</div>
                  </td>
                  <td>
                    {l.dropStep === 'partner' ? (
                      <>
                        <div>{l.modelLabel || '—'}</div>
                        <div style={{ color: '#8a8580', fontSize: '0.78rem' }}>автосалон</div>
                      </>
                    ) : (
                      l.modelLabel || '—'
                    )}
                  </td>
                  <td>{STEP_LABELS[l.dropStep || ''] || l.dropStep || '—'}</td>
                  <td>
                    <select
                      className="admin-select"
                      value={status}
                      disabled={busyId === l.id}
                      onChange={(e) => void setStatus(l.id, e.target.value as LeadStatus)}
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {LEAD_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ minWidth: 160 }}>
                    <textarea
                      className="admin-input"
                      rows={2}
                      style={{ minHeight: 52, resize: 'vertical' }}
                      value={noteValue}
                      placeholder="Заметка…"
                      onChange={(e) =>
                        setNotesDraft((prev) => ({ ...prev, [l.id]: e.target.value }))
                      }
                    />
                    {noteDirty && (
                      <button
                        type="button"
                        className="admin-btn ghost"
                        style={{ marginTop: '0.3rem' }}
                        disabled={busyId === l.id}
                        onClick={() => void saveNotes(l.id)}
                      >
                        Сохранить
                      </button>
                    )}
                  </td>
                  <td style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {l.phone && (
                      <a className="admin-btn ghost" href={`tel:${l.phone}`}>
                        Позвонить
                      </a>
                    )}
                    {l.telegram && (
                      <a
                        className="admin-btn ghost"
                        href={`https://t.me/${String(l.telegram).replace('@', '')}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        TG
                      </a>
                    )}
                    {status === 'new' && (
                      <button
                        type="button"
                        className="admin-btn ghost"
                        onClick={() => void setStatus(l.id, 'contacted')}
                      >
                        Позвонили
                      </button>
                    )}
                    {status !== 'booked' && status !== 'spam' && status !== 'closed' && (
                      <a className="admin-btn" href={bookUrl(l)}>
                        В запись
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} style={{ color: '#8a8580' }}>
                  Лидов пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
