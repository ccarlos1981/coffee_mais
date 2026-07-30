'use client';

import React from 'react';
import { NormalizedWidgetData } from '../../core/types';

export function GaugeWidget({ data }: { data: NormalizedWidgetData }) {
  const metric = data.metrics?.[0] || { label: 'Atingimento da Meta', value: '96,5%', percentage: 96.5, target: '100,0%' };
  const pct = Math.min(Math.max(Number(metric.percentage || 96.5), 0), 120);

  const getColor = (val: number) => {
    if (val >= 100) return '#4ade80';
    if (val >= 85) return '#c9a96e';
    return '#f87171';
  };

  const currentColor = getColor(pct);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: '8px' }}>
      <div style={{ position: 'relative', width: '160px', height: '90px', display: 'flex', justifyContent: 'center' }}>
        {/* Semi-circle arc SVG */}
        <svg width="160" height="90" viewBox="0 0 160 90">
          <path d="M 15 80 A 65 65 0 0 1 145 80" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="14" strokeLinecap="round" />
          <path
            d="M 15 80 A 65 65 0 0 1 145 80"
            fill="none"
            stroke={currentColor}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray="204"
            strokeDashoffset={204 - (204 * Math.min(pct, 100)) / 100}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', bottom: '0', textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', fontFamily: 'Georgia, serif' }}>
            {metric.value}
          </div>
        </div>
      </div>

      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>
        Meta: {metric.target || '100,0%'}
      </div>
    </div>
  );
}
