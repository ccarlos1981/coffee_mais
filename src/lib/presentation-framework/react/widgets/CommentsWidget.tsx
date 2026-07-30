'use client';

import React from 'react';
import { CommentCategory, CommentItem, NormalizedWidgetData } from '../../core/types';
import { MessageSquare, AlertTriangle, Lightbulb, CheckCircle2, Clock } from 'lucide-react';

export function CommentsWidget({ data }: { data: NormalizedWidgetData }) {
  const comments: CommentItem[] = data.commentsData || [
    {
      id: 'c_1',
      author: 'Cristiano Santos',
      createdAt: new Date().toLocaleDateString('pt-BR'),
      category: 'observacao',
      text: 'O faturamento mensal superou a meta estipulada impulsionado pelo crescimento na categoria Grão.',
      isResolved: true,
    },
    {
      id: 'c_2',
      author: 'Luiz Silva',
      createdAt: new Date().toLocaleDateString('pt-BR'),
      category: 'alerta',
      text: 'Atenção para o limite da taxa de investimento comercial no canal Key Account.',
      isResolved: false,
    },
  ];

  const getCategoryBadge = (cat: CommentCategory) => {
    switch (cat) {
      case 'alerta':
        return { label: 'Alerta', bg: 'rgba(248, 113, 113, 0.15)', border: '#f87171', color: '#f87171', icon: <AlertTriangle size={12} /> };
      case 'oportunidade':
        return { label: 'Oportunidade', bg: 'rgba(74, 222, 128, 0.15)', border: '#4ade80', color: '#4ade80', icon: <Lightbulb size={12} /> };
      case 'risco':
        return { label: 'Risco', bg: 'rgba(250, 204, 21, 0.15)', border: '#facc15', color: '#facc15', icon: <AlertTriangle size={12} /> };
      case 'observacao':
      default:
        return { label: 'Observação', bg: 'rgba(201, 169, 110, 0.15)', border: '#c9a96e', color: '#c9a96e', icon: <MessageSquare size={12} /> };
    }
  };

  return (
    <div className="rdm-comment" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {comments.map(c => {
        const badge = getCategoryBadge(c.category);
        return (
          <div
            key={c.id}
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff' }}>{c.author}</span>
                <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>• {c.createdAt}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: badge.color,
                    background: badge.bg,
                    border: `1px solid ${badge.border}`,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {badge.icon}
                  {badge.label}
                </span>
                {c.isResolved ? (
                  <span title="Resolvido"><CheckCircle2 size={14} color="#4ade80" /></span>
                ) : (
                  <span title="Pendente"><Clock size={14} color="rgba(255,255,255,0.4)" /></span>
                )}
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.45 }}>
              {c.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
