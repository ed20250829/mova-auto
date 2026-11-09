import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { expenses } from '../../../db/schema';
import { ensureDb } from '../../../lib/models';
import { csvEscape } from '../../../lib/format';
import { getFinanceSummary } from '../../../lib/admin-stats';

export const GET: APIRoute = async ({ url }) => {
  ensureDb();
  if (url.searchParams.get('format') === 'csv') {
    const summary = getFinanceSummary();
    const lines = [
      ['type', 'date', 'category', 'description', 'amount', 'currency'].join(';'),
      ...summary.orders.map((o) =>
        ['income', o.createdAt.slice(0, 10), 'order', o.modelLabel, o.price, 'BYN']
          .map(csvEscape)
          .join(';'),
      ),
      ...summary.expenses.map((e) =>
        ['expense', e.date, e.category, e.description, e.amount, e.currency]
          .map(csvEscape)
          .join(';'),
      ),
    ];
    return new Response(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="finance.csv"',
      },
    });
  }
  return json({ expenses: db.select().from(expenses).all() });
};

export const POST: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const result = db
    .insert(expenses)
    .values({
      date: String(body.date),
      category: String(body.category),
      description: String(body.description),
      amount: Number(body.amount),
      currency: String(body.currency || 'BYN'),
      recurring: Boolean(body.recurring),
      nextPaymentDate: body.nextPaymentDate || null,
      notes: body.notes || null,
    })
    .run();
  return json({ ok: true, id: Number(result.lastInsertRowid) }, 201);
};

export const DELETE: APIRoute = async ({ request }) => {
  ensureDb();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return json({ error: 'id required' }, 400);
  db.delete(expenses).where(eq(expenses.id, id)).run();
  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
