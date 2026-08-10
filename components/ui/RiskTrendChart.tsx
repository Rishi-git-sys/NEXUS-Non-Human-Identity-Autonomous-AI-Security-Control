'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { RiskTrendPoint } from '@/lib/types/risk';

interface RiskTrendChartProps {
  data: RiskTrendPoint[];
}

export function RiskTrendChart({ data }: RiskTrendChartProps) {
  return (
    <div className="h-64 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--critical-text)" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="var(--critical-text)" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorBaseline" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--info-text)" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="var(--info-text)" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorViolations" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--warning-text)" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="var(--warning-text)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis 
            dataKey="day" 
            stroke="var(--muted-text)" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false}
            tick={{ fill: 'var(--muted-text)' }}
            dy={10}
          />
          <YAxis 
            stroke="var(--muted-text)" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false}
            tick={{ fill: 'var(--muted-text)' }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '11px', color: 'var(--primary-text)' }}
            itemStyle={{ fontSize: '11px', padding: '2px 0' }}
          />
          <Area type="monotone" dataKey="baseline" name="Baseline Traffic" stroke="var(--info-text)" strokeWidth={1.5} fillOpacity={1} fill="url(#colorBaseline)" />
          <Area type="monotone" dataKey="blocked" name="Blocked Attacks" stroke="var(--critical-text)" strokeWidth={1.5} fillOpacity={1} fill="url(#colorBlocked)" />
          <Area type="monotone" dataKey="violations" name="Policy Violations" stroke="var(--warning-text)" strokeWidth={1.5} fillOpacity={1} fill="url(#colorViolations)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
