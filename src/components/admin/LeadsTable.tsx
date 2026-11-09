import { useState } from 'react';
import type { Lead } from '../../db/schema';

export default function LeadsTable({ leads: initial }: { leads: Lead[] }) {
  const [rows, setRows] = useState(initial);

  async function markContacted(id: number) {
    const res = await fetch('/api/admin/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, contacted: true }),
    });
    if (res.ok) setRows((prev) => prev.map((l) => (l.id === id ? { ...l, contacted: true } : l)));
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Когда</th>
            <th>Контакт</th>
            <th>Модель</th>
            <th>Шаг отвала</th>
            <th>UTM</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id}>
              <td>{l.id}</td>
              <td>{l.createdAt.slice(0, 16).replace('T', ' ')}</td>
              <td>
                <div>{l.name || '—'}</div>
                <div style={{ color: '#8a8580' }}>{l.phone || l.telegram || '—'}</div>
              </td>
              <td>{l.modelLabel || '—'}</td>
              <td>{l.dropStep || '—'}</td>
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
                <button
                  type="button"
                  className="admin-btn"
                  disabled={Boolean(l.contacted)}
                  onClick={() => markContacted(l.id)}
                >
                  {l.contacted ? 'Связались' : 'Отметить'}
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} style={{ color: '#8a8580' }}>
                Лидов пока нет
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
