import type { APIRoute } from 'astro';
import { db } from '../../db';
import { leads } from '../../db/schema';
import { ensureDb } from '../../lib/models';
import { trackEvent, detectDevice } from '../../lib/analytics';
import { callbackSuccessCopy, isAfterHoursMinsk } from '../../lib/minsk-hours';
import { notifyOwnerCallback } from '../../lib/telegram';
import { isValidPhone } from '../../lib/phone';


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
  const modelLabel = String(body.modelLabel || '').trim() || null;
  const preferredSlot = String(body.preferredSlot || '').trim() || null;
  const trigger = String(body.trigger || 'manual');
  const afterHours = isAfterHoursMinsk();

  if (name.length < 2 || !isValidPhone(phone)) {
    return json({ error: 'Проверьте имя и телефон' }, 400);
  }

  const notes = JSON.stringify({
    preferredSlot,
    afterHours,
    trigger,
  });

  db.insert(leads)
    .values({
      name,
      phone,
      modelLabel,
      dropStep: trigger === 'model_missing' ? 'model_missing' : 'callback',
      utmSource: (body.utmSource as string) || null,
      utmMedium: (body.utmMedium as string) || null,
      utmCampaign: (body.utmCampaign as string) || null,
      device: detectDevice(request.headers.get('user-agent')),
      notes,
    })
    .run();

  trackEvent({
    name: 'callback_submit',
    utmSource: body.utmSource as string,
    utmMedium: body.utmMedium as string,
    utmCampaign: body.utmCampaign as string,
    device: detectDevice(request.headers.get('user-agent')),
    meta: { trigger, afterHours, preferredSlot },
  });

  await notifyOwnerCallback({
    name,
    phone,
    modelLabel: modelLabel || undefined,
    preferredSlot: preferredSlot || undefined,
    afterHours,
    trigger,
  });

  return json({
    ok: true,
    afterHours,
    message: callbackSuccessCopy(afterHours),
  });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
