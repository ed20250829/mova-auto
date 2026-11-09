import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const models = sqliteTable('models', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  brand: text('brand').notNull(),
  brandSlug: text('brand_slug').notNull(),
  model: text('model').notNull(),
  modelSlug: text('model_slug').notNull(),
  yearFrom: integer('year_from').notNull(),
  yearTo: integer('year_to'),
  generation: text('generation'),
  screenType: text('screen_type').notNull(),
  priceBase: integer('price_base').notNull(),
  timeMinutes: integer('time_minutes').notNull(),
  complexity: text('complexity').notNull(), // easy | medium | hard
  knownIssues: text('known_issues').notNull().default('[]'), // JSON array
  requiresOtaSubscription: integer('requires_ota_subscription', { mode: 'boolean' })
    .notNull()
    .default(false),
  notes: text('notes'),
  bodyStyle: text('body_style').notNull().default('crossover'), // sedan|hatch|crossover|suv|mpv|coupe|pickup
  imagePath: text('image_path'), // optional override under /vehicles/...
  costBase: integer('cost_base').notNull().default(80), // себестоимость
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const partners = sqliteTable('partners', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type').notNull().default('importer'), // importer | salon | diagnostic
  contactName: text('contact_name'),
  phone: text('phone'),
  telegram: text('telegram'),
  email: text('email'),
  wholesalePrice: integer('wholesale_price'),
  commissionPercent: real('commission_percent').default(0),
  notes: text('notes'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  clientName: text('client_name').notNull(),
  clientPhone: text('client_phone').notNull(),
  clientTelegram: text('client_telegram'),
  modelId: integer('model_id').references(() => models.id),
  modelLabel: text('model_label').notNull(),
  price: integer('price').notNull(),
  cost: integer('cost').notNull().default(80),
  status: text('status').notNull().default('new'), // new | in_progress | done | cancelled
  source: text('source').default('site'),
  partnerId: integer('partner_id').references(() => partners.id),
  scheduledDate: text('scheduled_date'),
  scheduledSlot: text('scheduled_slot'),
  comment: text('comment'),
  options: text('options').default('[]'), // JSON
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  promoCode: text('promo_code'),
  referralCode: text('referral_code'),
});

export const leads = sqliteTable('leads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  name: text('name'),
  phone: text('phone'),
  telegram: text('telegram'),
  modelLabel: text('model_label'),
  dropStep: text('drop_step'), // calc | form | contact
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  device: text('device'),
  notes: text('notes'),
  contacted: integer('contacted', { mode: 'boolean' }).notNull().default(false),
});

export const subscriptions = sqliteTable('subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientName: text('client_name').notNull(),
  clientPhone: text('client_phone').notNull(),
  clientTelegram: text('client_telegram'),
  modelLabel: text('model_label'),
  orderId: integer('order_id').references(() => orders.id),
  plan: text('plan').notNull().default('ota_year'), // ota_year
  price: integer('price').notNull().default(150),
  startedAt: text('started_at').notNull(),
  nextPaymentAt: text('next_payment_at').notNull(),
  status: text('status').notNull().default('active'), // active | paused | churned
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  category: text('category').notNull(), // equipment | subscription | ads | domain | hosting | tax | other
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('BYN'),
  recurring: integer('recurring', { mode: 'boolean' }).notNull().default(false),
  nextPaymentDate: text('next_payment_date'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  device: text('device'),
  meta: text('meta'), // JSON
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export type Model = typeof models.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Event = typeof events.$inferSelect;
