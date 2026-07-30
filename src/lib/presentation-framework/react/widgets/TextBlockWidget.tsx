'use client';

import React from 'react';
import { NormalizedWidgetData } from '../../core/types';

export function TextBlockWidget({ data }: { data: NormalizedWidgetData }) {
  const content = data.textData?.content || data.subtitle || '';

  return (
    <div style={{ padding: '16px 20px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,169,110,0.2)', width: '100%' }}>
      {data.title && (
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#c9a96e', fontFamily: 'Georgia, serif', marginBottom: '8px' }}>
          {data.title}
        </h4>
      )}
      <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {content}
      </p>
    </div>
  );
}
