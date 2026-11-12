import type { APIRoute } from 'astro';
import { db } from '../../db';
import { orders, leads, type PromoCode } from '../../db/schema';
import { ensureDb, getRawModel } from '../../lib/models';
import { notifyOwnerBooking, resolveClientChatId } from '../../lib/telegram';
import { trackEvent, detectDevice } from '../../lib/analytics';
import { computeOrderPrice } from '../../lib/pricing';
import { bumpPromoUsage, normalizePromoCode, validatePromoCode } from '../../lib/promo';
import { isValidPhone } from '../../lib/phone';
import { getFreeSlots, isActiveSlot } from '../../lib/slots';


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
  const rawPromo = normalizePromoCode(body.promoCode as string);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const consent = body.consent === true || body.consent === 'true' || body.consent === 1 || body.consent === '1';

  if (!consent) {
    return json({ error: 'Нужно согласие на обработку персональных данных' }, 400);
  }

  if (
    name.length < 2 ||
    !isValidPhone(phone) ||
    !modelId ||
    !date ||
    date < today ||
    !slot ||
    !isActiveSlot(slot) ||
    !getFreeSlots(date).includes(slot)
  ) {
    trackEvent({
      name: 'form_error',
      utmSource: body.utmSource as string,
      utmMedium: body.utmMedium as string,
      utmCampaign: body.utmCampaign as string,
      device: detectDevice(request.headers.get('user-agent')),
      meta: { reason: 'validation' },
    });
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

  let promoRow: PromoCode | null = null;
  let promoError: string | null = null;

  if (rawPromo) {
    const validated = validatePromoCode({
      code: rawPromo,
      phone,
      enforceFirstOrder: true,
    });
    if (validated.ok) {
      promoRow = validated.promo;
      trackEvent({
        name: 'promo_apply',
        utmSource: body.utmSource as string,
        utmMedium: body.utmMedium as string,
        utmCampaign: body.utmCampaign as string,
        device: detectDevice(request.headers.get('user-agent')),
        meta: { code: validated.code, source: 'booking' },
      });
    } else {
      promoError = validated.error;
      trackEvent({
        name: 'promo_reject',
        utmSource: body.utmSource as string,
        utmMedium: body.utmMedium as string,
        utmCampaign: body.utmCampaign as string,
        device: detectDevice(request.headers.get('user-agent')),
        meta: { code: rawPromo, error: validated.error, source: 'booking' },
      });
      // Soft fail: take booking without discount unless client insisted
      if (body.requirePromo) {
        return json({ error: validated.error, promoError: validated.error }, 400);
      }
    }
  }

  const { price, options, promoCode: normalizedPromo } = computeOrderPrice(model.priceBase, {
    ota: Boolean(body.ota),
    visit: Boolean(body.visit),
    appPack: Boolean(body.appPack),
    brand: model.brand,
    promo: promoRow,
    promoCode: promoRow ? promoRow.code : null,
  });

  const clientTelegramChatId = resolveClientChatId({
    telegram,
    phone,
  });

  const result = db
    .insert(orders)
    .values({
      clientName: name,
      clientPhone: phone,
      clientTelegram: telegram,
      clientTelegramChatId,
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
      promoCode: promoRow ? promoRow.code : null,
      promoCodeId: promoRow ? promoRow.id : null,
      paymentStatus: 'unpaid',
    })
    .run();

  const orderId = Number(result.lastInsertRowid);

  if (promoRow) {
    bumpPromoUsage(promoRow.id);
  }

  const tg = await notifyOwnerBooking({
    orderId,
    name,
    phone,
    telegram: telegram || undefined,
    modelLabel: `${model.brand} ${model.model}`,
    date,
    slot,
    comment: comment || undefined,
    price,
    promoCode: normalizedPromo || undefined,
    source: 'сайт',
    utm: {
      source: body.utmSource as string,
      medium: body.utmMedium as string,
      campaign: body.utmCampaign as string,
    },
  });

  const ics = buildIcs({
    title: `Мова: русификация ${model.brand} ${model.model}`,
    date,
    slot,
    description: `Заявка #${orderId}. Телефон: ${phone}`,
  });

  return json({
    ok: true,
    orderId,
    ics,
    price,
    promoCode: normalizedPromo,
    promoWarning: promoError,
    telegramSkipped: Boolean(tg.skipped),
  });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
