'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { getRiskColor } from '@/lib/risk-utils';

export function RiskGauge({ score }: { score: number }) {
  // Generate a mock distribution based on the total score
  const healthy = 100 - score;
  const critical = Math.max(0, score - 70);
  const high = Math.max(0, score - critical - 40);
  const medium = score - critical - high;

  const data = [
    { name: 'Critical', value: critical, color: 'var(--critical-text)' },
    { name: 'High', value: high, color: 'var(--warning-text)' },
    { name: 'Medium', value: medium, color: 'var(--info-text)' },
    { name: 'Healthy', value: healthy, color: 'var(--healthy-text)' },
  ].filter(d => d.value > 0);

  return (
    <div className="relative h-48 w-full flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute flex flex-col items-center justify-center bottom-4">
        <span className={`text-4xl font-bold ${getRiskColor(score)}`}>{score}</span>
        <span className="text-xs text-secondary mt-1 font-semibold">/ 100</span>
      </div>
    </div>
  );
}
