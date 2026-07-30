'use client';

import React from 'react';
import { NormalizedWidgetData } from '../../core/types';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer, Tooltip } from 'recharts';

export function RadarWidget({ data }: { data: NormalizedWidgetData }) {
  const radarData = data.radarData || [
    { subject: 'Volume', Meta: 100, Real: 92 },
    { subject: 'Faturamento', Meta: 100, Real: 96 },
    { subject: 'Investimento', Meta: 100, Real: 88 },
    { subject: 'Positivação', Meta: 100, Real: 104 },
    { subject: 'Ticket Médio', Meta: 100, Real: 95 },
    { subject: 'Preço Médio', Meta: 100, Real: 98 },
  ];

  return (
    <div style={{ width: '100%', height: '260px', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: '8px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
          <PolarGrid stroke="rgba(255,255,255,0.15)" />
          <PolarAngleAxis dataKey="subject" stroke="rgba(255,255,255,0.8)" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis angle={30} domain={[0, 120]} stroke="rgba(255,255,255,0.3)" />
          
          <Radar name="Meta (100%)" dataKey="Meta" stroke="rgba(255,255,255,0.4)" fill="rgba(255,255,255,0.05)" fillOpacity={0.4} />
          <Radar name="Real (%)" dataKey="Real" stroke="#c9a96e" fill="#c9a96e" fillOpacity={0.4} />
          
          <Legend wrapperStyle={{ fontSize: '11px', color: '#fff' }} />
          <Tooltip contentStyle={{ background: '#121212', border: '1px solid rgba(201,169,110,0.3)', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
