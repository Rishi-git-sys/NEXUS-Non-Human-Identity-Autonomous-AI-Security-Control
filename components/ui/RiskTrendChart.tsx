'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const mockTrendData = [
  { day: 'Day 1', blocked: 12, baseline: 45 },
  { day: 'Day 2', blocked: 15, baseline: 52 },
  { day: 'Day 3', blocked: 8, baseline: 48 },
  { day: 'Day 4', blocked: 22, baseline: 60 },
  { day: 'Day 5', blocked: 18, baseline: 55 },
  { day: 'Day 6', blocked: 10, baseline: 42 },
  { day: 'Day 7', blocked: 14, baseline: 49 },
  { day: 'Day 8', blocked: 9, baseline: 50 },
  { day: 'Day 9', blocked: 16, baseline: 58 },
  { day: 'Day 10', blocked: 20, baseline: 65 },
  { day: 'Day 11', blocked: 11, baseline: 47 },
  { day: 'Day 12', blocked: 13, baseline: 51 },
  { day: 'Day 13', blocked: 17, baseline: 54 },
  { day: 'Day 14', blocked: 19, baseline: 59 },
];

export function RiskTrendChart() {
  return (
    <div className="h-64 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={mockTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ff6b6b" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorBaseline" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5b9dff" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#5b9dff" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="day" 
            stroke="#6b6e75" 
            fontSize={11} 
            tickLine={false} 
            axisLine={false}
            tick={{ fill: '#6b6e75' }}
            dy={10}
          />
          <YAxis 
            stroke="#6b6e75" 
            fontSize={11} 
            tickLine={false} 
            axisLine={false}
            tick={{ fill: '#6b6e75' }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#111318', borderColor: '#23262b', borderRadius: '8px', fontSize: '12px', color: '#e8e8e6' }}
            itemStyle={{ fontSize: '12px' }}
          />
          <Area type="monotone" dataKey="baseline" name="Baseline Actions" stroke="#5b9dff" fillOpacity={1} fill="url(#colorBaseline)" />
          <Area type="monotone" dataKey="blocked" name="Blocked Actions" stroke="#ff6b6b" fillOpacity={1} fill="url(#colorBlocked)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
