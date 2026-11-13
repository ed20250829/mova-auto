import { useMemo, useState } from 'react';
import type { Model } from '../../db/schema';

export default function ModelsTable({ models: initial }: { models: Model[] }) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ priceBase: number; timeMinutes: number; knownIssues: string }>({
    priceBase: 0,
    timeMinutes: 0,
    knownIssues: '[]',
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (m) =>
        m.brand.toLowerCase().includes(s) ||
        m.model.toLowerCase().includes(s) ||
        m.screenType.toLowerCase().includes(s),
    );
  }, [rows, q]);

  function startEdit(m: Model) {
    setEditing(m.id);
    setDraft({
      priceBase: m.priceBase,
      timeMinutes: m.timeMinutes,
      knownIssues: m.knownIssues,
    });
  }

  async function save(id: number) {
    let knownIssues: string[] = [];
    try {
      knownIssues = JSON.parse(draft.knownIssues);
    } catch {
      knownIssues = draft.knownIssues
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean);
    }
    const res = await fetch('/api/admin/models', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        priceBase: draft.priceBase,
        timeMinutes: draft.timeMinutes,
        knownIssues,
      }),
    });
    if (res.ok) {
      setRows((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                priceBase: draft.priceBase,
                timeMinutes: draft.timeMinutes,
                knownIssues: JSON.stringify(knownIssues),
              }
            : m,
        ),
      );
      setEditing(null);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '0.9rem', display: 'flex', gap: '0.6rem' }}>
        <input
          className="admin-input"
          style={{ maxWidth: 280 }}
          placeholder="Поиск марки / модели"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span style={{ color: '#8a8580', alignSelf: 'center' }}>{filtered.length} моделей</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Марка</th>
              <th>Модель</th>
              <th>Экран</th>
              <th>Цена</th>
              <th>Минуты</th>
              <th>Сложность</th>
              <th>Нюансы</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id}>
                <td>{m.brand}</td>
                <td>
                  <a href={`/auto/${m.brandSlug}/${m.modelSlug}`} style={{ color: '#ff8a65' }}>
                    {m.model}
                  </a>
                </td>
                <td>{m.screenType}</td>
                <td>
                  {editing === m.id ? (
                    <input
                      className="admin-input"
                      type="number"
                      value={draft.priceBase}
                      onChange={(e) => setDraft({ ...draft, priceBase: Number(e.target.value) })}
                    />
                  ) : (
                    m.priceBase
                  )}
                </td>
                <td>
                  {editing === m.id ? (
                    <input
                      className="admin-input"
                      type="number"
                      value={draft.timeMinutes}
                      onChange={(e) => setDraft({ ...draft, timeMinutes: Number(e.target.value) })}
                    />
                  ) : (
                    m.timeMinutes
                  )}
                </td>
                <td>{m.complexity}</td>
                <td style={{ maxWidth: 280 }}>
                  {editing === m.id ? (
                    <textarea
                      className="admin-input"
                      rows={3}
                      value={draft.knownIssues}
                      onChange={(e) => setDraft({ ...draft, knownIssues: e.target.value })}
                    />
                  ) : (
                    <span style={{ color: '#8a8580', fontSize: '0.8rem' }}>
                      {(() => {
                        try {
                          return JSON.parse(m.knownIssues).slice(0, 2).join('; ');
                        } catch {
                          return m.knownIssues;
                        }
                      })()}
                    </span>
                  )}
                </td>
                <td>
                  {editing === m.id ? (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button type="button" className="admin-btn" onClick={() => save(m.id)}>
                        Сохранить
                      </button>
                      <button type="button" className="admin-btn ghost" onClick={() => setEditing(null)}>
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="admin-btn ghost" onClick={() => startEdit(m)}>
                      Править
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
