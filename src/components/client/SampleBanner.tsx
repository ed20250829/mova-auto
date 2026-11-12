import { useEffect, useState } from 'react';

const STORAGE_KEY = 'mova_sample_banner_dismissed';

export default function SampleBanner() {
  // Start hidden to avoid a flash for users who already dismissed it
  // (logo click remounts the banner and used to briefly show it again).
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== '1') setVisible(true);
    } catch {
      /* private mode — show */
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="sample-banner"
      role="status"
      aria-live="polite"
      aria-label="Важно: тестовый сайт с образцовыми данными"
    >
      <p className="sample-banner__text">
        <strong>ТЕСТ · ОБРАЗЦЫ</strong>
        <span>
          {' '}
          - это демо-витрина. Цены, модели и заявки здесь учебные. Не принимайте их за рабочие.
        </span>
      </p>
      <button
        type="button"
        className="sample-banner__close"
        onClick={dismiss}
        aria-label="Закрыть уведомление о тестовом сайте"
      >
        <span aria-hidden="true">×</span>
        <span className="sample-banner__close-label">Понятно</span>
      </button>
    </div>
  );
}
