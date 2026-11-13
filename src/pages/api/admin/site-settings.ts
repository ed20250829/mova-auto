import type { APIRoute } from 'astro';
import { ensureDb } from '../../../lib/models';
import { getShowSampleBanner, setShowSampleBanner } from '../../../lib/site-settings';

export const GET: APIRoute = async () => {
  ensureDb();
  return json({
    showSampleBanner: getShowSampleBanner(),
  });
};

export const PATCH: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json().catch(() => ({}));
  if (body.showSampleBanner === undefined) {
    return json({ error: 'showSampleBanner required' }, 400);
  }
  const on = setShowSampleBanner(Boolean(body.showSampleBanner));
  return json({ ok: true, showSampleBanner: on });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
