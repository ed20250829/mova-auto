import { and, asc, desc, eq } from 'drizzle-orm';
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { db } from '../db';
import { portfolioCases, type PortfolioCase } from '../db/schema';
import { ensureDb } from './models';

export type PublicCase = {
  id: number;
  title: string;
  description: string;
  imagePath: string;
};

const UPLOAD_DIR = resolve(process.env.UPLOADS_PATH ?? './data/uploads/cases');
const PUBLIC_MIRROR = resolve('./public/uploads/cases');

export function getPublishedCases(): PublicCase[] {
  ensureDb();
  return db
    .select()
    .from(portfolioCases)
    .where(and(eq(portfolioCases.published, true)))
    .orderBy(asc(portfolioCases.sortOrder), desc(portfolioCases.createdAt))
    .all()
    .filter((c) => Boolean(c.imagePath?.trim()))
    .map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      imagePath: c.imagePath,
    }));
}

export function listAllCases(): PortfolioCase[] {
  ensureDb();
  return db
    .select()
    .from(portfolioCases)
    .orderBy(asc(portfolioCases.sortOrder), desc(portfolioCases.createdAt))
    .all();
}

function ensureDirs() {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  mkdirSync(PUBLIC_MIRROR, { recursive: true });
}

function safeExt(name: string) {
  const ext = extname(name || '').toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return ext;
  return '.jpg';
}

export async function saveCaseImage(file: File, caseId: number): Promise<string> {
  ensureDirs();
  const ext = safeExt(file.name);
  const filename = `case-${caseId}-${Date.now()}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const diskPath = join(UPLOAD_DIR, filename);
  writeFileSync(diskPath, buf);
  // Mirror into public for `astro preview` / static hosts that only serve public/
  try {
    writeFileSync(join(PUBLIC_MIRROR, filename), buf);
  } catch {
    // non-fatal on read-only public
  }
  return `/uploads/cases/${filename}`;
}

export function resolveCaseImageFile(filename: string): string | null {
  const clean = filename.replace(/[/\\]/g, '');
  if (!clean || clean.startsWith('.')) return null;
  const primary = join(UPLOAD_DIR, clean);
  if (existsSync(primary)) return primary;
  const mirror = join(PUBLIC_MIRROR, clean);
  if (existsSync(mirror)) return mirror;
  return null;
}

export function deleteCaseImageFile(imagePath: string | null | undefined) {
  if (!imagePath) return;
  const name = imagePath.split('/').pop();
  if (!name) return;
  for (const dir of [UPLOAD_DIR, PUBLIC_MIRROR]) {
    const full = join(dir, name);
    if (existsSync(full)) {
      try {
        unlinkSync(full);
      } catch {
        // ignore
      }
    }
  }
}

export function createCase(input: {
  title: string;
  description: string;
  imagePath: string;
  published?: boolean;
  sortOrder?: number;
}) {
  ensureDb();
  const result = db
    .insert(portfolioCases)
    .values({
      title: input.title.trim(),
      description: (input.description || '').trim(),
      imagePath: input.imagePath.trim(),
      published: Boolean(input.published),
      sortOrder: input.sortOrder ?? 0,
    })
    .run();
  return Number(result.lastInsertRowid);
}

export function updateCase(
  id: number,
  patch: Partial<{
    title: string;
    description: string;
    imagePath: string;
    published: boolean;
    sortOrder: number;
  }>,
) {
  ensureDb();
  const next: Record<string, unknown> = {
    updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
  if (patch.title !== undefined) next.title = patch.title.trim();
  if (patch.description !== undefined) next.description = patch.description.trim();
  if (patch.imagePath !== undefined) next.imagePath = patch.imagePath.trim();
  if (patch.published !== undefined) next.published = Boolean(patch.published);
  if (patch.sortOrder !== undefined) next.sortOrder = Number(patch.sortOrder);
  db.update(portfolioCases).set(next).where(eq(portfolioCases.id, id)).run();
}

export function deleteCase(id: number) {
  ensureDb();
  const row = db.select().from(portfolioCases).where(eq(portfolioCases.id, id)).get();
  if (row) deleteCaseImageFile(row.imagePath);
  db.delete(portfolioCases).where(eq(portfolioCases.id, id)).run();
}
