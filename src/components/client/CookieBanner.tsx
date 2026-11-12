import { useEffect, useState } from 'react';
import { COOKIE_CONSENT_KEY, loadYandexMetrika } from '../../lib/client-analytics';

type Props = {
  /** Digits-only Yandex Metrika counter. Empty/undefined → never loads. */
  metrikaId?: string;
};

export default function CookieBanner({ metrikaId }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!consent) {
        setVisible(true);
        return;
      }
      if (consent === 'accepted' && metrikaId) {
        loadYandexMetrika(metrikaId);
      }
    } catch {
      setVisible(true);
    }
  }, [metrikaId]);

  useEffect(() => {
    document.body.classList.toggle('has-cookie-banner', visible);
    return () => document.body.classList.remove('has-cookie-banner');
  }, [visible]);

  function choose(value: 'accepted' | 'declined') {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, value);
    } catch {
      /* ignore */
    }
    if (value === 'accepted' && metrikaId) {
      loadYandexMetrika(metrikaId);
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-live="polite" aria-label="Уведомление о cookie">
      <div className="cookie-banner__card">
        <p className="cookie-banner__text">
          Cookie помогают сайту работать удобнее. Можно принять или отказаться.
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
