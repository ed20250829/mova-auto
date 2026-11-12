import { asc, eq, and } from 'drizzle-orm';
import { db, initSchema } from '../db';
import { models, type Model } from '../db/schema';
import { seedDatabase } from '../db/seed';
import { parseIssues } from './format';
import { syncOtaSubscriptionsFromOrders } from './ota';

let ready = false;

export function ensureDb() {
  if (ready) return;
  initSchema();
  seedDatabase(false);
  // Auto-create missing OTA subs for orders that already had the ota option.
  syncOtaSubscriptionsFromOrders();
  ready = true;
}

export type PublicModel = {
  id: number;
  brand: string;
  brandSlug: string;
  model: string;
  modelSlug: string;
  yearFrom: number;
  yearTo: number | null;
  generation: string | null;
  screenType: string;
  priceBase: number;
  timeMinutes: number;
  complexity: string;
  knownIssues: string[];
  requiresOtaSubscription: boolean;
  notes: string | null;
};

export function toPublicModel(m: Model): PublicModel {
  return {
    id: m.id,
    brand: m.brand,
    brandSlug: m.brandSlug,
    model: m.model,
    modelSlug: m.modelSlug,
    yearFrom: m.yearFrom,
    yearTo: m.yearTo,
    generation: m.generation,
    screenType: m.screenType,
    priceBase: m.priceBase,
    timeMinutes: m.timeMinutes,
    complexity: m.complexity,
    knownIssues: parseIssues(m.knownIssues),
    requiresOtaSubscription: Boolean(m.requiresOtaSubscription),
    notes: m.notes,
  };
}

export function getAllModels(activeOnly = true): PublicModel[] {
  ensureDb();
  const rows = activeOnly
    ? db.select().from(models).where(eq(models.active, true)).orderBy(asc(models.brand), asc(models.model)).all()
    : db.select().from(models).orderBy(asc(models.brand), asc(models.model)).all();
  return rows.map(toPublicModel);
}

export function getModelBySlug(brandSlug: string, modelSlug: string): PublicModel | null {
  ensureDb();
  const row = db
    .select()
    .from(models)
    .where(and(eq(models.brandSlug, brandSlug), eq(models.modelSlug, modelSlug)))
    .get();
  return row ? toPublicModel(row) : null;
}

export function getModelsByBrandSlug(brandSlug: string, activeOnly = true): PublicModel[] {
  return getAllModels(activeOnly).filter((m) => m.brandSlug === brandSlug);
}

export function getBrands(): string[] {
  const list = getAllModels();
  return [...new Set(list.map((m) => m.brand))];
}

export function getModelsGrouped() {
  const list = getAllModels();
  const map = new Map<string, PublicModel[]>();
  for (const m of list) {
    const arr = map.get(m.brand) ?? [];
    arr.push(m);
    map.set(m.brand, arr);
  }
  return map;
}

export function getRawModel(id: number): Model | undefined {
  ensureDb();
  return db.select().from(models).where(eq(models.id, id)).get();
}
