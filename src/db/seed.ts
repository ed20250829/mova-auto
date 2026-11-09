import { count } from 'drizzle-orm';
import { db, initSchema, sqlite } from './index';
import { expenses, models, partners } from './schema';
import { SEED_MODELS } from './seed-data';
import { ensureDefaultPromoCodes } from '../lib/promo';

export function seedDatabase(force = false) {
  initSchema();
  ensureDefaultPromoCodes();

  const [{ value: modelCount }] = db.select({ value: count() }).from(models).all();
  if (modelCount > 0 && !force) {
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

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed.ts')) {
  const result = seedDatabase(process.argv.includes('--force'));
  console.log(`Seed complete: ${result.models} models (seeded=${result.seeded})`);
}
