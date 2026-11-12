import { useEffect, useState } from 'react';

const STORAGE_KEY = 'mova_cookie_consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle('has-cookie-banner', visible);
    return () => document.body.classList.remove('has-cookie-banner');
  }, [visible]);

  function choose(value: 'accepted' | 'declined') {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-live="polite" aria-label="Уведомление о cookie">
      <div className="cookie-banner__card">
        <p className="cookie-banner__text">
          Мы используем файлы cookie для улучшения работы сайта. Продолжая использовать сайт, вы
          соглашаетесь с политикой обработки данных.
        </p>
        <div className="cookie-banner__actions">
          <button type="button" className="cookie-banner__btn cookie-banner__btn--accept" onClick={() => choose('accepted')}>
            Принять
          </button>
          <button type="button" className="cookie-banner__btn cookie-banner__btn--decline" onClick={() => choose('declined')}>
            Отказаться
          </button>
        </div>
      </div>
    </div>
  );
}
