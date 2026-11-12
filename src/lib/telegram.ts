import { desc, eq, like, or } from 'drizzle-orm';
import { db } from '../db';
import { orders, telegramBridges, telegramUsers } from '../db/schema';

export type InlineKeyboard = { text: string; callback_data?: string; url?: string }[][];

type BookingPayload = {
  orderId?: number;
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
  source?: string;
};

function env(name: string): string | undefined {
  return (import.meta.env[name] as string | undefined) || process.env[name];
}

export function telegramToken(): string | undefined {
  return env('TELEGRAM_BOT_TOKEN');
}

export function ownerChatId(): string | undefined {
  return env('TELEGRAM_CHAT_ID');
}

export function sitePhone(): string {
  return env('PUBLIC_PHONE') || '+375447149978';
}

export function siteUrl(): string {
  return (env('PUBLIC_SITE_URL') || 'https://mova-auto.tech').replace(/\/$/, '');
}

export function siteAddress(): string {
  return env('PUBLIC_ADDRESS') || 'Минск (точный адрес пришлём после подтверждения)';
}

type TgResult = { ok: boolean; skipped?: boolean; error?: string; result?: Record<string, unknown> };

async function api(method: string, body: Record<string, unknown>): Promise<TgResult> {
  const token = telegramToken();
  if (!token) return { ok: true, skipped: true };

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: Record<string, unknown>;
  };
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.description || (await res.text().catch(() => res.statusText)) };
  }
  return { ok: true, result: data.result };
}

export async function sendMessage(
  chatId: string | number,
  text: string,
  opts?: {
    replyMarkup?: { inline_keyboard: InlineKeyboard } | { remove_keyboard: true } | { keyboard: unknown; resize_keyboard?: boolean; one_time_keyboard?: boolean };
    replyToMessageId?: number;
    parseMode?: 'HTML' | 'Markdown';
  },
): Promise<TgResult> {
  return api('sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(opts?.parseMode ? { parse_mode: opts.parseMode } : {}),
    ...(opts?.replyToMessageId ? { reply_to_message_id: opts.replyToMessageId } : {}),
    ...(opts?.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
  });
}

export async function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  opts?: { replyMarkup?: { inline_keyboard: InlineKeyboard } },
): Promise<TgResult> {
  return api('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    disable_web_page_preview: true,
    ...(opts?.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
  });
}

export async function answerCallbackQuery(id: string, text?: string): Promise<TgResult> {
  return api('answerCallbackQuery', {
    callback_query_id: id,
    ...(text ? { text } : {}),
  });
}

export function inlineKeyboard(rows: InlineKeyboard) {
  return { inline_keyboard: rows };
}

export function btn(text: string, data: string) {
  return { text, callback_data: data };
}

export function urlBtn(text: string, url: string) {
  return { text, url };
}

function formatDateRu(iso?: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}`;
}

function weekdayRu(iso?: string) {
  if (!iso) return '';
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const dt = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return '';
  return days[dt.getDay()] || '';
}

export function formatSlotLabel(date?: string, slot?: string) {
  if (!date) return slot || '';
  const wd = weekdayRu(date);
  const d = formatDateRu(date);
  return [wd, d].filter(Boolean).join(' ') + (slot ? `, ${slot}` : '');
}

export async function notifyOwnerBooking(payload: BookingPayload): Promise<TgResult> {
  const chatId = ownerChatId();
  if (!chatId) return { ok: true, skipped: true };

  const sourceBits = [
    payload.source || 'сайт',
    payload.utm?.source,
    payload.utm?.medium,
    payload.utm?.campaign,
  ].filter(Boolean);

  const lines = [
    '🆕 Новая заявка',
    '',
    payload.modelLabel,
    formatSlotLabel(payload.date, payload.slot) || null,
    `${payload.name}, ${payload.phone}${payload.telegram ? ` · ${payload.telegram}` : ''}`,
    payload.price != null ? `${payload.price} BYN` : null,
    payload.promoCode ? `Промокод: ${payload.promoCode}` : null,
    payload.comment ? `Комментарий: ${payload.comment}` : null,
    `Источник: ${sourceBits.join(' / ')}`,
    payload.orderId ? `Заказ #${payload.orderId}` : null,
  ].filter(Boolean);

  const orderId = payload.orderId;
  const keyboard = orderId
    ? inlineKeyboard([
        [btn('✅ Подтвердить', `adm:ok:${orderId}`), btn('❌ Отменить', `adm:no:${orderId}`)],
        [btn('💬 Написать клиенту', `adm:msg:${orderId}`)],
        [urlBtn('Открыть админку', `${siteUrl()}/admin/orders`)],
      ])
    : undefined;

  return sendMessage(chatId, lines.join('\n'), {
    replyMarkup: keyboard,
  });
}

export function statusMessageForClient(order: {
  id: number;
  status: string;
  modelLabel: string;
  scheduledDate?: string | null;
  scheduledSlot?: string | null;
}): string {
  const when = formatSlotLabel(order.scheduledDate || undefined, order.scheduledSlot || undefined);
  const head = [order.modelLabel, when].filter(Boolean).join('\n');

  switch (order.status) {
    case 'confirmed':
      return [
        '✅ Подтверждено.',
        '',
        when ? `Ждём вас ${when}.` : 'Ждём вас в согласованное время.',
        `Адрес: ${siteAddress()}`,
        'Что взять: ключ, документы на машину.',
        'Время работы: 40–60 минут.',
      ].join('\n');
    case 'in_progress':
      return '⏰ Ваша машина в работе. Напишем, когда будет готова — обычно 40–60 минут.';
    case 'done':
      return [
        '✅ Готово. Можно забирать.',
        '',
        'Гарантия 6 месяцев.',
        'Если после OTA слетит русский — восстановим бесплатно по OTA-страховке.',
      ].join('\n');
    case 'cancelled':
      return `Заявка #${order.id} отменена. Если нужно другое время — напишите сюда или запишитесь заново.`;
    case 'new':
    default:
      return [
        head,
        '',
        'Статус: заявка принята, подтверждаем время.',
        'Обычно отвечаем в течение 15 минут.',
      ]
        .filter(Boolean)
        .join('\n');
  }
}

export function resolveClientChatId(opts: {
  chatId?: string | null;
  telegram?: string | null;
  phone?: string | null;
}): string | null {
  if (opts.chatId) return String(opts.chatId);

  const username = normalizeUsername(opts.telegram);
  if (username) {
    const byUser = db
      .select()
      .from(telegramUsers)
      .where(eq(telegramUsers.username, username))
      .get();
    if (byUser) return byUser.chatId;
  }

  const phoneDigits = digitsOnly(opts.phone);
  if (phoneDigits.length >= 9) {
    const byPhone = db
      .select()
      .from(telegramUsers)
      .where(like(telegramUsers.phone, `%${phoneDigits.slice(-9)}%`))
      .get();
    if (byPhone) return byPhone.chatId;
  }

  return null;
}

export async function notifyClientStatus(opts: {
  chatId?: string | null;
  phone?: string | null;
  telegram?: string | null;
  message: string;
  replyMarkup?: { inline_keyboard: InlineKeyboard };
}): Promise<TgResult> {
  const chatId = resolveClientChatId(opts);
  if (!chatId) return { ok: true, skipped: true };

  return sendMessage(chatId, opts.message, {
    replyMarkup: opts.replyMarkup,
  });
}

export async function notifyPartnerReady(message: string): Promise<TgResult> {
  const token = env('TELEGRAM_PARTNER_BOT_TOKEN');
  const chatId = env('TELEGRAM_PARTNER_CHAT_ID');
  if (!token || !chatId) return { ok: true, skipped: true };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });
  if (!res.ok) return { ok: false, error: await res.text() };
  return { ok: true };
}

export async function notifyOwnerCallback(payload: {
  name: string;
  phone: string;
  modelLabel?: string;
  preferredSlot?: string;
  afterHours: boolean;
  trigger?: string;
}): Promise<TgResult> {
  const chatId = ownerChatId();
  if (!chatId) return { ok: true, skipped: true };

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

  return sendMessage(chatId, lines.join('\n'));
}

export function upsertTelegramUser(input: {
  chatId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  state?: string;
  draft?: Record<string, unknown>;
}) {
  const existing = db.select().from(telegramUsers).where(eq(telegramUsers.chatId, input.chatId)).get();
  const now = new Date().toISOString();
  if (!existing) {
    db.insert(telegramUsers)
      .values({
        chatId: input.chatId,
        username: normalizeUsername(input.username) || null,
        firstName: input.firstName || null,
        lastName: input.lastName || null,
        phone: input.phone || null,
        state: input.state || 'idle',
        draft: JSON.stringify(input.draft || {}),
        updatedAt: now,
        createdAt: now,
      })
      .run();
    return;
  }

  const patch: Record<string, unknown> = { updatedAt: now };
  if (input.username !== undefined) patch.username = normalizeUsername(input.username) || null;
  if (input.firstName !== undefined) patch.firstName = input.firstName || null;
  if (input.lastName !== undefined) patch.lastName = input.lastName || null;
  if (input.phone !== undefined) patch.phone = input.phone || null;
  if (input.state !== undefined) patch.state = input.state;
  if (input.draft !== undefined) patch.draft = JSON.stringify(input.draft);
  db.update(telegramUsers).set(patch).where(eq(telegramUsers.chatId, input.chatId)).run();
}

export function getTelegramUser(chatId: string) {
  return db.select().from(telegramUsers).where(eq(telegramUsers.chatId, chatId)).get();
}

export function setUserState(chatId: string, state: string, draft?: Record<string, unknown>) {
  const existing = getTelegramUser(chatId);
  const nextDraft = draft ?? parseDraft(existing?.draft);
  upsertTelegramUser({
    chatId,
    username: existing?.username,
    firstName: existing?.firstName,
    lastName: existing?.lastName,
    phone: existing?.phone,
    state,
    draft: nextDraft,
  });
}

export function parseDraft(raw?: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function saveBridge(ownerMessageId: number, clientChatId: string) {
  db.insert(telegramBridges)
    .values({ ownerMessageId, clientChatId })
    .run();
}

export function findBridge(ownerMessageId: number) {
  return db
    .select()
    .from(telegramBridges)
    .where(eq(telegramBridges.ownerMessageId, ownerMessageId))
    .get();
}

export function findOrdersForClient(opts: { chatId?: string; username?: string | null; phone?: string | null }) {
  const clauses = [];
  if (opts.chatId) clauses.push(eq(orders.clientTelegramChatId, opts.chatId));
  const username = normalizeUsername(opts.username);
  if (username) {
    clauses.push(eq(orders.clientTelegram, `@${username}`));
    clauses.push(eq(orders.clientTelegram, username));
  }
  const phoneDigits = digitsOnly(opts.phone);
  if (phoneDigits.length >= 9) {
    clauses.push(like(orders.clientPhone, `%${phoneDigits.slice(-9)}%`));
  }
  if (!clauses.length) return [];
  return db
    .select()
    .from(orders)
    .where(or(...clauses))
    .orderBy(desc(orders.id))
    .limit(5)
    .all();
}

export function normalizeUsername(raw?: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim().replace(/^@/, '').toLowerCase();
  if (!v || v.includes(' ')) return null;
  return v;
}

export function digitsOnly(raw?: string | null): string {
  return (raw || '').replace(/\D/g, '');
}

export function isOwnerChat(chatId: string | number): boolean {
  const owner = ownerChatId();
  return Boolean(owner && String(owner) === String(chatId));
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

