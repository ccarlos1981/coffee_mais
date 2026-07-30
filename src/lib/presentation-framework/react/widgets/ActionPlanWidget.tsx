'use client';

import React from 'react';
import { ActionItem, ActionPriority, ActionStatus, NormalizedWidgetData } from '../../core/types';
import { CheckSquare, User, Calendar, AlertCircle, Clock, CheckCircle2, XCircle } from 'lucide-react';

export function ActionPlanWidget({ data }: { data: NormalizedWidgetData }) {
  const actions: ActionItem[] = data.actionPlanData || [
    {
      id: 'act_1',
      title: 'Ajuste de Mix na Rede Zaffari',
      description: 'Expandir distribuição da linha de Cápsulas nas lojas de Porto Alegre.',
      owner: 'Cristiano Santos',
      dueDate: '15/08/2026',
      priority: 'alta',
      status: 'em_andamento',
      createdAt: '25/07/2026',
      notes: 'Alinhado com o comprador comercial.',
    },
    {
      id: 'act_2',
      title: 'Revisão da Verba Trade SP',
      description: 'Readequar o investimento em encartes para respeitar o limite de 10%.',
      owner: 'Julliano (SPC)',
      dueDate: '10/08/2026',
      priority: 'urgente',
      status: 'pendente',
      createdAt: '26/07/2026',
      notes: 'Aguardando aprovação da Diretoria.',
    },
    {
      id: 'act_3',
      title: 'Campanha Degustação Geisha',
      description: 'Ativação de promotores em 5 lojas de alta conversão.',
      owner: 'Ana Paula (Trade)',
      dueDate: '01/08/2026',
      priority: 'media',
      status: 'concluido',
      createdAt: '20/07/2026',
      completedAt: '28/07/2026',
      notes: '100% de presença e alta positivação.',
    },
  ];

  const getPriorityBadge = (p: ActionPriority) => {
    switch (p) {
      case 'urgente':
        return { label: 'URGENTE', bg: 'rgba(248, 113, 113, 0.15)', color: '#f87171' };
      case 'alta':
        return { label: 'ALTA', bg: 'rgba(250, 204, 21, 0.15)', color: '#facc15' };
      case 'media':
        return { label: 'MÉDIA', bg: 'rgba(201, 169, 110, 0.15)', color: '#c9a96e' };
      case 'baixa':
      default:
        return { label: 'BAIXA', bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' };
    }
  };

  const getStatusBadge = (s: ActionStatus) => {
    switch (s) {
      case 'concluido':
        return { label: 'Concluído', color: '#4ade80', icon: <CheckCircle2 size={12} /> };
      case 'em_andamento':
        return { label: 'Em Andamento', color: '#60a5fa', icon: <Clock size={12} /> };
      case 'cancelado':
        return { label: 'Cancelado', color: '#f87171', icon: <XCircle size={12} /> };
      case 'pendente':
      default:
        return { label: 'Pendente', color: '#facc15', icon: <AlertCircle size={12} /> };
    }
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {actions.map(act => {
        const pBadge = getPriorityBadge(act.priority);
        const sBadge = getStatusBadge(act.status);

        return (
          <div
            key={act.id}
            style={{
              padding: '14px 16px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(201, 169, 110, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h5 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff', margin: '0 0 2px 0' }}>
                  {act.title}
                </h5>
                {act.description && (
                  <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', margin: 0 }}>
                    {act.description}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    color: pBadge.color,
                    background: pBadge.bg,
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {pBadge.label}
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: sBadge.color,
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {sBadge.icon}
                  {sBadge.label}
                </span>
              </div>
            </div>

            {/* Sub-bar: Responsible, Due date, Notes */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#c9a96e' }}>
                  <User size={12} /> {act.owner}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} /> Prazo: {act.dueDate}
                </span>
              </div>
              {act.notes && (
                <span style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' }}>
                  Nota: {act.notes}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
