import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { orders } from '../../../db/schema';
import { ensureDb } from '../../../lib/models';

/**
 * Stub webhook for future bePaid (or other) notifications.
 * Without live keys: accepts JSON, optionally checks BEPAID_WEBHOOK_SECRET,
 * marks order paid idempotently by provider_payment_id.
 *
 * Expected body shape (flexible):
 * { orderId?, uid?|payment_id?|transaction_id?, amount?, status?: 'successful'|'paid'|... }
 */
export const POST: APIRoute = async ({ request }) => {
  ensureDb();

  const secret = process.env.BEPAID_WEBHOOK_SECRET || import.meta.env.BEPAID_WEBHOOK_SECRET;
  if (secret) {
    const header =
      request.headers.get('x-bepaid-signature') ||
      request.headers.get('x-webhook-secret') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (header !== secret) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const providerPaymentId = String(
    body.uid || body.payment_id || body.transaction_id || body.providerPaymentId || '',
  ).trim();
  const orderId = Number(body.orderId || body.order_id || body.tracking_id || 0);
  const statusRaw = String(body.status || body.state || '').toLowerCase();
  const success =
    !statusRaw ||
    ['successful', 'success', 'paid', 'completed', 'ok'].includes(statusRaw);

  if (!success) {
    return json({ ok: true, ignored: true, reason: 'non-success status', status: statusRaw });
  }

  if (!orderId && !providerPaymentId) {
    return json({ ok: false, error: 'orderId or provider payment id required' }, 400);
  }

  let row = orderId
    ? db.select().from(orders).where(eq(orders.id, orderId)).get()
    : null;

  if (!row && providerPaymentId) {
    row = db
      .select()
      .from(orders)
      .all()
      .find((o) => o.providerPaymentId === providerPaymentId) || null;
  }

  if (!row) {
    // Soft-accept so provider retries don't explode; log via response
    return json({ ok: true, matched: false, note: 'order not found — stub accepted' });
  }

  // Idempotent: already paid with same provider id
  if (row.paymentStatus === 'paid' && providerPaymentId && row.providerPaymentId === providerPaymentId) {
    return json({ ok: true, idempotent: true, orderId: row.id });
  }

  const amount =
    body.amount != null
      ? Math.round(Number(body.amount) / (Number(body.amount) > 1000 ? 100 : 1))
      : row.price;

  db.update(orders)
    .set({
      paymentStatus: 'paid',
      paidAt: new Date().toISOString(),
      paymentMethod: String(body.method || body.payment_method || 'card'),
      paymentProvider: String(body.provider || 'bepaid'),
      providerPaymentId: providerPaymentId || row.providerPaymentId,
      amountPaid: amount,
    })
    .where(eq(orders.id, row.id))
    .run();

  return json({ ok: true, orderId: row.id, paid: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
