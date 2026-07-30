'use client';

import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { NormalizedWidgetData } from '../../core/types';

export function LineChartWidget({ data }: { data: NormalizedWidgetData }) {
  const chartData = data.chartData || [];

  if (chartData.length === 0) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
        Nenhum dado de linha disponível.
      </div>
    );
  }

  const keys = Object.keys(chartData[0] || {}).filter(k => k !== 'name');

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} />
          <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: '#141414',
              borderColor: 'rgba(201,169,110,0.4)',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '0.75rem',
            }}
          />
          {keys.map((key, idx) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={idx === 0 ? '#c9a96e' : idx === 1 ? '#a07840' : '#60a5fa'}
              strokeWidth={2}
              dot={{ r: 3, fill: '#c9a96e' }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
