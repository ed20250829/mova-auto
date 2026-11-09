import type { APIRoute } from 'astro';
import { db } from '../../db';
import { orders, leads } from '../../db/schema';
import { ensureDb, getRawModel } from '../../lib/models';
import { notifyOwnerBooking } from '../../lib/telegram';
import { trackEvent, detectDevice } from '../../lib/analytics';
import { computeOrderPrice } from '../../lib/pricing';

function isValidPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

function buildIcs(opts: { title: string; date: string; slot: string; description: string }) {
  const [hh, mm] = opts.slot.split(':').map(Number);
  const start = opts.date.replace(/-/g, '') + `T${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}00`;
  const endH = hh + 2;
  const end = opts.date.replace(/-/g, '') + `T${String(endH).padStart(2, '0')}${String(mm).padStart(2, '0')}00`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mova//Booking//RU',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${opts.title}`,
    `DESCRIPTION:${opts.description.replace(/\n/g, '\\n')}`,
    'LOCATION:Minsk, Belarus',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export const POST: APIRoute = async ({ request }) => {
  ensureDb();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const telegram = String(body.telegram || '').trim() || null;
  const modelId = Number(body.modelId);
  const date = String(body.date || '');
  const slot = String(body.slot || '');
  const comment = String(body.comment || '').trim() || null;
  const promoCode = String(body.promoCode || '').trim().toUpperCase() || null;
  const today = new Date().toISOString().slice(0, 10);

  if (name.length < 2 || !isValidPhone(phone) || !modelId || !date || date < today || !slot) {
    trackEvent({
      name: 'form_error',
      utmSource: body.utmSource as string,
      utmMedium: body.utmMedium as string,
      utmCampaign: body.utmCampaign as string,
      device: detectDevice(request.headers.get('user-agent')),
      meta: { reason: 'validation' },
    });
    // save as lead drop
    db.insert(leads)
      .values({
        name,
        phone,
        telegram,
        dropStep: 'form',
        utmSource: (body.utmSource as string) || null,
        utmMedium: (body.utmMedium as string) || null,
        utmCampaign: (body.utmCampaign as string) || null,
        device: detectDevice(request.headers.get('user-agent')),
        notes: 'Validation failed on booking',
      })
      .run();
    return json({ error: 'Проверьте поля формы' }, 400);
  }

  const model = getRawModel(modelId);
  if (!model) return json({ error: 'Модель не найдена' }, 404);

  // Recompute server-side from flags + DB base — never trust a client total.
  const { price, options, promoCode: normalizedPromo } = computeOrderPrice(model.priceBase, {
    ota: Boolean(body.ota),
    visit: Boolean(body.visit),
    appPack: Boolean(body.appPack),
    promoCode,
  });

  const result = db
    .insert(orders)
    .values({
      clientName: name,
      clientPhone: phone,
      clientTelegram: telegram,
      modelId: model.id,
      modelLabel: `${model.brand} ${model.model}`,
      price,
      cost: model.costBase,
      status: 'new',
      source: 'site',
      scheduledDate: date,
      scheduledSlot: slot,
      comment,
      options: JSON.stringify(options),
      utmSource: (body.utmSource as string) || null,
      utmMedium: (body.utmMedium as string) || null,
      utmCampaign: (body.utmCampaign as string) || null,
      promoCode: normalizedPromo,
    })
    .run();

  const orderId = Number(result.lastInsertRowid);

  const tg = await notifyOwnerBooking({
    name,
    phone,
    telegram: telegram || undefined,
    modelLabel: `${model.brand} ${model.model}`,
    date,
    slot,
    comment: comment || undefined,
    price,
    promoCode: normalizedPromo || undefined,
    utm: {
      source: body.utmSource as string,
      medium: body.utmMedium as string,
      campaign: body.utmCampaign as string,
    },
  });

  if (!tg.ok) {
    // order saved; telegram failed — still success for user
  }

  const ics = buildIcs({
    title: `Мова: русификация ${model.brand} ${model.model}`,
    date,
    slot,
    description: `Заявка #${orderId}. Телефон: ${phone}`,
  });

  return json({ ok: true, orderId, ics, telegramSkipped: Boolean(tg.skipped) });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
