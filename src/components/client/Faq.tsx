import { useId, useState } from 'react';
import { FAQ_ITEMS } from '../../lib/faq-items';

export default function Faq() {
  const baseId = useId();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="faq">
      {FAQ_ITEMS.map((item, i) => {
        const panelId = `${baseId}-panel-${i}`;
        const btnId = `${baseId}-btn-${i}`;
        const isOpen = open === i;
        return (
          <div
            key={item.q}
            style={{
              borderBottom: '1px solid var(--border)',
              padding: '0.35rem 0',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 0,
                  color: 'inherit',
                  padding: '1rem 0',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}
              >
                <span>{item.q}</span>
                <span
                  aria-hidden="true"
                  className="faq-chevron"
                  data-open={isOpen ? '1' : '0'}
                  style={{ color: 'var(--accent)' }}
                >
                  {isOpen ? '−' : '+'}
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              hidden={!isOpen}
              style={{ padding: '0 0 1rem', color: 'var(--text-muted)', maxWidth: '62ch' }}
            >
              <p style={{ margin: 0 }}>{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
