import type { APIRoute } from 'astro';
import {
  createCase,
  deleteCase,
  listAllCases,
  saveCaseImage,
  updateCase,
} from '../../../lib/cases';
import { ensureDb } from '../../../lib/models';
import { db } from '../../../db';
import { portfolioCases } from '../../../db/schema';
import { eq } from 'drizzle-orm';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async () => {
  ensureDb();
  return json({ cases: listAllCases() });
};

export const POST: APIRoute = async ({ request }) => {
  ensureDb();
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const title = String(form.get('title') || '').trim();
    const description = String(form.get('description') || '').trim();
    const published = String(form.get('published') || '') === '1' || form.get('published') === 'true';
    const photo = form.get('photo');

    if (!title) return json({ error: 'title required' }, 400);
    if (!(photo instanceof File) || photo.size === 0) {
      return json({ error: 'photo required' }, 400);
    }
    if (photo.size > 8 * 1024 * 1024) {
      return json({ error: 'photo too large (max 8MB)' }, 400);
    }

    // Insert placeholder path, then rewrite after we know the id
    const id = createCase({
      title,
      description: description || 'Меню на русском · Минск',
      imagePath: '/uploads/cases/pending',
      published,
    });
    const imagePath = await saveCaseImage(photo, id);
    updateCase(id, { imagePath });
    const row = db.select().from(portfolioCases).where(eq(portfolioCases.id, id)).get();
    return json({ ok: true, case: row }, 201);
  }

  const body = await request.json();
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const imagePath = String(body.imagePath || '').trim();
  if (!title || !imagePath) return json({ error: 'title and imagePath required' }, 400);
  const id = createCase({
    title,
    description: description || 'Меню на русском · Минск',
    imagePath,
    published: Boolean(body.published),
    sortOrder: body.sortOrder != null ? Number(body.sortOrder) : 0,
  });
  const row = db.select().from(portfolioCases).where(eq(portfolioCases.id, id)).get();
  return json({ ok: true, case: row }, 201);
};

export const PATCH: APIRoute = async ({ request }) => {
  ensureDb();
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const id = Number(form.get('id'));
    if (!id) return json({ error: 'id required' }, 400);
    const patch: Parameters<typeof updateCase>[1] = {};
    if (form.has('title')) patch.title = String(form.get('title') || '');
    if (form.has('description')) patch.description = String(form.get('description') || '');
    if (form.has('published')) {
      patch.published = String(form.get('published')) === '1' || form.get('published') === 'true';
    }
    if (form.has('sortOrder')) patch.sortOrder = Number(form.get('sortOrder'));
    const photo = form.get('photo');
    if (photo instanceof File && photo.size > 0) {
      if (photo.size > 8 * 1024 * 1024) return json({ error: 'photo too large (max 8MB)' }, 400);
      patch.imagePath = await saveCaseImage(photo, id);
    }
    updateCase(id, patch);
    const row = db.select().from(portfolioCases).where(eq(portfolioCases.id, id)).get();
    return json({ ok: true, case: row });
  }

  const body = await request.json();
  const id = Number(body.id);
  if (!id) return json({ error: 'id required' }, 400);
  const patch: Parameters<typeof updateCase>[1] = {};
  if (body.title !== undefined) patch.title = String(body.title);
  if (body.description !== undefined) patch.description = String(body.description);
  if (body.imagePath !== undefined) patch.imagePath = String(body.imagePath);
  if (body.published !== undefined) patch.published = Boolean(body.published);
  if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder);
  updateCase(id, patch);
  const row = db.select().from(portfolioCases).where(eq(portfolioCases.id, id)).get();
  return json({ ok: true, case: row });
};

export const DELETE: APIRoute = async ({ request }) => {
  ensureDb();
  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id') || (await request.json().catch(() => ({}))).id);
  if (!id) return json({ error: 'id required' }, 400);
  deleteCase(id);
  return json({ ok: true });
};
