import { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { Expense } from '../../db/schema';

type Props = {
  income: number;
  expenseSum: number;
  balance: number;
  byCategory: [string, number][];
  topProfitable: { label: string; margin: number; marginPct: number; count: number }[];
  topLoss: { label: string; margin: number; marginPct: number; count: number }[];
  months: { month: string; income: number; expenses: number }[];
  expenses: Expense[];
};

const CATEGORIES = ['equipment', 'subscription', 'ads', 'domain', 'hosting', 'tax', 'other'];

export default function FinancePanel(props: Props) {
  const [expenses, setExpenses] = useState(props.expenses);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: 'other',
    description: '',
    amount: '',
    recurring: false,
  });

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setExpenses((prev) => [
        {
          id: data.id,
          date: form.date,
          category: form.category,
          description: form.description,
          amount: Number(form.amount),
          currency: 'BYN',
          recurring: form.recurring,
          nextPaymentDate: null,
          notes: null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setForm({ ...form, description: '', amount: '' });
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.1rem' }}>
      <div className="admin-kpi">
        <article>
          <span>Доходы</span>
          <strong>{props.income} BYN</strong>
        </article>
        <article>
          <span>Расходы</span>
          <strong>{Math.round(props.expenseSum)} BYN</strong>
        </article>
        <article>
          <span>Баланс</span>
          <strong style={{ color: props.balance >= 0 ? '#3dd68c' : '#ff5c5c' }}>
            {Math.round(props.balance)} BYN
          </strong>
        </article>
        <article>
          <span>
            <a className="admin-btn ghost" href="/api/admin/expenses?format=csv">
              CSV для бухгалтера
            </a>
          </span>
        </article>
      </div>

      <div style={{ background: '#14171a', border: '1px solid #22262a', borderRadius: 12, padding: '1rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Доходы vs расходы</h2>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <ComposedChart data={props.months}>
              <CartesianGrid stroke="#22262a" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#8a8580" fontSize={12} />
              <YAxis stroke="#8a8580" fontSize={12} />
              <Tooltip
                contentStyle={{ background: '#121416', border: '1px solid #2a3036', borderRadius: 8 }}
              />
              <Legend />
              <Bar dataKey="income" name="Доходы" fill="#3dd68c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Расходы" fill="#ff5722" radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={{ background: '#14171a', border: '1px solid #22262a', borderRadius: 12, padding: '1rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Топ-5 прибыльных</h2>
          <ol>
            {props.topProfitable.map((m) => (
              <li key={m.label}>
                {m.label}: {m.margin} BYN ({m.marginPct}%)
              </li>
            ))}
            {props.topProfitable.length === 0 && <li style={{ color: '#8a8580' }}>Нет данных</li>}
          </ol>
        </div>
        <div style={{ background: '#14171a', border: '1px solid #22262a', borderRadius: 12, padding: '1rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Топ-5 слабых по марже</h2>
          <ol>
            {props.topLoss.map((m) => (
              <li key={m.label}>
                {m.label}: {m.margin} BYN ({m.marginPct}%)
              </li>
            ))}
            {props.topLoss.length === 0 && <li style={{ color: '#8a8580' }}>Нет данных</li>}
          </ol>
        </div>
      </div>

      <div style={{ background: '#14171a', border: '1px solid #22262a', borderRadius: 12, padding: '1rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Расходы по категориям</h2>
        <ul>
          {props.byCategory.map(([cat, amount]) => (
            <li key={cat}>
              {cat}: <strong>{Math.round(amount)} BYN</strong>
            </li>
          ))}
        </ul>
      </div>

      <form
        onSubmit={addExpense}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.5rem',
          background: '#14171a',
          padding: '0.9rem',
          borderRadius: 12,
          border: '1px solid #22262a',
        }}
      >
        <input
          className="admin-input"
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          required
        />
        <select
          className="admin-select"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          className="admin-input"
          placeholder="Описание"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
        />
        <input
          className="admin-input"
          placeholder="Сумма"
          type="number"
          step="0.01"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          required
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <input
            type="checkbox"
            checked={form.recurring}
            onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
          />
          recurring
        </label>
        <button className="admin-btn" type="submit">
          Добавить расход
        </button>
      </form>

      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Категория</th>
              <th>Описание</th>
              <th>Сумма</th>
              <th>Recurring</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td>{e.category}</td>
                <td>{e.description}</td>
                <td>
                  {e.amount} {e.currency}
                </td>
                <td>{e.recurring ? 'да' : 'нет'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
