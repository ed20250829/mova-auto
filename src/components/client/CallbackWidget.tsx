import { useEffect, useRef, useState } from 'react';
import { callbackSuccessCopy, isAfterHoursMinsk } from '../../lib/minsk-hours';
import { isValidPhone } from '../../lib/phone';


const SESSION_KEY = 'mova_callback_shown';
const DISMISS_KEY = 'mova_callback_dismiss_until';
const DISMISS_DAYS = 7;
/** Idle on calculator — calm, not first-seconds. */
const IDLE_MS = 80_000;
/** Exit-intent armed only after a short settle on desktop. */
const EXIT_ARM_MS = 28_000;
const PHONE_E164 = '+375447149978';
const PHONE_DISPLAY = '+375 44 714-99-78';

type Trigger = 'model_missing' | 'idle_calc' | 'exit_intent' | 'manual';

function readUtm() {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  return {
    utmSource: p.get('utm_source') || undefined,
    utmMedium: p.get('utm_medium') || undefined,
    utmCampaign: p.get('utm_campaign') || undefined,
  };
}

function track(name: string, meta?: Record<string, unknown>) {
  void fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, meta, ...readUtm() }),
  });
}

function isDismissed(): boolean {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Boolean(until && Date.now() < until);
  } catch {
    return false;
  }
}

function wasShownThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

/** Auto popups: once per session and respect dismiss TTL. */
function canAutoShow(): boolean {
  return !wasShownThisSession() && !isDismissed();
}

function markShown() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

function markDismissed() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 864e5));
  } catch {
    /* ignore */
  }
}

function isDesktopPointer() {
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

function resolvePhone() {
  const fromEnv = (import.meta.env.PUBLIC_PHONE as string | undefined)?.trim() || '';
  const digits = fromEnv.replace(/\D/g, '');
  if (digits.length >= 9) {
    const e164 = fromEnv.startsWith('+') ? fromEnv.replace(/\s/g, '') : `+${digits}`;
    return { e164, display: fromEnv.includes(' ') ? fromEnv : PHONE_DISPLAY };
  }
  return { e164: PHONE_E164, display: PHONE_DISPLAY };
}

export default function CallbackWidget() {
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<Trigger>('manual');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [modelLabel, setModelLabel] = useState('');
  const [slot, setSlot] = useState<'morning' | 'day' | 'evening' | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const afterHours = isAfterHoursMinsk();
  const openRef = useRef(false);
  const autoShownRef = useRef(false);
  const phoneInfo = resolvePhone();

  function openWidget(next: Trigger) {
    if (openRef.current) return;

    // Intentional clicks always open; only soft auto-popups respect dismiss/session.
    if (next === 'manual' || next === 'model_missing') {
      // FAB / «Моей модели нет» — user asked for the form.
    } else {
      // idle / exit — soft auto: 1×/session + dismiss TTL
      if (autoShownRef.current || !canAutoShow()) return;
    }

    openRef.current = true;
    if (next === 'idle_calc' || next === 'exit_intent') {
      autoShownRef.current = true;
      markShown();
    } else if (!wasShownThisSession()) {
      // Intentional open still counts as session shown so idle/exit won't nag later.
      markShown();
      autoShownRef.current = true;
    }

    setTrigger(next);
    setOpen(true);
    setDone(null);
    setError('');
    track('callback_open', { trigger: next, afterHours });
  }

  function close(dismiss = true) {
    setOpen(false);
    openRef.current = false;
    if (dismiss) {
      markDismissed();
      autoShownRef.current = true;
      track('callback_dismiss', { trigger });
    }
  }

  useEffect(() => {
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as { trigger?: Trigger } | undefined;
      openWidget(detail?.trigger || 'manual');
    };
    window.addEventListener('mova:callback', onCustom);

    let idleTimer = window.setTimeout(() => {
      const calc = document.querySelector('[data-calc-root]');
      if (calc) openWidget('idle_calc');
    }, IDLE_MS);

    const bumpIdle = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        const calc = document.querySelector('[data-calc-root]');
        if (calc && !document.getElementById('booking-form')?.contains(document.activeElement)) {
          openWidget('idle_calc');
        }
      }, IDLE_MS);
    };

    window.addEventListener('pointerdown', bumpIdle, { passive: true });
    window.addEventListener('keydown', bumpIdle);

    let exitArmed = false;
    const armExit = window.setTimeout(() => {
      exitArmed = true;
    }, EXIT_ARM_MS);

    const onMouseOut = (e: MouseEvent) => {
      if (!exitArmed || !isDesktopPointer()) return;
      if (e.clientY > 12) return;
      if (e.relatedTarget) return;
      const booking = document.getElementById('booking');
      const calc = document.getElementById('calculator');
      if (!booking && !calc) return;
      openWidget('exit_intent');
    };
    document.addEventListener('mouseout', onMouseOut);

    return () => {
      window.removeEventListener('mova:callback', onCustom);
      window.removeEventListener('pointerdown', bumpIdle);
      window.removeEventListener('keydown', bumpIdle);
      document.removeEventListener('mouseout', onMouseOut);
      window.clearTimeout(idleTimer);
      window.clearTimeout(armExit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trigger]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim() || name.trim().length < 2) {
      setError('Укажите имя');
      return;
    }
    if (!isValidPhone(phone)) {
      setError('Проверьте телефон');
      return;
    }
    if (!consent) {
      setError('Нужно согласие на обработку персональных данных');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          modelLabel: modelLabel.trim() || undefined,
          preferredSlot: slot || undefined,
          trigger,
          ...readUtm(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Не удалось отправить');
        setBusy(false);
        return;
      }
      track('callback_submit', { trigger, afterHours: data.afterHours });
      setDone(data.message || callbackSuccessCopy(Boolean(data.afterHours)));
      markDismissed();
      autoShownRef.current = true;
      setBusy(false);
    } catch {
      setError('Сеть недоступна. Напишите в Telegram или позвоните.');
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="callback-fab"
        aria-label="Заказать звонок"
        aria-haspopup="dialog"
        aria-expanded={open}
        hidden={open}
        onClick={() => openWidget('manual')}
      >
        Звонок
      </button>

      {open && (
        <div className="callback-layer" role="presentation">
          <button type="button" className="callback-backdrop" aria-label="Закрыть" onClick={() => close(true)} />
          <div
            className="callback-modal surface"
            role="dialog"
            aria-modal="true"
            aria-labelledby="callback-title"
          >
            <button
              type="button"
              className="callback-close"
              aria-label="Закрыть"
              onClick={() => close(true)}
            >
              <span aria-hidden="true">×</span>
            </button>

            {done ? (
              <div className="callback-done">
                <p className="kicker" style={{ margin: 0 }}>
                  Готово
                </p>
                <h2 id="callback-title" className="display" style={{ fontSize: '1.45rem', margin: '0.4rem 0' }}>
                  Заявку приняли
                </h2>
                <p className="muted" style={{ margin: 0 }}>
                  {done}
                </p>
                <button type="button" className="btn" style={{ marginTop: '1rem' }} onClick={() => close(false)}>
                  Закрыть
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="callback-form">
                <p className="kicker" style={{ margin: 0 }}>
                  Помощь
                </p>
                <h2 id="callback-title" className="display" style={{ fontSize: '1.45rem', margin: '0.35rem 0 0' }}>
                  {trigger === 'model_missing' ? 'Не нашли модель?' : 'Затрудняетесь с выбором?'}
                </h2>
                <p className="muted" style={{ margin: '0.45rem 0 0' }}>
                  {afterHours
                    ? 'Сейчас вне рабочего времени (08:00–22:00, Минск). Оставьте телефон — перезвоним утром.'
                    : 'Оставьте телефон — перезвоним. Или позвоните сами.'}
                </p>

                <label className="callback-field">
                  <span>Имя</span>
                  <input
                    className="admin-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </label>
                <label className="callback-field">
                  <span>Телефон</span>
                  <input
                    className="admin-input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+375..."
                    autoComplete="tel"
                    required
                  />
                </label>
                <label className="callback-field">
                  <span>Модель (если нет в списке)</span>
                  <input
                    className="admin-input"
                    value={modelLabel}
                    onChange={(e) => setModelLabel(e.target.value)}
                    placeholder="Марка и модель"
                  />
                </label>

                <div className="callback-slots" role="group" aria-label="Удобное время">
                  {(
                    [
                      ['morning', 'Утром'],
                      ['day', 'Днём'],
                      ['evening', 'Вечером'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`callback-chip ${slot === id ? 'is-on' : ''}`}
                      onClick={() => setSlot(slot === id ? '' : id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <label className={`callback-consent ${consent ? 'is-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    required
                  />
                  <span>Согласен на обработку персональных данных</span>
                </label>

                {error && (
                  <p role="alert" style={{ color: 'var(--error)', margin: 0, fontSize: '0.9rem' }}>
                    {error}
                  </p>
                )}

                <div className="callback-actions">
                  <button className="btn" type="submit" disabled={busy || !consent}>
                    {busy ? 'Отправляем…' : 'Жду звонка'}
                  </button>
                  <a className="btn btn-ghost" href={`tel:${phoneInfo.e164}`}>
                    Позвонить
                  </a>
                  <a
                    className="btn btn-ghost"
                    href={import.meta.env.PUBLIC_TELEGRAM_BOT_URL || 'https://t.me/mova_auto_bot'}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Telegram
                  </a>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
