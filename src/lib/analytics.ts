import { db, initSchema } from '../db';
import { events } from '../db/schema';

export type TrackInput = {
  name: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  device?: string | null;
  meta?: Record<string, unknown> | null;
};

export function trackEvent(input: TrackInput) {
  initSchema();
  db.insert(events)
    .values({
      name: input.name,
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      device: input.device ?? null,
      meta: input.meta ? JSON.stringify(input.meta) : null,
    })
    .run();
}

export function detectDevice(ua: string | null): 'mobile' | 'desktop' | 'tablet' {
  if (!ua) return 'desktop';
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobile|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}
