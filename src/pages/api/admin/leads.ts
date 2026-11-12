import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { leads } from '../../../db/schema';
import {
  contactedFromStatus,
  isLeadStatus,
  statusFromContacted,
  type LeadStatus,
} from '../../../lib/leads';
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

  const patch: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!isLeadStatus(body.status)) {
      return json({ error: 'invalid status' }, 400);
    }
    const status = body.status as LeadStatus;
    patch.status = status;
    patch.contacted = contactedFromStatus(status);
  } else if (body.contacted !== undefined) {
    const contacted = Boolean(body.contacted);
    patch.contacted = contacted;
    patch.status = statusFromContacted(contacted);
  }

  if (body.notes !== undefined) patch.notes = String(body.notes);

  if (Object.keys(patch).length === 0) {
    return json({ error: 'nothing to update' }, 400);
  }

  db.update(leads).set(patch).where(eq(leads.id, id)).run();
  const row = db.select().from(leads).where(eq(leads.id, id)).get();
  return json({ ok: true, lead: row });
};

export const POST: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const status = isLeadStatus(body.status) ? body.status : 'new';
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
      status,
      contacted: contactedFromStatus(status),
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
