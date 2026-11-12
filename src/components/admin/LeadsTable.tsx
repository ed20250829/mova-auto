import { useMemo, useState } from 'react';
import type { Lead } from '../../db/schema';
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from '../../lib/leads';

function leadStatus(lead: Lead): LeadStatus {
  if (lead.status && (LEAD_STATUSES as readonly string[]).includes(lead.status)) {
    return lead.status as LeadStatus;
  }
  return lead.contacted ? 'contacted' : 'new';
}

export default function LeadsTable({ leads: initial }: { leads: Lead[] }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<'all' | LeadStatus>('all');

  const visible = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((l) => leadStatus(l) === filter);
  }, [rows, filter]);

  async function setStatus(id: number, status: LeadStatus) {
    const res = await fetch('/api/admin/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setRows((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, status, contacted: status !== 'new' } : l,
        ),
      );
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
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
              <th>Шаг отвала</th>
              <th>Статус</th>
              <th>UTM</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((l) => {
              const status = leadStatus(l);
              return (
                <tr key={l.id}>
                  <td>{l.id}</td>
                  <td>{l.createdAt.slice(0, 16).replace('T', ' ')}</td>
                  <td>
                    <div>{l.name || '—'}</div>
                    <div style={{ color: '#8a8580' }}>{l.phone || l.telegram || '—'}</div>
                  </td>
                  <td>{l.modelLabel || '—'}</td>
                  <td>{l.dropStep || '—'}</td>
                  <td>
                    <select
                      className="admin-select"
                      value={status}
                      onChange={(e) => setStatus(l.id, e.target.value as LeadStatus)}
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {LEAD_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{[l.utmSource, l.utmMedium, l.utmCampaign].filter(Boolean).join(' / ') || '—'}</td>
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
                      <button type="button" className="admin-btn" onClick={() => setStatus(l.id, 'contacted')}>
                        Позвонили
                      </button>
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
