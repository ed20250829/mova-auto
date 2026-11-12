import { useState } from 'react';
import { isAfterHoursMinsk } from '../../lib/minsk-hours';
import { isValidPhone } from '../../lib/phone';
import PersonalDataConsent from './PersonalDataConsent';
import { readUtm, track } from '../../lib/client-analytics';

type FormState = {
  company: string;
  contactName: string;
  phone: string;
  comment: string;
};

export default function PartnerLeadForm() {
  const [form, setForm] = useState<FormState>({
    company: '',
    contactName: '',
    phone: '',
    comment: '',
  });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const afterHours = isAfterHoursMinsk();

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.company.trim() || form.company.trim().length < 2) {
      next.company = 'Укажите название салона или компании';
    }
    if (!form.contactName.trim() || form.contactName.trim().length < 2) {
      next.contactName = 'Укажите контактное лицо';
    }
    if (!isValidPhone(form.phone)) next.phone = 'Проверьте телефон (+375…)';
    if (!consent) next.consent = 'Нужно согласие на обработку персональных данных';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');
    if (!validate()) {
      track('partner_form_error', { reason: 'validation' });
      return;
    }
    setBusy(true);
    track('partner_form_submit');
    try {
      const res = await fetch('/api/partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: form.company.trim(),
          contactName: form.contactName.trim(),
          phone: form.phone.trim(),
          comment: form.comment.trim() || undefined,
          consent: true,
          ...readUtm(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || 'Не удалось отправить. Попробуйте ещё раз.');
        track('partner_form_error', { reason: data.error || 'server' });
        setBusy(false);
        return;
      }
      track('partner_form_success');
      setDone(data.message || 'Заявку приняли. Свяжемся в рабочее время.');
      setBusy(false);
    } catch {
      setServerError('Сеть недоступна. Напишите на hello@mova-auto.tech');
      track('partner_form_error', { reason: 'network' });
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="surface partner-form-done" role="status">
        <p className="kicker" style={{ margin: 0 }}>
          Заявка
        </p>
        <h2 className="display" style={{ margin: '0.35rem 0 0', fontSize: '1.45rem' }}>
          Приняли
        </h2>
        <p className="muted" style={{ margin: '0.55rem 0 0' }}>
          {done}
        </p>
      </div>
    );
  }

  return (
    <form
      className="surface partner-form"
      id="partner-form"
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="partner-form-title"
    >
      <div>
        <p className="kicker" style={{ margin: 0 }}>
          Заявка салона
        </p>
        <h2 id="partner-form-title" className="display" style={{ margin: '0.35rem 0 0', fontSize: '1.45rem' }}>
          Обсудить условия
        </h2>
        <p className="muted" style={{ margin: '0.4rem 0 0' }}>
          Ответим в рабочее время 08:00–22:00 (Минск)
          {afterHours ? '. Сейчас после часов — перезвоним с утра' : ''}
        </p>
      </div>

      <div className="partner-form-grid">
        <label className="partner-field">
          <span>Салон или компания</span>
          <input
            className="admin-input"
            name="company"
            autoComplete="organization"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            required
          />
          {errors.company && (
            <span style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{errors.company}</span>
          )}
        </label>

        <label className="partner-field">
          <span>Контактное лицо</span>
          <input
            className="admin-input"
            name="contactName"
            autoComplete="name"
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            required
          />
          {errors.contactName && (
            <span style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{errors.contactName}</span>
          )}
        </label>

        <label className="partner-field partner-field-wide">
          <span>Телефон</span>
          <input
            className="admin-input"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+375…"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
          {errors.phone && (
            <span style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{errors.phone}</span>
          )}
        </label>

        <label className="partner-field partner-field-wide">
          <span>Комментарий (необязательно)</span>
          <textarea
            className="admin-input"
            name="comment"
            rows={3}
            placeholder="Объём в месяц, марки в продаже, нужен ли white-label…"
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
          />
        </label>
      </div>

      <PersonalDataConsent
        variant="partner"
        checked={consent}
        onChange={setConsent}
        error={errors.consent}
      />

      {serverError && (
        <p role="alert" style={{ color: 'var(--error)', margin: 0 }}>
          {serverError}
        </p>
      )}

      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Отправляем…' : 'Отправить заявку'}
      </button>
    </form>
  );
}
