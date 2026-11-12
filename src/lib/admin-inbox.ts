import { db } from '../db';
import { leads, orders, type Lead, type Order, type Subscription } from '../db/schema';
import { ensureDb } from './models';
import { listOtaDueForInbox, syncOtaSubscriptionsFromOrders, todayMinsk } from './ota';

export type TodayInbox = {
  today: string;
  newOrders: Order[];
  openLeads: Lead[];
  otaDue: Subscription[];
  counts: {
    newOrders: number;
    openLeads: number;
    otaDue: number;
    total: number;
  };
  otaBackfill: { created: number; scanned: number };
};

function isOpenLead(lead: Lead): boolean {
  const status = lead.status || (lead.contacted ? 'contacted' : 'new');
  return status === 'new';
}

/** Operational inbox for two operators: what to handle today. */
export function getTodayInbox(): TodayInbox {
  ensureDb();
  const today = todayMinsk();
  const otaBackfill = syncOtaSubscriptionsFromOrders();

  const newOrders = db
    .select()
    .from(orders)
    .all()
    .filter((o) => o.status === 'new')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const openLeads = db
    .select()
    .from(leads)
    .all()
    .filter(isOpenLead)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const otaDue = listOtaDueForInbox(today, 7);

  return {
    today,
    newOrders,
    openLeads,
    otaDue,
    counts: {
      newOrders: newOrders.length,
      openLeads: openLeads.length,
      otaDue: otaDue.length,
      total: newOrders.length + openLeads.length + otaDue.length,
    },
    otaBackfill,
  };
}
