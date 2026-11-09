import { useState } from 'react';

const CODE = 'MOVA10';

export default function PromoCode({ compact = false }: { compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(CODE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      void fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'share_click', meta: { type: 'promo_copy' } }),
      });
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="promo"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
        padding: compact ? '0.55rem 0.8rem' : '0.9rem 1.1rem',
        border: '1px dashed color-mix(in srgb, var(--accent) 55%, transparent)',
        borderRadius: '12px',
        background: 'var(--accent-soft)',
      }}
    >
      <span style={{ fontWeight: 700 }}>
        {compact ? 'Скидка 10%' : 'Промокод на первую запись'}
        {!compact && <span className="muted"> — 10% на русификацию</span>}
      </span>
      <code
        style={{
          fontWeight: 900,
          letterSpacing: '0.08em',
          padding: '0.35rem 0.6rem',
          background: '#0e0f10',
          borderRadius: 8,
        }}
      >
        {CODE}
      </code>
      <button type="button" className="btn" style={{ minHeight: 40 }} onClick={copy}>
        {copied ? 'Скопировано' : 'Скопировать'}
      </button>
    </div>
  );
}
