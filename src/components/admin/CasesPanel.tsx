import { useState } from 'react';

type CaseRow = {
  id: number;
  title: string;
  description: string;
  imagePath: string;
  published: boolean;
  sortOrder: number;
};

export default function CasesPanel({ cases: initial }: { cases: CaseRow[] }) {
  const [rows, setRows] = useState(initial);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('Меню на русском · Минск');
  const [photo, setPhoto] = useState<File | null>(null);
  const [published, setPublished] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPhoto, setEditPhoto] = useState<File | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!photo) {
      setError('Добавьте фото');
      return;
    }
    setBusy(true);
    setError('');
    const form = new FormData();
    form.set('title', title);
    form.set('description', description);
    form.set('published', published ? '1' : '0');
    form.set('photo', photo);
    const res = await fetch('/api/admin/cases', { method: 'POST', body: form });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Не удалось сохранить');
      return;
    }
    const data = await res.json();
    setRows((prev) => [data.case, ...prev]);
    setTitle('');
    setDescription('Меню на русском · Минск');
    setPhoto(null);
    setPublished(true);
  }

  async function togglePublish(row: CaseRow) {
    const res = await fetch('/api/admin/cases', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, published: !row.published }),
    });
    if (!res.ok) return;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, published: !r.published } : r)));
  }

  async function remove(row: CaseRow) {
    if (!confirm(`Удалить кейс «${row.title}»?`)) return;
    const res = await fetch(`/api/admin/cases?id=${row.id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  function startEdit(row: CaseRow) {
    setEditId(row.id);
    setEditTitle(row.title);
    setEditDescription(row.description || '');
    setEditPhoto(null);
    setError('');
  }

  async function saveEdit() {
    if (!editId) return;
    setBusy(true);
    setError('');
    const form = new FormData();
    form.set('id', String(editId));
    form.set('title', editTitle);
    form.set('description', editDescription);
    if (editPhoto) form.set('photo', editPhoto);
    const res = await fetch('/api/admin/cases', { method: 'PATCH', body: form });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Не удалось сохранить');
      return;
    }
    const data = await res.json();
    setRows((prev) => prev.map((r) => (r.id === editId ? data.case : r)));
    setEditId(null);
    setEditPhoto(null);
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <form
        onSubmit={create}
        style={{
          display: 'grid',
          gap: '0.55rem',
          background: '#14171a',
          padding: '0.85rem',
          borderRadius: 12,
          border: '1px solid #22262a',
          maxWidth: 640,
        }}
      >
        <p style={{ margin: 0, color: '#8a8580', fontSize: '0.85rem' }}>
          На сайте в блоке «Работы» — только опубликованные кейсы с фото.
        </p>
        <input
          className="admin-input"
          placeholder="Модель · Geely Monjaro"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          className="admin-input"
          placeholder="Короткое описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          className="admin-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => setPhoto(e.target.files?.[0] || null)}
          required
        />
        <label style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center', color: '#c8c3bc' }}>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Опубликовать сразу
        </label>
        {error && !editId && <p style={{ margin: 0, color: '#ff5c5c' }}>{error}</p>}
        <button className="admin-btn" type="submit" disabled={busy}>
          {busy && !editId ? 'Сохраняю…' : 'Добавить кейс'}
        </button>
      </form>

      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Фото</th>
              <th>Модель</th>
              <th>Описание</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: '#8a8580' }}>
                  Пока нет кейсов — секция на главной скрыта.
                </td>
              </tr>
            )}
            {rows.map((c) => {
              const editing = editId === c.id;
              return (
                <tr key={c.id}>
                  <td>
                    <img
                      src={c.imagePath}
                      alt=""
                      width={72}
                      height={54}
                      style={{ objectFit: 'cover', borderRadius: 6, background: '#0e0f10' }}
                    />
                    {editing && (
                      <input
                        className="admin-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        style={{ marginTop: '0.35rem' }}
                        onChange={(e) => setEditPhoto(e.target.files?.[0] || null)}
                      />
                    )}
                  </td>
                  <td>
                    {editing ? (
                      <input
                        className="admin-input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                    ) : (
                      c.title
                    )}
                  </td>
                  <td style={{ color: editing ? undefined : '#8a8580' }}>
                    {editing ? (
                      <input
                        className="admin-input"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
                    ) : (
                      c.description || '—'
                    )}
                  </td>
                  <td>{c.published ? 'На сайте' : 'Черновик'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {editing ? (
                      <>
                        <button
                          className="admin-btn"
                          type="button"
                          disabled={busy}
                          onClick={() => void saveEdit()}
                        >
                          OK
                        </button>{' '}
                        <button
                          className="admin-btn ghost"
                          type="button"
                          onClick={() => setEditId(null)}
                        >
                          ×
                        </button>
                        {error && editId && (
                          <div style={{ color: '#ff5c5c', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                            {error}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <button className="admin-btn ghost" type="button" onClick={() => startEdit(c)}>
                          Править
                        </button>{' '}
                        <button
                          className="admin-btn ghost"
                          type="button"
                          onClick={() => void togglePublish(c)}
                        >
                          {c.published ? 'Снять' : 'Опубликовать'}
                        </button>{' '}
                        <button className="admin-btn ghost" type="button" onClick={() => void remove(c)}>
                          Удалить
                        </button>
                      </>
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
