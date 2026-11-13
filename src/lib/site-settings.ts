import { eq } from 'drizzle-orm';
import { db } from '../db';
import { siteSettings } from '../db/schema';

export const SHOW_SAMPLE_BANNER_KEY = 'show_sample_banner';

function truthy(raw: string | null | undefined) {
  const v = String(raw ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/** Admin kill-switch: OFF (default) always wins over env / DEV. */
export function getShowSampleBanner(): boolean {
  const row = db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, SHOW_SAMPLE_BANNER_KEY))
    .get();
  if (!row) return false;
  return truthy(row.value);
}

export function setShowSampleBanner(on: boolean) {
  const value = on ? '1' : '0';
  const updatedAt = new Date().toISOString();
  const existing = db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, SHOW_SAMPLE_BANNER_KEY))
    .get();
  if (existing) {
    db.update(siteSettings)
      .set({ value, updatedAt })
      .where(eq(siteSettings.key, SHOW_SAMPLE_BANNER_KEY))
      .run();
  } else {
    db.insert(siteSettings)
      .values({ key: SHOW_SAMPLE_BANNER_KEY, value, updatedAt })
      .run();
  }
  return on;
}
