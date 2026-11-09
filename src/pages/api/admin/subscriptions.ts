import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { subscriptions } from '../../../db/schema';
import { ensureDb } from '../../../lib/models';
import { notifyClientStatus } from '../../../lib/telegram';

export const GET: APIRoute = async () => {
  ensureDb();
  const rows = db.select().from(subscriptions).all();
  const active = rows.filter((r) => r.status === 'active');
  const mrr = active.reduce((s, r) => s + r.price, 0) / 12; // yearly plan → monthly
  const churned = rows.filter((r) => r.status === 'churned').length;
  const churn = rows.length ? Math.round((churned / rows.length) * 100) : 0;
  return json({ subscriptions: rows, mrr: Math.round(mrr), churn });
};

export const POST: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const started = String(body.startedAt || new Date().toISOString().slice(0, 10));
  const next = String(body.nextPaymentAt || nextYear(started));
  const result = db
    .insert(subscriptions)
    .values({
      clientName: String(body.clientName),
      clientPhone: String(body.clientPhone),
      clientTelegram: body.clientTelegram || null,
      modelLabel: body.modelLabel || null,
      orderId: body.orderId ? Number(body.orderId) : null,
      plan: body.plan || 'ota_year',
      price: Number(body.price || 150),
      startedAt: started,
      nextPaymentAt: next,
      status: 'active',
      notes: body.notes || null,
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
  if (body.status) patch.status = String(body.status);
  if (body.nextPaymentAt) patch.nextPaymentAt = String(body.nextPaymentAt);
  if (body.notes !== undefined) patch.notes = body.notes;
  db.update(subscriptions).set(patch).where(eq(subscriptions.id, id)).run();

  if (body.remind) {
    const row = db.select().from(subscriptions).where(eq(subscriptions.id, id)).get();
    if (row) {
      await notifyClientStatus({
        phone: row.clientPhone,
        message: `Мова: напоминание об OTA-страховке. Следующий платёж ${row.nextPaymentAt}.`,
      });
    }
  }
  return json({ ok: true });
};

function nextYear(iso: string) {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
