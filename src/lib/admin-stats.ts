import { db } from '../db';
import { orders, expenses, events, leads } from '../db/schema';
import { ensureDb } from './models';

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function isPaid(o: { paymentStatus: string | null; status: string }) {
  return o.paymentStatus === 'paid' && o.status !== 'cancelled';
}

function paidAmount(o: { amountPaid: number | null; price: number }) {
  return o.amountPaid != null ? o.amountPaid : o.price;
}

function paidDay(o: { paidAt: string | null }) {
  return (o.paidAt || '').slice(0, 10);
}

export function getDashboardStats() {
  ensureDb();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const week = daysAgo(7);
  const month = daysAgo(30);
  const prevMonthStart = daysAgo(60);
  const prevMonthEnd = daysAgo(30);

  const allOrders = db.select().from(orders).all();
  const paidOrders = allOrders.filter(isPaid);

  const inRange = (iso: string, from: string, to?: string) => {
    if (!iso || iso < from) return false;
    if (to && iso > to) return false;
    return true;
  };

  const weekPaid = paidOrders.filter((o) => inRange(o.paidAt || '', week));
  const monthPaid = paidOrders.filter((o) => inRange(o.paidAt || '', month));
  const todayPaid = paidOrders.filter((o) => paidDay(o) === today);
  const prevMonthPaid = paidOrders.filter((o) => inRange(o.paidAt || '', prevMonthStart, prevMonthEnd));

  // Operational counts still by createdAt
  const weekOrders = allOrders.filter((o) => inRange(o.createdAt, week));
  const monthOrders = allOrders.filter((o) => inRange(o.createdAt, month));
  const todayOrders = allOrders.filter((o) => o.createdAt.startsWith(today));
  const prevMonthOrders = allOrders.filter((o) => inRange(o.createdAt, prevMonthStart, prevMonthEnd));

  const revenue = (list: typeof paidOrders) => list.reduce((s, o) => s + paidAmount(o), 0);
  const avgCheck = (list: typeof paidOrders) => {
    if (!list.length) return 0;
    return Math.round(revenue(list) / list.length);
  };

  const allExpenses = db.select().from(expenses).all();
  const monthExpenses = allExpenses
    .filter((e) => e.date >= month.slice(0, 10))
    .reduce((s, e) => s + e.amount, 0);

  const modelCounts = new Map<string, number>();
  for (const o of monthOrders) {
    modelCounts.set(o.modelLabel, (modelCounts.get(o.modelLabel) || 0) + 1);
  }
  const topModels = [...modelCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const sourceCounts = new Map<string, number>();
  for (const o of monthOrders) {
    const key = o.utmSource || o.source || 'direct';
    sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1);
  }
  const topSources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  // daily series last 14 days — cash-basis revenue by paid_at
  const days: { day: string; orders: number; revenue: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const created = allOrders.filter((o) => o.createdAt.startsWith(key) && o.status !== 'cancelled');
    const paid = paidOrders.filter((o) => paidDay(o) === key);
    days.push({ day: key.slice(5), orders: created.length, revenue: revenue(paid) });
  }

  const leadsCount = db.select().from(leads).all().length;
  const conversion =
    monthOrders.length + leadsCount > 0
      ? Math.round((monthOrders.length / (monthOrders.length + leadsCount)) * 100)
      : monthOrders.length > 0
        ? 100
        : 0;

  return {
    today: { orders: todayOrders.length, revenue: revenue(todayPaid) },
    week: { orders: weekOrders.length, revenue: revenue(weekPaid), avg: avgCheck(weekPaid) },
    month: {
      orders: monthOrders.length,
      revenue: revenue(monthPaid),
      avg: avgCheck(monthPaid),
      conversion,
      profit: revenue(monthPaid) - monthExpenses,
      expenses: monthExpenses,
    },
    prevMonth: {
      orders: prevMonthOrders.length,
      revenue: revenue(prevMonthPaid),
    },
    topModels,
    topSources,
    days,
  };
}

export function getFinanceSummary() {
  ensureDb();
  const allOrders = db.select().from(orders).all();
  const paidOrders = allOrders.filter(isPaid);
  const allExpenses = db.select().from(expenses).all();

  const income = paidOrders.reduce((s, o) => s + paidAmount(o), 0);
  const costs = paidOrders.reduce((s, o) => s + o.cost, 0);
  const expenseSum = allExpenses.reduce((s, e) => s + e.amount, 0);

  const byCategory = new Map<string, number>();
  for (const e of allExpenses) {
    byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);
  }

  const marginByModel = new Map<string, { revenue: number; cost: number; count: number }>();
  for (const o of paidOrders) {
    const cur = marginByModel.get(o.modelLabel) || { revenue: 0, cost: 0, count: 0 };
    cur.revenue += paidAmount(o);
    cur.cost += o.cost;
    cur.count += 1;
    marginByModel.set(o.modelLabel, cur);
  }
  const margins = [...marginByModel.entries()]
    .map(([label, v]) => ({
      label,
      margin: v.revenue - v.cost,
      marginPct: v.revenue ? Math.round(((v.revenue - v.cost) / v.revenue) * 100) : 0,
      count: v.count,
    }))
    .sort((a, b) => b.margin - a.margin);

  const months: { month: string; income: number; expenses: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    months.push({
      month: key,
      income: paidOrders
        .filter((o) => (o.paidAt || '').startsWith(key))
        .reduce((s, o) => s + paidAmount(o), 0),
      expenses: allExpenses.filter((e) => e.date.startsWith(key)).reduce((s, e) => s + e.amount, 0),
    });
  }

  return {
    income,
    costs,
    expenseSum,
    balance: income - expenseSum,
    byCategory: [...byCategory.entries()],
    topProfitable: margins.slice(0, 5),
    topLoss: [...margins].sort((a, b) => a.margin - b.margin).slice(0, 5),
    months,
    orders: paidOrders,
    allOrders,
    expenses: allExpenses,
  };
}

export function getAnalytics() {
  ensureDb();
  const allEvents = db.select().from(events).all();
  const counts = (name: string) => allEvents.filter((e) => e.name === name).length;
  const funnel = [
    { step: 'Калькулятор', count: counts('calc_open') },
    { step: 'Выбор модели', count: counts('calc_model_select') },
    { step: 'Старт формы', count: counts('form_start') },
    { step: 'Сабмит', count: counts('form_submit') },
    { step: 'Успех', count: counts('form_success') },
  ];

  const sources = new Map<string, number>();
  for (const e of allEvents) {
    const key = e.utmSource || 'direct';
    sources.set(key, (sources.get(key) || 0) + 1);
  }

  const devices = new Map<string, number>();
  for (const e of allEvents) {
    const key = e.device || 'unknown';
    devices.set(key, (devices.get(key) || 0) + 1);
  }

  return {
    funnel,
    topSources: [...sources.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    devices: [...devices.entries()],
    totalEvents: allEvents.length,
  };
}
