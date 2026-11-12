import { useState, type ReactNode } from 'react';
import type { Lead, Order, Subscription } from '../../db/schema';

type Props = {
  today: string;
  newOrders: Order[];
  openLeads: Lead[];
  otaDue: Subscription[];
  compact?: boolean;
};

export default function InboxPanel({ today, newOrders, openLeads, otaDue, compact }: Props) {
  const [remindMsg, setRemindMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function runTodayReminds() {
    setBusy(true);
    setRemindMsg(null);
    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_today_reminds', notify: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRemindMsg(data.error || 'Ошибка');
      } else {
        setRemindMsg(
          `Напоминания: отмечено ${data.reminded}, отправлено ${data.notified} (окон ${data.candidates}).`,
        );
      }
    } catch {
      setRemindMsg('Сеть: не удалось запустить напоминания');
    } finally {
      setBusy(false);
    }
  }

  const empty = newOrders.length + openLeads.length + otaDue.length === 0;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          marginBottom: '0.85rem',
        }}
      >
        <p style={{ margin: 0, color: '#8a8580', fontSize: '0.9rem' }}>
          Входящие на {today} · новые заказы, лиды без ответа, OTA к оплате (≤7 дн.)
        </p>
        <button type="button" className="admin-btn" disabled={busy} onClick={runTodayReminds}>
          {busy ? 'Создаём…' : 'Создать напоминания на сегодня'}
        </button>
      </div>
      {remindMsg && (
        <p style={{ margin: '0 0 0.85rem', color: '#c8c3bc', fontSize: '0.85rem' }}>{remindMsg}</p>
      )}

      {empty && (
        <p style={{ color: '#8a8580', margin: 0 }}>Пока пусто — можно выдохнуть.</p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : 'repeat(3, minmax(0, 1fr))',
          gap: '1rem',
        }}
        className="inbox-grid"
      >
        <InboxColumn
          title={`Новые заказы · ${newOrders.length}`}
          href="/admin/orders"
          empty="Нет открытых new"
        >
          {newOrders.slice(0, compact ? 5 : 12).map((o) => (
            <li key={o.id}>
              <strong>#{o.id}</strong> {o.clientName}
              <div style={{ color: '#8a8580', fontSize: '0.82rem' }}>
                {o.modelLabel} · {o.clientPhone}
                {o.scheduledDate ? ` · ${o.scheduledDate} ${o.scheduledSlot || ''}` : ''}
              </div>
            </li>
          ))}
        </InboxColumn>

        <InboxColumn
          title={`Лиды new · ${openLeads.length}`}
          href="/admin/leads"
          empty="Нет неотвеченных"
        >
          {openLeads.slice(0, compact ? 5 : 12).map((l) => (
            <li key={l.id}>
              <strong>#{l.id}</strong> {l.name || 'Без имени'}
              <div style={{ color: '#8a8580', fontSize: '0.82rem' }}>
                {l.phone || l.telegram || '—'}
                {l.modelLabel ? ` · ${l.modelLabel}` : ''}
                {l.dropStep ? ` · ${l.dropStep}` : ''}
              </div>
            </li>
          ))}
        </InboxColumn>

        <InboxColumn
          title={`OTA к оплате · ${otaDue.length}`}
          href="/admin/subscriptions"
          empty="Нет платежей в окне 7 дней"
        >
          {otaDue.slice(0, compact ? 5 : 12).map((s) => (
            <li key={s.id}>
              <strong>{s.clientName}</strong>
              <div style={{ color: '#8a8580', fontSize: '0.82rem' }}>
                {s.nextPaymentAt} · {s.clientPhone}
                {s.modelLabel ? ` · ${s.modelLabel}` : ''}
              </div>
            </li>
          ))}
        </InboxColumn>
      </div>

      <style>{`
        @media (max-width: 1000px) {
          .inbox-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function InboxColumn({
  title,
  href,
  empty,
  children,
}: {
  title: string;
  href: string;
  empty: string;
  children: ReactNode;
}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section
      style={{
        background: '#14171a',
        border: '1px solid #22262a',
        borderRadius: 12,
        padding: '1rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.65rem' }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>{title}</h2>
        <a href={href} style={{ color: '#8a8580', fontSize: '0.8rem' }}>
          открыть
        </a>
      </div>
      {hasItems ? (
        <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '0.45rem' }}>{children}</ul>
      ) : (
        <p style={{ margin: 0, color: '#8a8580', fontSize: '0.85rem' }}>{empty}</p>
      )}
    </section>
  );
}
