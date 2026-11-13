import { useEffect, useMemo, useState } from 'react';
import type { CalcModel } from './Calculator';
import {
  CALC_OPTIONS_STORAGE_KEY,
  PRICING_OPTIONS,
  computeOrderPrice,
  getAppPackPrice,
} from '../../lib/pricing';
import { isValidPhone } from '../../lib/phone';
import BookingCalendar from './BookingCalendar';
import PersonalDataConsent from './PersonalDataConsent';
import { readUtm, track } from '../../lib/client-analytics';

type Props = {
  models: CalcModel[];
  preselectId?: number;
};

type FormState = {
  name: string;
  phone: string;
  telegram: string;
  modelId: string;
  date: string;
  slot: string;
  comment: string;
  promoCode: string;
  ota: boolean;
  visit: boolean;
  appPack: boolean;
};

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function BookingForm({ models, preselectId }: Props) {
  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    telegram: '',
    modelId: String(preselectId || models[0]?.id || ''),
    date: today(),
    slot: '',
    comment: '',
    promoCode: '',
    ota: false,
    visit: false,
    appPack: false,
  });
  const [slots, setSlots] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [serverError, setServerError] = useState('');
  const [promoMeta, setPromoMeta] = useState<{
    kind: string;
    value: number;
    message: string;
  } | null>(null);
  const [promoStatus, setPromoStatus] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadSlots(date: string) {
      try {
        const res = await fetch(`/api/slots?date=${encodeURIComponent(date)}`, {
          cache: 'no-store',
        });
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data.slots) ? (data.slots as string[]) : [];
        setSlots(list);
        setForm((prev) => ({
          ...prev,
          slot: list.includes(prev.slot) ? prev.slot : list[0] || '',
        }));
      } catch {
        if (!cancelled) setSlots([]);
      }
    }
    void loadSlots(form.date);
    return () => {
      cancelled = true;
    };
  }, [form.date]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CALC_OPTIONS_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        modelId?: number;
        ota?: boolean;
        visit?: boolean;
        appPack?: boolean;
        promo?: string;
        promoValue?: number;
        promoKind?: string;
      };
      setForm((prev) => ({
        ...prev,
        modelId: saved.modelId ? String(saved.modelId) : prev.modelId,
        ota: false,
        visit: Boolean(saved.visit),
        appPack: Boolean(saved.appPack),
        promoCode: saved.promo || prev.promoCode,
      }));
      if (saved.promo && saved.promoValue != null && saved.promoKind) {
        setPromoMeta({
          kind: saved.promoKind,
          value: saved.promoValue,
          message: saved.promoKind === 'percent' ? `Скидка −${saved.promoValue}%` : `Скидка −${saved.promoValue} BYN`,
        });
        setPromoStatus('Промокод из калькулятора');
      }
    } catch {
      /* ignore */
    }

    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('promo');
      if (q) {
        const code = q.trim().toUpperCase();
        setForm((prev) => ({ ...prev, promoCode: code }));
        void validatePromo(code);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(
    () => models.find((m) => String(m.id) === form.modelId),
    [models, form.modelId],
  );

  const appPackPrice = selected ? getAppPackPrice(selected.brand) : PRICING_OPTIONS.appPackMass;

  const quote = useMemo(() => {
    if (!selected) return null;
    return computeOrderPrice(selected.priceBase, {
      ota: form.ota,
      visit: form.visit,
      appPack: form.appPack,
      brand: selected.brand,
      promoCode: promoMeta ? form.promoCode : null,
      promoPercent: promoMeta?.kind === 'percent' ? promoMeta.value : null,
      promoFixed: promoMeta?.kind === 'fixed' ? promoMeta.value : null,
    });
  }, [selected, form.ota, form.visit, form.appPack, form.promoCode, promoMeta]);

  function markStart() {
    if (!started) {
      setStarted(true);
      track('form_start');
    }
  }

  async function validatePromo(codeOverride?: string) {
    const code = (codeOverride ?? form.promoCode).trim().toUpperCase();
    if (!code) {
      setPromoMeta(null);
      setPromoStatus('');
      return;
    }
    setPromoBusy(true);
    setPromoStatus('');
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          phone: form.phone || undefined,
          enforceFirstOrder: Boolean(form.phone),
          source: 'booking',
          ...readUtm(),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setPromoMeta(null);
        setPromoStatus(data.error || 'Код не найден');
        return;
      }
      setForm((prev) => ({ ...prev, promoCode: data.code }));
      setPromoMeta({ kind: data.kind, value: data.value, message: data.message });
      setPromoStatus(data.message);
      // Server /api/promo/validate already writes promo_apply — Metrika only here.
      track('promo_apply', { code: data.code, source: 'booking' }, { server: false });
    } catch {
      setPromoMeta(null);
      setPromoStatus('Не удалось проверить код');
    } finally {
      setPromoBusy(false);
    }
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) next.name = 'Укажите имя';
    if (!isValidPhone(form.phone)) next.phone = 'Проверьте телефон';
    if (!form.modelId) next.modelId = 'Выберите модель';
    if (!form.date || form.date < today()) next.date = 'Дата не может быть в прошлом';
    if (!form.slot) next.slot = 'Выберите слот';
    if (!consent) next.consent = 'Нужно согласие на обработку персональных данных';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');
    if (!validate()) {
      track('form_error', { reason: 'validation' });
      return;
    }
    setBusy(true);
    track('form_submit');
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          telegram: form.telegram,
          modelId: Number(form.modelId),
          date: form.date,
          slot: form.slot,
          comment: form.comment,
          promoCode: form.promoCode,
          requirePromo: Boolean(form.promoCode && promoMeta),
          ota: form.ota,
          visit: form.visit,
          appPack: form.appPack,
          consent: true,
          ...readUtm(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || 'Не удалось отправить. Попробуйте ещё раз.');
        if (data.promoError) setPromoStatus(data.promoError);
        track('form_error', { reason: data.error || 'server' });
        setBusy(false);
        return;
      }
      try {
        sessionStorage.removeItem(CALC_OPTIONS_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      track('form_success', { orderId: data.orderId });
      const thanks = new URLSearchParams();
      if (data.price) thanks.set('price', String(data.price));
      if (data.ics) thanks.set('ics', data.ics);
      window.location.href = `/booking/thanks${thanks.toString() ? `?${thanks}` : ''}`;
    } catch {
      setServerError('Сеть недоступна. Напишите в Telegram.');
      track('form_error', { reason: 'network' });
      setBusy(false);
    }
  }

  return (
    <form
      className="surface"
      id="booking-form"
      onSubmit={onSubmit}
      style={{ padding: '1.25rem', display: 'grid', gap: '0.85rem' }}
      noValidate
    >
      <div>
        <p className="kicker" style={{ margin: 0 }}>
          Запись
        </p>
        <h2 className="display" style={{ margin: '0.35rem 0 0', fontSize: '1.55rem' }}>
          Выбрать слот
        </h2>
        <p className="muted" style={{ margin: '0.4rem 0 0' }}>
          После отправки сохраним заявку и пришлём её владельцу в Telegram.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span>Имя</span>
          <input
            className="admin-input"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={(e) => {
              markStart();
              setForm({ ...form, name: e.target.value });
            }}
            required
          />
          {errors.name && <span style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{errors.name}</span>}
        </label>

        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span>Телефон</span>
          <input
            className="admin-input"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+375..."
            value={form.phone}
            onChange={(e) => {
              markStart();
              setForm({ ...form, phone: e.target.value });
            }}
            required
          />
          {errors.phone && <span style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{errors.phone}</span>}
        </label>

        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span>Telegram (необязательно)</span>
          <input
            className="admin-input"
            name="telegram"
            placeholder="@username"
            value={form.telegram}
            onChange={(e) => setForm({ ...form, telegram: e.target.value })}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span>Модель</span>
          <select
            className="admin-select"
            value={form.modelId}
            onChange={(e) => setForm({ ...form, modelId: e.target.value, ota: false })}
            required
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.brand} {m.model}
              </option>
            ))}
          </select>
          {errors.modelId && (
            <span style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{errors.modelId}</span>
          )}
        </label>

        <div style={{ display: 'grid', gap: '0.3rem', gridColumn: '1 / -1' }}>
          <span>Дата</span>
          <BookingCalendar
            value={form.date}
            min={today()}
            onChange={(date) => setForm({ ...form, date })}
            error={errors.date}
          />
        </div>

        <label style={{ display: 'grid', gap: '0.3rem', gridColumn: '1 / -1' }}>
          <span>Слот</span>
          {slots.length ? (
            <div className="booking-slot-grid" role="group" aria-label="Свободное время">
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`booking-slot-btn ${form.slot === s ? 'is-on' : ''}`}
                  onClick={() => setForm({ ...form, slot: s })}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              На эту дату свободных слотов нет — выберите другой день.
            </p>
          )}
          {errors.slot && <span style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{errors.slot}</span>}
        </label>
      </div>

      <div className="calc-options" role="group" aria-label="Опции из калькулятора">
        <label className={`calc-opt ${form.ota ? 'is-on' : ''}`}>
          <input
            type="checkbox"
            checked={form.ota}
            onChange={(e) => setForm({ ...form, ota: e.target.checked })}
          />
          <span className="calc-opt-main">
            <strong>Страховка после обновления ПО</strong>
            <span className="muted">+{PRICING_OPTIONS.otaInsurance}&nbsp;BYN/год</span>
          </span>
        </label>
        <label className={`calc-opt ${form.appPack ? 'is-on' : ''}`}>
          <input
            type="checkbox"
            checked={form.appPack}
            onChange={(e) => setForm({ ...form, appPack: e.target.checked })}
          />
          <span className="calc-opt-main">
            <strong>Яндекс-приложения</strong>
            <span className="muted">+{appPackPrice}&nbsp;BYN</span>
          </span>
        </label>
        <label className={`calc-opt ${form.visit ? 'is-on' : ''}`}>
          <input
            type="checkbox"
            checked={form.visit}
            onChange={(e) => setForm({ ...form, visit: e.target.checked })}
          />
          <span className="calc-opt-main">
            <strong>Выезд</strong>
            <span className="muted">+{PRICING_OPTIONS.onSiteVisit}&nbsp;BYN</span>
          </span>
        </label>
      </div>

      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span>Комментарий</span>
        <textarea
          className="admin-input"
          rows={3}
          value={form.comment}
          onChange={(e) => setForm({ ...form, comment: e.target.value })}
          placeholder="Год, комплектация, удобный район"
        />
      </label>

      <div style={{ display: 'grid', gap: '0.35rem', maxWidth: 420 }}>
        <span>Промокод</span>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            className="admin-input"
            style={{ flex: '1 1 160px' }}
            value={form.promoCode}
            onChange={(e) => {
              setForm({ ...form, promoCode: e.target.value.toUpperCase() });
              setPromoMeta(null);
              setPromoStatus('');
            }}
            placeholder="Если есть код"
          />
          <button
            type="button"
            className="btn btn-ghost"
            disabled={promoBusy || !form.promoCode.trim()}
            onClick={() => void validatePromo()}
          >
            {promoBusy ? '…' : 'Применить'}
          </button>
        </div>
        {promoStatus && (
          <span
            style={{
              fontSize: '0.85rem',
              color: promoMeta ? 'var(--text-muted)' : 'var(--error)',
            }}
          >
            {promoStatus}
          </span>
        )}
      </div>

      {selected && quote && (
        <p className="muted" style={{ margin: 0 }}>
          {quote.discount > 0 ? (
            <>
              <span className="calc-price-was">
                <span className="calc-price-was-label">было</span> {quote.subtotal}&nbsp;BYN
              </span>
              {' · '}
              <span className="calc-price-now">
                <span className="calc-price-now-label">сейчас</span>{' '}
                <strong className="price-inline" style={{ color: 'var(--text)' }}>
                  {quote.price}&nbsp;BYN
                </strong>
              </span>
            </>
          ) : (
            <>
              Итого к заявке:{' '}
              <strong className="price-inline" style={{ color: 'var(--text)' }}>
                {quote.price}&nbsp;BYN
              </strong>
            </>
          )}{' '}
          · ~{selected.timeMinutes} мин
          {quote.options.length > 0 ? ` · ${quote.options.join(', ')}` : ''}
        </p>
      )}

      <PersonalDataConsent
        variant="booking"
        checked={consent}
        error={errors.consent}
        onChange={(checked) => {
          setConsent(checked);
          if (checked) {
            setErrors((prev) => {
              const next = { ...prev };
              delete next.consent;
              return next;
            });
          }
        }}
      />

      {serverError && (
        <p role="alert" style={{ color: 'var(--error)', margin: 0 }}>
          {serverError}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn" type="submit" disabled={busy || !consent}>
          {busy ? 'Отправляем…' : 'Забронировать слот'}
        </button>
        <a
          className="btn btn-ghost"
          href={import.meta.env.PUBLIC_TELEGRAM_BOT_URL || 'https://t.me/mova_auto_bot'}
          onClick={() => track('bot_click')}
          target="_blank"
          rel="noreferrer"
        >
          Написать в Telegram
        </a>
      </div>
    </form>
  );
}
