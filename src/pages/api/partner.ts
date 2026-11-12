import type { APIRoute } from 'astro';
import { db } from '../../db';
import { leads } from '../../db/schema';
import { ensureDb } from '../../lib/models';
import { trackEvent, detectDevice } from '../../lib/analytics';
import { isAfterHoursMinsk, partnerSuccessCopy } from '../../lib/minsk-hours';
import { notifyOwnerPartnerLead } from '../../lib/telegram';
import { isValidPhone } from '../../lib/phone';

export const POST: APIRoute = async ({ request }) => {
  ensureDb();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const company = String(body.company || '').trim();
  const contactName = String(body.contactName || body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const comment = String(body.comment || '').trim() || null;
  const afterHours = isAfterHoursMinsk();

  const consent = body.consent === true || body.consent === 'true' || body.consent === 1 || body.consent === '1';
  if (!consent) {
    return json({ error: 'Нужно согласие на обработку персональных данных' }, 400);
  }

  if (company.length < 2 || contactName.length < 2 || !isValidPhone(phone)) {
    return json({ error: 'Проверьте компанию, контакт и телефон' }, 400);
  }

  const notes = JSON.stringify({
    kind: 'partner',
    company,
    comment,
    afterHours,
  });

  db.insert(leads)
    .values({
      name: contactName,
      phone,
      modelLabel: company,
      dropStep: 'partner',
      utmSource: (body.utmSource as string) || null,
      utmMedium: (body.utmMedium as string) || null,
      utmCampaign: (body.utmCampaign as string) || null,
      device: detectDevice(request.headers.get('user-agent')),
      notes,
    })
    .run();

  trackEvent({
    name: 'partner_lead_submit',
    utmSource: body.utmSource as string,
    utmMedium: body.utmMedium as string,
    utmCampaign: body.utmCampaign as string,
    device: detectDevice(request.headers.get('user-agent')),
    meta: { afterHours, company },
  });

  await notifyOwnerPartnerLead({
    company,
    contactName,
    phone,
    comment: comment || undefined,
    afterHours,
  });

  return json({
    ok: true,
    afterHours,
    message: partnerSuccessCopy(afterHours),
  });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
