export const LEAD_STATUSES = ['new', 'contacted', 'booked', 'spam', 'closed'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Новый',
  contacted: 'Позвонили',
  booked: 'Записали',
  spam: 'Спам',
  closed: 'Закрыт',
};

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === 'string' && (LEAD_STATUSES as readonly string[]).includes(value);
}

/** Keep legacy boolean in sync with status. */
export function contactedFromStatus(status: LeadStatus): boolean {
  return status !== 'new';
}

export function statusFromContacted(contacted: boolean): LeadStatus {
  return contacted ? 'contacted' : 'new';
}
