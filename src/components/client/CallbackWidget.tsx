import { useEffect, useRef, useState } from 'react';
import { callbackSuccessCopy, isAfterHoursMinsk } from '../../lib/minsk-hours';

const SESSION_KEY = 'mova_callback_shown';
const DISMISS_KEY = 'mova_callback_dismiss_until';
const DISMISS_DAYS = 7;
const IDLE_MS = 50_000;

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

function canShow(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_KEY) === '1') return false;
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (until && Date.now() < until) return false;
  } catch {
    /* ignore */
  }
  return true;
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

function isValidPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
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
  const afterHours = isAfterHoursMinsk();
  const openedRef = useRef(false);

  function openWidget(next: Trigger) {
    if (openedRef.current) return;
    if (!canShow() && next !== 'manual' && next !== 'model_missing') return;
    // model_missing / manual always allowed once per session if not dismissed this session open
    if (sessionStorage.getItem(SESSION_KEY) === '1' && next !== 'model_missing' && next !== 'manual') {
      return;
    }
    openedRef.current = true;
    markShown();
    setTrigger(next);
    setOpen(true);
    setDone(null);
    setError('');
    track('callback_open', { trigger: next, afterHours });
  }

  function close(dismiss = true) {
    setOpen(false);
    if (dismiss) {
      markDismissed();
      track('callback_dismiss', { trigger });
    }
  }

  useEffect(() => {
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as { trigger?: Trigger } | undefined;
      openWidget(detail?.trigger || 'manual');
    };
    window.addEventListener('mova:callback', onCustom);

    // Idle on calculator
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

    // Exit intent near booking / calc
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY > 12) return;
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setBusy(false);
    } catch {
      setError('Сеть недоступна. Напишите в Telegram или позвоните.');
      setBusy(false);
    }
  }

  const publicPhone = (import.meta.env.PUBLIC_PHONE as string | undefined) || '';

  return (
    <>
      <button
        type="button"
        className="callback-fab"
        aria-label="Заказать звонок"
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

                {error && (
                  <p role="alert" style={{ color: 'var(--error)', margin: 0, fontSize: '0.9rem' }}>
                    {error}
                  </p>
                )}

                <div className="callback-actions">
                  <button className="btn" type="submit" disabled={busy}>
                    {busy ? 'Отправляем…' : 'Жду звонка'}
                  </button>
                  {!afterHours && publicPhone && (
                    <a className="btn btn-ghost" href={`tel:${publicPhone.replace(/\s/g, '')}`}>
                      Позвонить сейчас
                    </a>
                  )}
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
