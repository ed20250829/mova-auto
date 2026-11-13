import type { APIRoute } from 'astro';
import { ensureDb } from '../../../lib/models';
import {
  closeDay,
  closeSlot,
  dayClosureSummary,
  getActiveSlotTimes,
  listClosuresInRange,
  normalizeSlotTime,
  openDay,
  openSlot,
} from '../../../lib/slots';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ url }) => {
  ensureDb();
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const date = url.searchParams.get('date');

  if (date) {
    return json({
      date,
      ...dayClosureSummary(date),
      templateSlots: getActiveSlotTimes(),
    });
  }

  if (!from || !to) return json({ error: 'from and to required (YYYY-MM-DD)' }, 400);
  const rows = listClosuresInRange(from, to);
  const byDate: Record<string, { dayClosed: boolean; closedSlots: string[] }> = {};
  for (const row of rows) {
    if (!byDate[row.date]) byDate[row.date] = { dayClosed: false, closedSlots: [] };
    if (row.slotTime == null) byDate[row.date].dayClosed = true;
    else byDate[row.date].closedSlots.push(row.slotTime);
  }
  for (const d of Object.keys(byDate)) {
    byDate[d].closedSlots.sort();
  }
  return json({ from, to, closures: byDate, templateSlots: getActiveSlotTimes() });
};

export const POST: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json().catch(() => ({}));
  const date = String(body.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: 'date required (YYYY-MM-DD)' }, 400);
  }

  const action = String(body.action || '');
  try {
    if (action === 'close_day') {
      closeDay(date, body.note || null);
    } else if (action === 'open_day') {
      openDay(date);
    } else if (action === 'close_slot') {
      const time = normalizeSlotTime(String(body.slotTime || ''));
      if (!time) return json({ error: 'slotTime required' }, 400);
      closeSlot(date, time, body.note || null);
    } else if (action === 'open_slot') {
      const time = normalizeSlotTime(String(body.slotTime || ''));
      if (!time) return json({ error: 'slotTime required' }, 400);
      openSlot(date, time);
    } else {
      return json({ error: 'action: close_day | open_day | close_slot | open_slot' }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Ошибка' }, 400);
  }

  return json({ ok: true, date, ...dayClosureSummary(date) });
};
