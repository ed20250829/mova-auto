import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { models } from '../../../db/schema';
import { ensureDb } from '../../../lib/models';

export const GET: APIRoute = async () => {
  ensureDb();
  const rows = db.select().from(models).all();
  return json({ models: rows });
};

export const POST: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const result = db
    .insert(models)
    .values({
      brand: String(body.brand),
      brandSlug: String(body.brandSlug),
      model: String(body.model),
      modelSlug: String(body.modelSlug),
      yearFrom: Number(body.yearFrom),
      yearTo: body.yearTo != null ? Number(body.yearTo) : null,
      generation: body.generation || null,
      screenType: String(body.screenType),
      priceBase: Number(body.priceBase),
      timeMinutes: Number(body.timeMinutes),
      complexity: String(body.complexity || 'medium'),
      knownIssues: JSON.stringify(body.knownIssues || []),
      requiresOtaSubscription: Boolean(body.requiresOtaSubscription),
      notes: body.notes || null,
      costBase: Number(body.costBase || 80),
      active: body.active !== false,
    })
    .run();
  return json({ ok: true, id: Number(result.lastInsertRowid) }, 201);
};

export const PATCH: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return json({ error: 'id required' }, 400);

  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const key of [
    'brand',
    'brandSlug',
    'model',
    'modelSlug',
    'generation',
    'screenType',
    'complexity',
    'notes',
  ] as const) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  if (body.yearFrom !== undefined) patch.yearFrom = Number(body.yearFrom);
  if (body.yearTo !== undefined) patch.yearTo = body.yearTo === null ? null : Number(body.yearTo);
  if (body.priceBase !== undefined) patch.priceBase = Number(body.priceBase);
  if (body.timeMinutes !== undefined) patch.timeMinutes = Number(body.timeMinutes);
  if (body.costBase !== undefined) patch.costBase = Number(body.costBase);
  if (body.requiresOtaSubscription !== undefined)
    patch.requiresOtaSubscription = Boolean(body.requiresOtaSubscription);
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.knownIssues !== undefined)
    patch.knownIssues = Array.isArray(body.knownIssues)
      ? JSON.stringify(body.knownIssues)
      : String(body.knownIssues);

  db.update(models).set(patch).where(eq(models.id, id)).run();
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return json({ error: 'id required' }, 400);
  db.update(models).set({ active: false }).where(eq(models.id, id)).run();
  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
