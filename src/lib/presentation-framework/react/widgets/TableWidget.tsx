'use client';

import React from 'react';
import { NormalizedWidgetData } from '../../core/types';

export function TableWidget({ data }: { data: NormalizedWidgetData }) {
  const table = data.tableData;

  if (!table || table.rows.length === 0) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
        Nenhum dado de tabela disponível.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(201, 169, 110, 0.25)', background: 'rgba(0,0,0,0.2)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
        <thead>
          <tr style={{ background: 'rgba(201, 169, 110, 0.08)', borderBottom: '1px solid rgba(201, 169, 110, 0.3)' }}>
            {table.columns.map((col, idx) => (
              <th
                key={idx}
                style={{
                  padding: '10px 14px',
                  textAlign: col.align || 'left',
                  color: '#c9a96e',
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rIdx) => (
            <tr
              key={rIdx}
              style={{
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                background: rIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
              }}
            >
              {table.columns.map((col, cIdx) => (
                <td
                  key={cIdx}
                  style={{
                    padding: '8px 14px',
                    textAlign: col.align || 'left',
                    color: cIdx === 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
                    fontWeight: cIdx === 0 ? 600 : 400,
                  }}
                >
                  {String(row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
