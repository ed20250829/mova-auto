import { useState } from 'react';

export default function SiteBannerToggle({ initialOn }: { initialOn: boolean }) {
  const [on, setOn] = useState(initialOn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    setBusy(true);
    setError('');
    const next = !on;
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showSampleBanner: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Не удалось сохранить');
        return;
      }
      setOn(Boolean(data.showSampleBanner));
    } catch {
      setError('Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      style={{
        background: '#14171a',
        border: '1px solid #22262a',
        borderRadius: 12,
        padding: '1rem',
        marginBottom: '1.25rem',
      }}
    >
      <h2 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>Витрина</h2>
      <p style={{ margin: '0 0 0.85rem', color: '#8a8580', fontSize: '0.85rem' }}>
        Выключатель баннера на всём сайте. Выкл побеждает env и локальный dev.
      </p>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          cursor: busy ? 'wait' : 'pointer',
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          checked={on}
          disabled={busy}
          onChange={() => void toggle()}
          style={{ width: 18, height: 18 }}
        />
        <span>Показывать баннер ТЕСТ · ОБРАЗЦЫ</span>
      </label>
      {on && (
        <p style={{ margin: '0.65rem 0 0', fontSize: '0.85rem' }}>
          <a href="/" target="_blank" rel="noopener noreferrer" style={{ color: '#8a8580' }}>
            Открыть сайт →
          </a>
        </p>
      )}
      {error && (
        <p style={{ margin: '0.5rem 0 0', color: '#ff5c5c', fontSize: '0.85rem' }}>{error}</p>
      )}
    </section>
  );
}
