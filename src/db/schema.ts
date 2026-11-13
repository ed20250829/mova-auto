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

export const promoCodes = sqliteTable('promo_codes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  kind: text('kind').notNull().default('percent'), // percent | fixed
  value: integer('value').notNull(),
  firstOrderOnly: integer('first_order_only', { mode: 'boolean' }).notNull().default(true),
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').notNull().default(0),
  validFrom: text('valid_from'),
  validTo: text('valid_to'),
  channelNote: text('channel_note'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  clientName: text('client_name').notNull(),
  clientPhone: text('client_phone').notNull(),
  clientTelegram: text('client_telegram'),
  clientTelegramChatId: text('client_telegram_chat_id'),
  modelId: integer('model_id').references(() => models.id),
  modelLabel: text('model_label').notNull(),
  price: integer('price').notNull(),
  cost: integer('cost').notNull().default(80),
  status: text('status').notNull().default('new'), // new | confirmed | in_progress | done | cancelled
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
  promoCodeId: integer('promo_code_id').references(() => promoCodes.id),
  referralCode: text('referral_code'),
  paymentStatus: text('payment_status').notNull().default('unpaid'), // unpaid | pending | paid | refunded | failed
  paidAt: text('paid_at'),
  paymentMethod: text('payment_method'), // cash | transfer | erip | epos | card | krok | link | other
  paymentProvider: text('payment_provider'), // bepaid | webpay | assist | manual
  providerPaymentId: text('provider_payment_id'),
  amountPaid: integer('amount_paid'),
});

export const leads = sqliteTable('leads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  name: text('name'),
  phone: text('phone'),
  telegram: text('telegram'),
  modelLabel: text('model_label'),
  dropStep: text('drop_step'), // calc | form | contact | callback | partner
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  device: text('device'),
  notes: text('notes'),
  contacted: integer('contacted', { mode: 'boolean' }).notNull().default(false),
  /** new | contacted | booked | spam | closed */
  status: text('status').notNull().default('new'),
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
  /** ISO date of last auto/manual remind window */
  lastRemindAt: text('last_remind_at'),
  /** Days-before window that was last reminded (14|7|3|0) */
  lastRemindDays: integer('last_remind_days'),
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

/** Telegram bot contacts + FSM draft for conversational booking. */
export const telegramUsers = sqliteTable('telegram_users', {
  chatId: text('chat_id').primaryKey(),
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  phone: text('phone'),
  state: text('state').notNull().default('idle'),
  draft: text('draft').notNull().default('{}'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

/** Maps owner Telegram message_id → client chat for reply bridging. */
export const telegramBridges = sqliteTable('telegram_bridges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerMessageId: integer('owner_message_id').notNull(),
  clientChatId: text('client_chat_id').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

/** Editable booking time slots shown on site + Telegram bot. */
export const bookingSlots = sqliteTable('booking_slots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  time: text('time').notNull().unique(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

/**
 * Date-level availability overrides. Templates in booking_slots stay global;
 * a row here wins for that calendar day (site + bot).
 * slotTime null = whole day closed; otherwise that time only.
 */
export const slotClosures = sqliteTable('slot_closures', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  slotTime: text('slot_time'),
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

/** Published portfolio cases shown on the home page works section. */
export const portfolioCases = sqliteTable('portfolio_cases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(), // e.g. Geely Monjaro
  description: text('description').notNull().default(''),
  imagePath: text('image_path').notNull(), // /uploads/cases/...
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

/** Key/value site flags (admin kill-switches, etc.). */
export const siteSettings = sqliteTable('site_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export type Model = typeof models.$inferSelect;
export type PromoCode = typeof promoCodes.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Event = typeof events.$inferSelect;
export type TelegramUser = typeof telegramUsers.$inferSelect;
export type TelegramBridge = typeof telegramBridges.$inferSelect;
export type BookingSlot = typeof bookingSlots.$inferSelect;
export type SlotClosure = typeof slotClosures.$inferSelect;
export type PortfolioCase = typeof portfolioCases.$inferSelect;
export type SiteSetting = typeof siteSettings.$inferSelect;
