import { and, count, eq } from 'drizzle-orm';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { db, initSchema, sqlite } from './index';
import { expenses, models, partners, portfolioCases } from './schema';
import { SEED_MODELS } from './seed-data';
import { ensureDefaultPromoCodes } from '../lib/promo';

const SEED_CASES = [
  { title: 'Geely Monjaro', description: 'Меню и настройки на русском', imagePath: '/cases/geely-cabin.jpg', sortOrder: 0 },
  { title: 'BYD Song Plus', description: 'DiLink · базовое меню RU', imagePath: '/cases/byd-cabin.jpg', sortOrder: 1 },
  { title: 'Zeekr 001', description: 'Меню RU · визит 2–3 часа', imagePath: '/cases/zeekr-cabin.jpg', sortOrder: 2 },
  { title: 'Li Auto L7', description: 'Меню RU · Li OS', imagePath: '/cases/li-cabin.jpg', sortOrder: 3 },
] as const;

export function seedDatabase(force = false) {
  initSchema();
  ensureDefaultPromoCodes();
  ensurePortfolioCases(force);

  const [{ value: modelCount }] = db.select({ value: count() }).from(models).all();
  if (modelCount > 0 && !force) {
    // Keep client-facing notes/issues in sync with seed without wiping orders.
    syncModelCopyFromSeed();
    ensureDomainExpense();
    return { models: modelCount, seeded: false };
  }

  if (force) {
    sqlite.exec('DELETE FROM models');
  }

  for (const m of SEED_MODELS) {
    db.insert(models)
      .values({
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
        knownIssues: JSON.stringify(m.knownIssues),
        requiresOtaSubscription: m.requiresOtaSubscription,
        notes: m.notes,
        bodyStyle: 'crossover',
        imagePath: null,
        costBase: m.costBase,
        active: true,
      })
      .run();
  }

  const [{ value: partnerCount }] = db.select({ value: count() }).from(partners).all();
  if (partnerCount === 0) {
    db.insert(partners)
      .values([
        {
          name: 'ИмпортАвто Минск',
          type: 'importer',
          contactName: 'Алексей',
          phone: '+375291112233',
          telegram: '@import_auto_minsk',
          wholesalePrice: 480,
          commissionPercent: 0,
          notes: 'Пример партнёра. Заменить на реальных.',
          active: true,
        },
        {
          name: 'ДиагностПро',
          type: 'diagnostic',
          contactName: 'Игорь',
          phone: '+375297776655',
          telegram: '@diagpro_by',
          wholesalePrice: null,
          commissionPercent: 10,
          notes: 'Партнёрка с диагностами: 10% с приведённого заказа.',
          active: true,
        },
      ])
      .run();
  }

  ensureDomainExpense();

  const [{ value: finalCount }] = db.select({ value: count() }).from(models).all();
  return { models: finalCount, seeded: true };
}

function syncModelCopyFromSeed() {
  for (const m of SEED_MODELS) {
    const row = db
      .select({ id: models.id })
      .from(models)
      .where(and(eq(models.brandSlug, m.brandSlug), eq(models.modelSlug, m.modelSlug)))
      .get();
    if (!row) {
      db.insert(models)
        .values({
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
          knownIssues: JSON.stringify(m.knownIssues),
          requiresOtaSubscription: m.requiresOtaSubscription,
          notes: m.notes,
          bodyStyle: 'crossover',
          imagePath: null,
          costBase: m.costBase,
          active: true,
        })
        .run();
      continue;
    }
    db.update(models)
      .set({
        priceBase: m.priceBase,
        timeMinutes: m.timeMinutes,
        complexity: m.complexity,
        screenType: m.screenType,
        generation: m.generation,
        knownIssues: JSON.stringify(m.knownIssues),
        notes: m.notes,
        requiresOtaSubscription: m.requiresOtaSubscription,
        costBase: m.costBase,
      })
      .where(eq(models.id, row.id))
      .run();
  }
}

function ensureDomainExpense() {
  const existing = db
    .select()
    .from(expenses)
    .all()
    .find((e) => e.description.includes('mova-auto.tech'));

  if (!existing) {
    db.insert(expenses)
      .values({
        date: '2026-11-09',
        category: 'domain',
        description: 'Домен mova-auto.tech',
        amount: 14,
        currency: 'BYN',
        recurring: true,
        nextPaymentDate: '2027-11-09',
        notes: 'Стартовый расход. Уже оплачен.',
      })
      .run();
  }
}

/** Seed / sync home portfolio cases (RF cabin stills under /public/cases). */
function ensurePortfolioCases(force = false) {
  if (force) {
    sqlite.exec('DELETE FROM portfolio_cases');
  }

  for (const c of SEED_CASES) {
    const disk = resolve(`./public${c.imagePath}`);
    if (!existsSync(disk)) {
      console.warn(`[seed] missing case image ${c.imagePath} — skip row`);
      continue;
    }
    const existing = db
      .select()
      .from(portfolioCases)
      .where(eq(portfolioCases.title, c.title))
      .get();
    if (existing) {
      db.update(portfolioCases)
        .set({
          description: c.description,
          imagePath: c.imagePath,
          published: true,
          sortOrder: c.sortOrder,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(portfolioCases.id, existing.id))
        .run();
      continue;
    }
    db.insert(portfolioCases)
      .values({
        title: c.title,
        description: c.description,
        imagePath: c.imagePath,
        published: true,
        sortOrder: c.sortOrder,
      })
      .run();
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed.ts')) {
  const result = seedDatabase(process.argv.includes('--force'));
  console.log(`Seed complete: ${result.models} models (seeded=${result.seeded})`);
}
