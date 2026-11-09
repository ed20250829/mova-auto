import type { APIRoute } from 'astro';
import { ensureDb } from '../../../lib/models';
import { validatePromoCode } from '../../../lib/promo';
import { trackEvent, detectDevice } from '../../../lib/analytics';

export const POST: APIRoute = async ({ request }) => {
  ensureDb();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const result = validatePromoCode({
    code: body.code as string,
    phone: (body.phone as string) || null,
    // Calc preview: don't hard-fail first-order without phone
    enforceFirstOrder: Boolean(body.phone) || Boolean(body.enforceFirstOrder),
  });

  const device = detectDevice(request.headers.get('user-agent'));
  trackEvent({
    name: result.ok ? 'promo_apply' : 'promo_reject',
    utmSource: body.utmSource as string,
    utmMedium: body.utmMedium as string,
    utmCampaign: body.utmCampaign as string,
    device,
    meta: {
      code: result.ok ? result.code : (body.code as string) || null,
      error: result.ok ? null : result.error,
      source: body.source || 'validate',
    },
  });

  if (!result.ok) {
    return json({ ok: false, error: result.error, code: result.code || null }, 200);
  }

  return json({
    ok: true,
    code: result.code,
    message: result.message,
    kind: result.promo.kind,
    value: result.promo.value,
    firstOrderOnly: result.promo.firstOrderOnly,
    promoId: result.promo.id,
  });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
