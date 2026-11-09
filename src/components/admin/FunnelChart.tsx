import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function FunnelChart({ funnel }: { funnel: { step: string; count: number }[] }) {
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={funnel} layout="vertical" margin={{ left: 24, right: 8 }}>
          <CartesianGrid stroke="#22262a" strokeDasharray="3 3" />
          <XAxis type="number" stroke="#8a8580" fontSize={12} allowDecimals={false} />
          <YAxis type="category" dataKey="step" stroke="#8a8580" fontSize={11} width={100} />
          <Tooltip
            contentStyle={{ background: '#121416', border: '1px solid #2a3036', borderRadius: 8 }}
          />
          <Bar dataKey="count" name="События" fill="#ff5722" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
