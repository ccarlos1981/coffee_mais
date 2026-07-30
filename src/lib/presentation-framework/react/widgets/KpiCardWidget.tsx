'use client';

import React from 'react';
import { NormalizedWidgetData } from '../../core/types';

export function KpiCardWidget({ data }: { data: NormalizedWidgetData }) {
  const metrics = data.metrics || [];

  if (metrics.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-white/50 border border-white/10 rounded-lg">
        Nenhum indicador para exibir.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(metrics.length, 4)}, 1fr)`, gap: '12px', width: '100%' }}>
      {metrics.map((m, idx) => (
        <div
          key={idx}
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(201, 169, 110, 0.25)',
            borderRadius: '8px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(201, 169, 110, 0.85)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {m.label}
          </span>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', fontFamily: 'Georgia, serif' }}>
              {m.value}
            </span>
            {m.target && (
              <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.4)' }}>
                / Meta: {m.target}
              </span>
            )}
          </div>

          {m.delta !== undefined && (
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: m.status === 'green' ? '#4ade80' : m.status === 'red' ? '#f87171' : '#c9a96e',
                  background: m.status === 'green' ? 'rgba(74, 222, 128, 0.1)' : m.status === 'red' ? 'rgba(248, 113, 113, 0.1)' : 'rgba(201, 169, 110, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}
              >
                Δ {m.delta}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
