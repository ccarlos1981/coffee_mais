'use client';

import React from 'react';
import { NormalizedWidgetData } from '../../core/types';

export function WaterfallWidget({ data }: { data: NormalizedWidgetData }) {
  const steps = [
    { label: 'Receita Bruta', value: 1250000, type: 'positive' },
    { label: 'Deduções / Impostos', value: -150000, type: 'negative' },
    { label: 'Receita Líquida', value: 1100000, type: 'subtotal' },
    { label: 'CPV (Custo Produto)', value: -620000, type: 'negative' },
    { label: 'Frete (3%)', value: -33000, type: 'negative' },
    { label: 'Investimento Comercial', value: -110000, type: 'negative' },
    { label: 'MACO Final', value: 337000, type: 'total' },
  ];

  const formatBrl = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div style={{ width: '100%', padding: '16px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: '8px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {steps.map((step, idx) => {
          const isNegative = step.value < 0;
          const color = step.type === 'total' || step.type === 'subtotal' ? '#c9a96e' : isNegative ? '#f87171' : '#4ade80';

          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ fontSize: '0.78rem', color: step.type === 'total' ? '#ffffff' : 'rgba(255,255,255,0.85)', fontWeight: step.type === 'total' ? 700 : 500 }}>
                {step.label}
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color, fontFamily: 'Georgia, serif' }}>
                {formatBrl(step.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
