type BookingPayload = {
  name: string;
  phone: string;
  telegram?: string;
  modelLabel: string;
  date?: string;
  slot?: string;
  comment?: string;
  price?: number;
  utm?: { source?: string; medium?: string; campaign?: string };
  promoCode?: string;
};

function env(name: string): string | undefined {
  return (import.meta.env[name] as string | undefined) || process.env[name];
}

export async function notifyOwnerBooking(payload: BookingPayload): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const token = env('TELEGRAM_BOT_TOKEN');
  const chatId = env('TELEGRAM_CHAT_ID');

  if (!token || !chatId) {
    return { ok: true, skipped: true };
  }

  const lines = [
    '🆕 Новая бронь — Мова',
    `Имя: ${payload.name}`,
    `Телефон: ${payload.phone}`,
    payload.telegram ? `Telegram: ${payload.telegram}` : null,
    `Модель: ${payload.modelLabel}`,
    payload.date ? `Дата: ${payload.date}` : null,
    payload.slot ? `Слот: ${payload.slot}` : null,
    payload.price != null ? `Цена: ${payload.price} BYN` : null,
    payload.promoCode ? `Промокод: ${payload.promoCode}` : null,
    payload.comment ? `Комментарий: ${payload.comment}` : null,
    payload.utm?.source || payload.utm?.medium || payload.utm?.campaign
      ? `UTM: ${[payload.utm.source, payload.utm.medium, payload.utm.campaign].filter(Boolean).join(' / ')}`
      : null,
  ].filter(Boolean);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines.join('\n'),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: body };
  }
  return { ok: true };
}

export async function notifyClientStatus(opts: {
  chatId?: string;
  phone?: string;
  message: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const token = env('TELEGRAM_BOT_TOKEN');
  if (!token || !opts.chatId) {
    return { ok: true, skipped: true };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: opts.chatId, text: opts.message }),
  });

  if (!res.ok) {
    return { ok: false, error: await res.text() };
  }
  return { ok: true };
}

export async function notifyPartnerReady(message: string): Promise<{ ok: boolean; skipped?: boolean }> {
  const token = env('TELEGRAM_PARTNER_BOT_TOKEN');
  const chatId = env('TELEGRAM_PARTNER_CHAT_ID');
  if (!token || !chatId) return { ok: true, skipped: true };

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });
  return { ok: true };
}

export async function notifyOwnerCallback(payload: {
  name: string;
  phone: string;
  modelLabel?: string;
  preferredSlot?: string;
  afterHours: boolean;
  trigger?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const token = env('TELEGRAM_BOT_TOKEN');
  const chatId = env('TELEGRAM_CHAT_ID');
  if (!token || !chatId) return { ok: true, skipped: true };

  const slotLabel =
    payload.preferredSlot === 'morning'
      ? 'утром'
      : payload.preferredSlot === 'day'
        ? 'днём'
        : payload.preferredSlot === 'evening'
          ? 'вечером'
          : null;

  const lines = [
    `📞 Callback — Мова${payload.afterHours ? ' · после часов' : ''}`,
    `Имя: ${payload.name}`,
    `Телефон: ${payload.phone}`,
    payload.modelLabel ? `Модель: ${payload.modelLabel}` : null,
    slotLabel ? `Удобно: ${slotLabel}` : null,
    payload.trigger ? `Триггер: ${payload.trigger}` : null,
  ].filter(Boolean);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: lines.join('\n') }),
  });

  if (!res.ok) return { ok: false, error: await res.text() };
  return { ok: true };
}
