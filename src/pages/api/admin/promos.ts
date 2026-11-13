import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { promoCodes } from '../../../db/schema';
import { ensureDb } from '../../../lib/models';
import { normalizePromoCode } from '../../../lib/promo-shared';

export const GET: APIRoute = async () => {
  ensureDb();
  const rows = db.select().from(promoCodes).all();
  return json({ promos: rows });
};

export const POST: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const code = normalizePromoCode(body.code);
  if (!code || !body.value) return json({ error: 'code and value required' }, 400);

  try {
    const result = db
      .insert(promoCodes)
      .values({
        code,
        kind: String(body.kind || 'percent'),
        value: Number(body.value),
        firstOrderOnly: body.firstOrderOnly !== false,
        maxUses: body.maxUses != null && body.maxUses !== '' ? Number(body.maxUses) : null,
        usedCount: 0,
        validFrom: body.validFrom || null,
        validTo: body.validTo || null,
        channelNote: body.channelNote || null,
        active: body.active !== false,
      })
      .run();
    return json({ ok: true, id: Number(result.lastInsertRowid) }, 201);
  } catch {
    return json({ error: 'Не удалось создать (возможно, код уже есть)' }, 400);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return json({ error: 'id required' }, 400);

  const patch: Record<string, unknown> = {};
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.channelNote !== undefined) patch.channelNote = body.channelNote || null;
  if (body.maxUses !== undefined) {
    patch.maxUses = body.maxUses === '' || body.maxUses == null ? null : Number(body.maxUses);
  }
  if (body.validFrom !== undefined) patch.validFrom = body.validFrom || null;
  if (body.validTo !== undefined) patch.validTo = body.validTo || null;
  if (body.firstOrderOnly !== undefined) patch.firstOrderOnly = Boolean(body.firstOrderOnly);

  db.update(promoCodes).set(patch).where(eq(promoCodes.id, id)).run();
  const row = db.select().from(promoCodes).where(eq(promoCodes.id, id)).get();
  return json({ ok: true, promo: row });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
