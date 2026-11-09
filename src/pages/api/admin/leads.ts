import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { leads } from '../../../db/schema';
import { ensureDb } from '../../../lib/models';

export const GET: APIRoute = async () => {
  ensureDb();
  return json({ leads: db.select().from(leads).all() });
};

export const PATCH: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return json({ error: 'id required' }, 400);
  db.update(leads)
    .set({
      contacted: body.contacted !== undefined ? Boolean(body.contacted) : true,
      notes: body.notes !== undefined ? String(body.notes) : undefined,
    })
    .where(eq(leads.id, id))
    .run();
  return json({ ok: true });
};

export const POST: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const result = db
    .insert(leads)
    .values({
      name: body.name || null,
      phone: body.phone || null,
      telegram: body.telegram || null,
      modelLabel: body.modelLabel || null,
      dropStep: body.dropStep || 'manual',
      notes: body.notes || null,
      utmSource: body.utmSource || null,
      utmMedium: body.utmMedium || null,
      utmCampaign: body.utmCampaign || null,
      device: body.device || null,
    })
    .run();
  return json({ ok: true, id: Number(result.lastInsertRowid) }, 201);
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
