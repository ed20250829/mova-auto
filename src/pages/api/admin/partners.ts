import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { partners, orders } from '../../../db/schema';
import { ensureDb } from '../../../lib/models';

export const GET: APIRoute = async () => {
  ensureDb();
  const rows = db.select().from(partners).all();
  const allOrders = db.select().from(orders).all();
  const month = new Date().toISOString().slice(0, 7);
  const enriched = rows.map((p) => {
    const linked = allOrders.filter((o) => o.partnerId === p.id && o.createdAt.startsWith(month));
    const due = linked
      .filter((o) => o.status !== 'cancelled')
      .reduce((s, o) => s + (p.wholesalePrice ?? o.price), 0);
    return { ...p, monthOrders: linked.length, amountDue: due };
  });
  return json({ partners: enriched });
};

export const POST: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const result = db
    .insert(partners)
    .values({
      name: String(body.name),
      type: String(body.type || 'importer'),
      contactName: body.contactName || null,
      phone: body.phone || null,
      telegram: body.telegram || null,
      email: body.email || null,
      wholesalePrice: body.wholesalePrice != null ? Number(body.wholesalePrice) : null,
      commissionPercent: body.commissionPercent != null ? Number(body.commissionPercent) : 0,
      notes: body.notes || null,
      active: true,
    })
    .run();
  return json({ ok: true, id: Number(result.lastInsertRowid) }, 201);
};

export const PATCH: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return json({ error: 'id required' }, 400);
  const patch: Record<string, unknown> = {};
  for (const key of ['name', 'type', 'contactName', 'phone', 'telegram', 'email', 'notes'] as const) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  if (body.wholesalePrice !== undefined)
    patch.wholesalePrice = body.wholesalePrice === null ? null : Number(body.wholesalePrice);
  if (body.commissionPercent !== undefined) patch.commissionPercent = Number(body.commissionPercent);
  if (body.active !== undefined) patch.active = Boolean(body.active);
  db.update(partners).set(patch).where(eq(partners.id, id)).run();
  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
