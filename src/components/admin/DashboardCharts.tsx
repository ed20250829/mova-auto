import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

type Day = { day: string; orders: number; revenue: number };

export default function DashboardCharts({ days }: { days: Day[] }) {
  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <ComposedChart data={days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#22262a" strokeDasharray="3 3" />
          <XAxis dataKey="day" stroke="#8a8580" fontSize={12} />
          <YAxis yAxisId="left" stroke="#8a8580" fontSize={12} allowDecimals={false} />
          <YAxis yAxisId="right" orientation="right" stroke="#8a8580" fontSize={12} />
          <Tooltip
            contentStyle={{ background: '#121416', border: '1px solid #2a3036', borderRadius: 8 }}
          />
          <Bar yAxisId="left" dataKey="orders" name="Заявки" fill="#ff5722" radius={[4, 4, 0, 0]} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="revenue"
            name="Выручка"
            stroke="#3dd68c"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
