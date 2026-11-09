import type { APIRoute } from 'astro';
import { trackEvent, detectDevice } from '../../lib/analytics';
import { ensureDb } from '../../lib/models';

export const POST: APIRoute = async ({ request }) => {
  ensureDb();
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const name = String(body.name || '');
  if (!name) {
    return new Response(JSON.stringify({ error: 'name required' }), { status: 400 });
  }

  const ua = request.headers.get('user-agent');
  trackEvent({
    name,
    utmSource: (body.utmSource as string) || null,
    utmMedium: (body.utmMedium as string) || null,
    utmCampaign: (body.utmCampaign as string) || null,
    device: detectDevice(ua),
    meta: (body.meta as Record<string, unknown>) || null,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
