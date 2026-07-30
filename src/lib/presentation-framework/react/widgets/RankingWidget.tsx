'use client';

import React from 'react';
import { NormalizedWidgetData } from '../../core/types';

export function RankingWidget({ data }: { data: NormalizedWidgetData }) {
  const ranking = data.rankingData || [];

  if (ranking.length === 0) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
        Nenhum dado de ranking disponível.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {ranking.map((item, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: '6px',
            background: item.highlight ? 'rgba(201, 169, 110, 0.12)' : 'rgba(255, 255, 255, 0.03)',
            border: item.highlight ? '1px solid rgba(201, 169, 110, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: idx === 0 ? '#c9a96e' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'rgba(255,255,255,0.1)',
                color: idx < 3 ? '#060606' : '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.rank || idx + 1}
            </span>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff' }}>
                {item.name}
              </div>
              {item.subtitle && (
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>
                  {item.subtitle}
                </div>
              )}
            </div>
          </div>

          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
