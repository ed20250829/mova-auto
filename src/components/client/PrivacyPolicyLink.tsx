import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  PRIVACY_PATH,
  PRIVACY_UPDATED,
  privacyFooterNote,
  privacyIntro,
  privacySections,
} from '../../lib/privacy-policy';

type Props = {
  className?: string;
  children?: ReactNode;
};

export default function PrivacyPolicyLink({ className, children }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('privacy-modal-open');
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.classList.remove('privacy-modal-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function openModal(e: React.MouseEvent) {
    // Keep parent <label> from toggling the consent checkbox.
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="privacy-modal-root"
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <div
              className="privacy-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="privacy-modal__head">
                <h2 id={titleId}>Политика обработки персональных данных</h2>
                <button
                  type="button"
                  className="privacy-modal__close"
                  aria-label="Закрыть"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="privacy-modal__body" data-lenis-prevent>
                <p className="muted">{privacyIntro}</p>
                <p className="muted" style={{ fontSize: '0.85rem' }}>
                  Обновлено: {PRIVACY_UPDATED}
                </p>
                {privacySections.map((section) => (
                  <section key={section.id} className="privacy-modal__section">
                    <h3>{section.title}</h3>
                    {section.paragraphs.map((p, i) => (
                      <p key={`${section.id}-${i}`} className="muted">
                        {p}
                      </p>
                    ))}
                  </section>
                ))}
                <p className="muted" style={{ fontSize: '0.85rem' }}>
                  {privacyFooterNote}
                </p>
              </div>
              <div className="privacy-modal__foot">
                <a
                  className="btn btn-ghost"
                  href={PRIVACY_PATH}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpen(false)}
                >
                  Открыть страницу
                </a>
                <button type="button" className="btn" onClick={() => setOpen(false)}>
                  Понятно
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <a
        className={className || 'privacy-policy-link'}
        href={PRIVACY_PATH}
        onClick={openModal}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children || 'политикой обработки персональных данных'}
      </a>
      {modal}
    </>
  );
}
