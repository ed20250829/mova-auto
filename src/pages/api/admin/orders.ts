import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { orders } from '../../../db/schema';
import { ensureDb } from '../../../lib/models';
import { notifyClientStatus, notifyPartnerReady } from '../../../lib/telegram';
import { csvEscape } from '../../../lib/format';

export const PATCH: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return json({ error: 'id required' }, 400);

  const patch: Record<string, unknown> = {};
  if (body.status) patch.status = String(body.status);
  if (body.partnerId !== undefined) patch.partnerId = body.partnerId ? Number(body.partnerId) : null;
  if (body.price !== undefined) patch.price = Number(body.price);
  if (body.cost !== undefined) patch.cost = Number(body.cost);

  db.update(orders).set(patch).where(eq(orders.id, id)).run();
  const row = db.select().from(orders).where(eq(orders.id, id)).get();

  if (body.notifyClient && row) {
    await notifyClientStatus({
      phone: row.clientPhone,
      message: `Мова: заказ #${row.id} — статус «${row.status}». Модель: ${row.modelLabel}.`,
    });
  }
  if (body.notifyPartner && row?.status === 'done') {
    await notifyPartnerReady(`Партнёр: заказ #${row.id} готов · ${row.modelLabel}`);
  }

  return json({ ok: true, order: row });
};

export const GET: APIRoute = async ({ url }) => {
  ensureDb();
  const format = url.searchParams.get('format');
  let rows = db.select().from(orders).all();

  const status = url.searchParams.get('status');
  const source = url.searchParams.get('source');
  const q = url.searchParams.get('q')?.toLowerCase();
  if (status) rows = rows.filter((r) => r.status === status);
  if (source) rows = rows.filter((r) => (r.utmSource || r.source) === source);
  if (q) {
    rows = rows.filter(
      (r) =>
        r.clientName.toLowerCase().includes(q) ||
        r.clientPhone.includes(q) ||
        r.modelLabel.toLowerCase().includes(q),
    );
  }

  if (format === 'csv') {
    const header = [
      'id',
      'created_at',
      'client',
      'phone',
      'model',
      'price',
      'cost',
      'margin',
      'status',
      'source',
      'date',
      'slot',
    ];
    const lines = [
      header.join(';'),
      ...rows.map((r) =>
        [
          r.id,
          r.createdAt,
          r.clientName,
          r.clientPhone,
          r.modelLabel,
          r.price,
          r.cost,
          r.price - r.cost,
          r.status,
          r.utmSource || r.source || '',
          r.scheduledDate || '',
          r.scheduledSlot || '',
        ]
          .map(csvEscape)
          .join(';'),
      ),
    ];
    return new Response(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="orders.csv"',
      },
    });
  }

  return json({ orders: rows });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
