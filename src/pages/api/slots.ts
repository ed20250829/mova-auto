import type { APIRoute } from 'astro';
import { ensureDb } from '../../lib/models';
import { getActiveSlotTimes, getFreeSlots } from '../../lib/slots';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  ensureDb();
  const date = url.searchParams.get('date');
  if (date) {
    return json({ slots: getFreeSlots(date), date });
  }
  return json({ slots: getActiveSlotTimes() });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
