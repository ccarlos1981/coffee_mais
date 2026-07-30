'use client';

import React from 'react';
import { NormalizedWidgetData } from '../../core/types';

export function HeatmapWidget({ data }: { data: NormalizedWidgetData }) {
  const rawData = (data.raw as any) || {};
  const columns = rawData.columns || ['Mês Ant', 'Ano Ant', 'Meta', 'Real'];
  const rows = rawData.rows || [
    { label: 'Moído', values: [-8, -20, 100, 92] },
    { label: 'Grão', values: [-28, -28, 100, 72] },
    { label: 'Cápsula', values: [5, -1, 100, 105] },
    { label: 'Drip', values: [-30, -17, 100, 70] },
    { label: '1 KG', values: [-66, -69, 100, 34] },
  ];

  const getHeatmapColor = (val: number) => {
    if (val >= 100 || val > 0) return { bg: 'rgba(74, 222, 128, 0.18)', border: '#4ade80', text: '#4ade80' };
    if (val >= -10) return { bg: 'rgba(250, 204, 21, 0.18)', border: '#facc15', text: '#facc15' };
    return { bg: 'rgba(248, 113, 113, 0.18)', border: '#f87171', text: '#f87171' };
  };

  return (
    <div style={{ width: '100%', overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(201,169,110,0.25)', background: 'rgba(0,0,0,0.3)', padding: '12px' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '6px', fontSize: '0.78rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', color: '#c9a96e', padding: '6px', fontSize: '0.7rem', textTransform: 'uppercase' }}>Categoria</th>
            {columns.map((c: string, idx: number) => (
              <th key={idx} style={{ textAlign: 'center', color: '#c9a96e', padding: '6px', fontSize: '0.7rem', textTransform: 'uppercase' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, rIdx: number) => (
            <tr key={rIdx}>
              <td style={{ color: '#ffffff', fontWeight: 600, padding: '8px', whiteSpace: 'nowrap' }}>{r.label}</td>
              {r.values.map((val: number, vIdx: number) => {
                const style = getHeatmapColor(val);
                return (
                  <td
                    key={vIdx}
                    style={{
                      textAlign: 'center',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: style.bg,
                      border: `1px solid ${style.border}`,
                      color: style.text,
                      fontWeight: 700,
                      fontSize: '0.78rem',
                    }}
                  >
                    {val > 0 ? `+${val}%` : `${val}%`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
