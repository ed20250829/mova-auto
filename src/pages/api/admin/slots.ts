import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { bookingSlots } from '../../../db/schema';
import { ensureDb } from '../../../lib/models';
import { listBookingSlots, normalizeSlotTime } from '../../../lib/slots';

export const GET: APIRoute = async () => {
  ensureDb();
  return json({ slots: listBookingSlots() });
};

export const POST: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const time = normalizeSlotTime(String(body.time || ''));
  if (!time) return json({ error: 'Время в формате ЧЧ:ММ, например 18:00' }, 400);

  const existing = listBookingSlots();
  if (existing.some((s) => s.time === time)) {
    return json({ error: 'Такой слот уже есть' }, 400);
  }

  const sortOrder =
    body.sortOrder != null ? Number(body.sortOrder) : existing.length ? Math.max(...existing.map((s) => s.sortOrder)) + 1 : 0;

  try {
    const result = db
      .insert(bookingSlots)
      .values({
        time,
        active: body.active !== false,
        sortOrder,
      })
      .run();
    const row = db.select().from(bookingSlots).where(eq(bookingSlots.id, Number(result.lastInsertRowid))).get();
    return json({ ok: true, slot: row }, 201);
  } catch {
    return json({ error: 'Не удалось создать слот' }, 400);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return json({ error: 'id required' }, 400);

  const patch: Record<string, unknown> = {};
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder);
  if (body.time !== undefined) {
    const time = normalizeSlotTime(String(body.time));
    if (!time) return json({ error: 'Время в формате ЧЧ:ММ' }, 400);
    patch.time = time;
  }
  if (!Object.keys(patch).length) return json({ error: 'nothing to update' }, 400);

  try {
    db.update(bookingSlots).set(patch).where(eq(bookingSlots.id, id)).run();
  } catch {
    return json({ error: 'Не удалось обновить (возможно, время уже занято)' }, 400);
  }

  const row = db.select().from(bookingSlots).where(eq(bookingSlots.id, id)).get();
  return json({ ok: true, slot: row });
};

export const DELETE: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return json({ error: 'id required' }, 400);
  db.delete(bookingSlots).where(eq(bookingSlots.id, id)).run();
  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
