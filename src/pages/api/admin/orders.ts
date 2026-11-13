import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { leads, orders } from '../../../db/schema';
import { ensureDb, getRawModel } from '../../../lib/models';
import { ensureOtaSubscriptionForOrder } from '../../../lib/ota';
import { isValidPhone } from '../../../lib/phone';
import { getFreeSlots, isActiveSlot, normalizeSlotTime } from '../../../lib/slots';
import {
  inlineKeyboard,
  notifyClientStatus,
  notifyOwnerBooking,
  notifyPartnerReady,
  resolveClientChatId,
  siteAddress,
  statusMessageForClient,
  urlBtn,
} from '../../../lib/telegram';
import { csvEscape } from '../../../lib/format';

export const POST: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json().catch(() => ({}));
  const name = String(body.clientName || body.name || '').trim();
  const phone = String(body.clientPhone || body.phone || '').trim();
  const telegram = String(body.clientTelegram || body.telegram || '').trim() || null;
  const modelId = body.modelId != null ? Number(body.modelId) : null;
  const modelLabel = String(body.modelLabel || '').trim();
  const date = String(body.scheduledDate || body.date || '').trim();
  const slotRaw = String(body.scheduledSlot || body.slot || '').trim();
  const slot = normalizeSlotTime(slotRaw);
  const price = body.price != null ? Number(body.price) : null;
  const comment = String(body.comment || '').trim() || null;
  const partnerId = body.partnerId ? Number(body.partnerId) : null;
  const leadId = body.leadId != null ? Number(body.leadId) : null;
  const status = String(body.status || 'confirmed');

  if (name.length < 2 || !isValidPhone(phone)) {
    return json({ error: 'Имя и телефон обязательны' }, 400);
  }
  if (!date || !slot) {
    return json({ error: 'Дата и слот обязательны' }, 400);
  }
  if (!isActiveSlot(slot)) {
    return json({ error: 'Слот не активен' }, 400);
  }
  if (!getFreeSlots(date).includes(slot)) {
    return json({ error: 'Слот уже занят' }, 400);
  }

  let resolvedLabel = modelLabel;
  let cost = body.cost != null ? Number(body.cost) : 80;
  let resolvedPrice = price;
  let resolvedModelId: number | null = modelId;

  if (modelId) {
    const model = getRawModel(modelId);
    if (!model) return json({ error: 'Модель не найдена' }, 404);
    resolvedLabel = `${model.brand} ${model.model}`;
    cost = body.cost != null ? Number(body.cost) : model.costBase;
    if (resolvedPrice == null) resolvedPrice = model.priceBase;
    resolvedModelId = model.id;
  }

  if (!resolvedLabel) return json({ error: 'Укажите модель' }, 400);
  if (resolvedPrice == null || Number.isNaN(resolvedPrice)) {
    return json({ error: 'Укажите цену' }, 400);
  }

  const chatId = resolveClientChatId({ telegram, phone });
  const result = db
    .insert(orders)
    .values({
      clientName: name,
      clientPhone: phone,
      clientTelegram: telegram,
      clientTelegramChatId: chatId,
      modelId: resolvedModelId,
      modelLabel: resolvedLabel,
      price: resolvedPrice,
      cost,
      status,
      source: String(body.source || 'admin'),
      partnerId,
      scheduledDate: date,
      scheduledSlot: slot,
      comment,
      options: '[]',
    })
    .run();

  const id = Number(result.lastInsertRowid);
  const row = db.select().from(orders).where(eq(orders.id, id)).get();
  if (row) ensureOtaSubscriptionForOrder(row);

  if (leadId) {
    db.update(leads)
      .set({ status: 'booked', contacted: true })
      .where(eq(leads.id, leadId))
      .run();
  }

  if (row && body.notifyOwner !== false) {
    await notifyOwnerBooking({
      name: row.clientName,
      phone: row.clientPhone,
      telegram: row.clientTelegram || undefined,
      modelLabel: row.modelLabel,
      price: row.price,
      date: row.scheduledDate || date,
      slot: row.scheduledSlot || slot,
      comment: row.comment || undefined,
      source: 'admin',
      orderId: row.id,
    }).catch(() => undefined);
  }

  return json({ ok: true, order: row }, 201);
};

export const PATCH: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return json({ error: 'id required' }, 400);

  const before = db.select().from(orders).where(eq(orders.id, id)).get();
  if (!before) return json({ error: 'not found' }, 404);

  const patch: Record<string, unknown> = {};
  if (body.status) patch.status = String(body.status);
  if (body.partnerId !== undefined) patch.partnerId = body.partnerId ? Number(body.partnerId) : null;
  if (body.price !== undefined) patch.price = Number(body.price);
  if (body.cost !== undefined) patch.cost = Number(body.cost);
  if (body.comment !== undefined) patch.comment = body.comment ? String(body.comment) : null;

  const nextDate =
    body.scheduledDate !== undefined ? String(body.scheduledDate || '') || null : before.scheduledDate;
  const nextSlotRaw =
    body.scheduledSlot !== undefined ? String(body.scheduledSlot || '') : before.scheduledSlot;
  const nextSlot = nextSlotRaw ? normalizeSlotTime(nextSlotRaw) : null;

  if (body.scheduledDate !== undefined || body.scheduledSlot !== undefined) {
    if (!nextDate || !nextSlot) {
      return json({ error: 'Дата и слот обязательны вместе' }, 400);
    }
    if (!isActiveSlot(nextSlot)) {
      return json({ error: 'Слот не активен' }, 400);
    }
    const free = getFreeSlots(nextDate, id);
    if (!free.includes(nextSlot)) {
      return json({ error: 'Слот уже занят' }, 400);
    }
    patch.scheduledDate = nextDate;
    patch.scheduledSlot = nextSlot;
  }

  if (body.markPaid) {
    patch.paymentStatus = 'paid';
    patch.paidAt = body.paidAt || new Date().toISOString();
    patch.paymentMethod = String(body.paymentMethod || 'cash');
    patch.paymentProvider = String(body.paymentProvider || 'manual');
    patch.amountPaid =
      body.amountPaid != null ? Number(body.amountPaid) : before.price ?? 0;
  } else if (body.paymentStatus) {
    patch.paymentStatus = String(body.paymentStatus);
    if (body.paymentStatus === 'paid') {
      patch.paidAt = body.paidAt || new Date().toISOString();
      if (body.paymentMethod) patch.paymentMethod = String(body.paymentMethod);
      if (body.paymentProvider) patch.paymentProvider = String(body.paymentProvider);
      if (body.amountPaid != null) patch.amountPaid = Number(body.amountPaid);
    }
    if (body.paymentStatus === 'unpaid') {
      patch.paidAt = null;
      patch.amountPaid = null;
    }
  }

  // Backfill chat id if client already talked to the bot.
  if (!before.clientTelegramChatId) {
    const chatId = resolveClientChatId({
      telegram: before.clientTelegram,
      phone: before.clientPhone,
    });
    if (chatId) patch.clientTelegramChatId = chatId;
  }

  db.update(orders).set(patch).where(eq(orders.id, id)).run();
  const row = db.select().from(orders).where(eq(orders.id, id)).get();

  // Safety net: if order has OTA option, ensure subscription exists (e.g. older orders).
  if (row) {
    ensureOtaSubscriptionForOrder(row);
  }

  const statusChanged = Boolean(body.status && body.status !== before.status);
  const shouldNotify =
    body.notifyClient === true ||
    (body.notifyClient !== false && statusChanged && body.status !== 'new');

  if (shouldNotify && row) {
    const replyMarkup =
      row.status === 'confirmed'
        ? inlineKeyboard([
            [urlBtn('Показать на карте', `https://maps.google.com/?q=${encodeURIComponent(siteAddress())}`)],
          ])
        : row.status === 'done'
          ? inlineKeyboard([[urlBtn('OTA на сайте', `${(import.meta.env.PUBLIC_SITE_URL as string) || 'https://mova-auto.tech'}/#ota`)]])
          : undefined;

    await notifyClientStatus({
      chatId: row.clientTelegramChatId,
      telegram: row.clientTelegram,
      phone: row.clientPhone,
      message: statusMessageForClient(row),
      replyMarkup,
    });
  }
  if (body.notifyPartner && row?.status === 'done') {
    await notifyPartnerReady(`Партнёр: заказ #${row.id} готов · ${row.modelLabel}`);
  }

  return json({ ok: true, order: row });
};

export const GET: APIRoute = async ({ url }) => {
  ensureDb();
  const format = url.searchParams.get('format');
  let rows = db.select().from(orders).all();

  const status = url.searchParams.get('status');
  const source = url.searchParams.get('source');
  const q = url.searchParams.get('q')?.toLowerCase();
  if (status) rows = rows.filter((r) => r.status === status);
  if (source) rows = rows.filter((r) => (r.utmSource || r.source) === source);
  if (q) {
    rows = rows.filter(
      (r) =>
        r.clientName.toLowerCase().includes(q) ||
        r.clientPhone.includes(q) ||
        r.modelLabel.toLowerCase().includes(q),
    );
  }

  if (format === 'csv') {
    const header = [
      'id',
      'created_at',
      'client',
      'phone',
      'model',
      'price',
      'cost',
      'margin',
      'status',
      'payment_status',
      'paid_at',
      'payment_method',
      'amount_paid',
      'promo_code',
      'source',
      'date',
      'slot',
    ];
    const lines = [
      header.join(';'),
      ...rows.map((r) =>
        [
          r.id,
          r.createdAt,
          r.clientName,
          r.clientPhone,
          r.modelLabel,
          r.price,
          r.cost,
          r.price - r.cost,
          r.status,
          r.paymentStatus || 'unpaid',
          r.paidAt || '',
          r.paymentMethod || '',
          r.amountPaid ?? '',
          r.promoCode || '',
          r.utmSource || r.source || '',
          r.scheduledDate || '',
          r.scheduledSlot || '',
        ]
          .map(csvEscape)
          .join(';'),
      ),
    ];
    return new Response(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="orders.csv"',
      },
    });
  }

  return json({ orders: rows });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
