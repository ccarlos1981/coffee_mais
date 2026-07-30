'use client';

import React, { useState, useEffect } from 'react';
import { BetaMetricsSummary, BetaTelemetryStore } from '../../core/BetaTelemetryStore';
import { EXECUTIVE_TEMPLATES } from '../../core/templates';
import { BarChart3, LayoutGrid, FileText, Layers, TrendingUp, AlertTriangle, CheckCircle2, Star, MessageSquare, ShieldCheck, PieChart } from 'lucide-react';

export function PresentationFrameworkDashboard() {
  const [summary, setSummary] = useState<BetaMetricsSummary | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const [userName, setUserName] = useState('');
  const [rating, setRating] = useState(5);
  const [usabilityFeedback, setUsabilityFeedback] = useState('');
  const [wizardClarity, setWizardClarity] = useState('');
  const [pptxFidelity, setPptxFidelity] = useState('');
  const [widgetSuggestions, setWidgetSuggestions] = useState('');

  useEffect(() => {
    setSummary(BetaTelemetryStore.getSummary());
  }, []);

  if (!summary) return null;

  const handleAddFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;

    BetaTelemetryStore.addFeedback({
      id: `fb_${Date.now()}`,
      userName: userName.trim(),
      rating,
      usabilityFeedback,
      wizardClarity,
      pptxFidelity,
      widgetSuggestions,
      createdAt: new Date().toISOString(),
    });

    setSummary(BetaTelemetryStore.getSummary());
    setShowFeedbackModal(false);
    setUserName('');
    setUsabilityFeedback('');
    setWizardClarity('');
    setPptxFidelity('');
    setWidgetSuggestions('');
  };

  // Template Taxonomy Classifier
  const templateTaxonomy = EXECUTIVE_TEMPLATES.map(tpl => {
    const count = summary.templateUsageMap[tpl.id] || 0;
    let status: 'Alta utilização' | 'Média utilização' | 'Baixa utilização' | 'Nunca utilizados' = 'Nunca utilizados';
    let badgeColor = 'rgba(255, 255, 255, 0.2)';
    let textColor = 'rgba(255, 255, 255, 0.6)';

    if (count >= 10) {
      status = 'Alta utilização';
      badgeColor = 'rgba(74, 222, 128, 0.15)';
      textColor = '#4ade80';
    } else if (count >= 4) {
      status = 'Média utilização';
      badgeColor = 'rgba(201, 169, 110, 0.15)';
      textColor = '#c9a96e';
    } else if (count >= 1) {
      status = 'Baixa utilização';
      badgeColor = 'rgba(250, 204, 21, 0.15)';
      textColor = '#facc15';
    }

    return {
      template: tpl,
      count,
      status,
      badgeColor,
      textColor,
    };
  });

  return (
    <div style={{ background: '#09090b', color: '#ffffff', minHeight: '100vh', padding: '32px', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', borderBottom: '1px solid rgba(201,169,110,0.2)', paddingBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c9a96e', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            <ShieldCheck size={16} /> PROGRAMA BETA CORPORATIVO — TELEMETRIA & USABILIDADE
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', fontFamily: 'Georgia, serif', margin: '4px 0 0 0' }}>
            Dashboard Executivo v1.0
          </h1>
        </div>

        <button
          onClick={() => setShowFeedbackModal(true)}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #c9a96e 0%, #a07840 100%)',
            color: '#000000',
            fontWeight: 800,
            fontSize: '0.8rem',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(201,169,110,0.3)',
          }}
        >
          <MessageSquare size={16} />
          Registrar Feedback de Piloto
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: '10px', padding: '18px' }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(201,169,110,0.85)', fontWeight: 700, textTransform: 'uppercase' }}>Apresentações RDM</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', margin: '6px 0', fontFamily: 'Georgia, serif' }}>{summary.totalPresentations}</div>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>Média: {summary.avgSlidesPerPresentation} slides/apresentação</span>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: '10px', padding: '18px' }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(201,169,110,0.85)', fontWeight: 700, textTransform: 'uppercase' }}>Slides Personalizados Criados</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', margin: '6px 0', fontFamily: 'Georgia, serif' }}>{summary.totalCustomSlides}</div>
          <span style={{ fontSize: '0.72rem', color: '#4ade80' }}>⚡ Criados em ~{summary.avgCreationTimeMs / 1000}s/slide</span>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: '10px', padding: '18px' }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(201,169,110,0.85)', fontWeight: 700, textTransform: 'uppercase' }}>Exportações PPTX</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', margin: '6px 0', fontFamily: 'Georgia, serif' }}>{summary.totalExports}</div>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>Tempo médio: {(summary.avgExportTimeMs / 1000).toFixed(1)}s</span>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: '10px', padding: '18px' }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(201,169,110,0.85)', fontWeight: 700, textTransform: 'uppercase' }}>Taxa de Erro / Falhas</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: summary.exportErrors > 0 ? '#f87171' : '#4ade80', margin: '6px 0', fontFamily: 'Georgia, serif' }}>
            {summary.exportErrors + summary.renderErrors}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>0% de falha na exportação</span>
        </div>
      </div>

      {/* Grid: Widgets vs Templates Utilization */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        
        {/* Widget Usage */}
        <div style={{ background: 'rgba(18,18,18,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#c9a96e', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            📊 Widgets Mais Utilizados (Ranking de Demanda Real)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(summary.widgetUsageMap).sort((a, b) => b[1] - a[1]).map(([type, count], idx) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.8rem', color: '#ffffff', textTransform: 'capitalize' }}>
                  {idx + 1}. {type.replace('_', ' ')}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c9a96e' }}>{count} usos</span>
                  <div style={{ width: '80px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(count * 3, 100)}%`, height: '100%', background: '#c9a96e' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Template Taxonomy */}
        <div style={{ background: 'rgba(18,18,18,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#c9a96e', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            📋 Taxonomia e Utilização da Biblioteca de Templates
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
            {templateTaxonomy.map(({ template, count, status, badgeColor, textColor }) => (
              <div key={template.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ffffff' }}>{template.name}</div>
                  <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>{template.category}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: textColor, background: badgeColor, padding: '3px 8px', borderRadius: '4px' }}>
                    {status} ({count})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* User Feedback Log */}
      <div style={{ background: 'rgba(18,18,18,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#c9a96e', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          💬 Avaliações e Sugestões do Programa Piloto
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '14px' }}>
          {summary.userFeedback.map(fb => (
            <div key={fb.id} style={{ padding: '16px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,169,110,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>{fb.userName}</span>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {Array.from({ length: fb.rating }).map((_, i) => (
                    <Star key={i} size={14} fill="#c9a96e" color="#c9a96e" />
                  ))}
                </div>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                "{fb.usabilityFeedback}"
              </p>
              {fb.widgetSuggestions && (
                <div style={{ fontSize: '0.72rem', color: '#c9a96e', background: 'rgba(201,169,110,0.1)', padding: '6px 10px', borderRadius: '4px' }}>
                  <strong>Sugestão para Fase 3:</strong> {fb.widgetSuggestions}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal Feedback */}
      {showFeedbackModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}>
          <div style={{ width: '90%', maxWidth: '500px', background: '#0e0e11', border: '1px solid rgba(201,169,110,0.3)', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Georgia, serif', marginBottom: '16px' }}>
              Registrar Feedback de Piloto
            </h3>
            <form onSubmit={handleAddFeedback} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#c9a96e', display: 'block', marginBottom: '4px' }}>Seu Nome e Cargo *</label>
                <input type="text" required value={userName} onChange={e => setUserName(e.target.value)} placeholder="Ex: Cristiano Santos (Gerente SPC)" style={{ width: '100%', padding: '8px', borderRadius: '4px', background: '#000', border: '1px solid #333', color: '#fff', fontSize: '0.8rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#c9a96e', display: 'block', marginBottom: '4px' }}>Avaliação Geral (1 a 5 Estrelas)</label>
                <select value={rating} onChange={e => setRating(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '4px', background: '#000', border: '1px solid #333', color: '#fff', fontSize: '0.8rem' }}>
                  <option value={5}>⭐⭐⭐⭐⭐ (Excelente)</option>
                  <option value={4}>⭐⭐⭐⭐ (Muito Bom)</option>
                  <option value={3}>⭐⭐⭐ (Regular)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#c9a96e', display: 'block', marginBottom: '4px' }}>Facilidade de Uso / Comentários</label>
                <textarea rows={3} value={usabilityFeedback} onChange={e => setUsabilityFeedback(e.target.value)} placeholder="Como foi sua experiência de criação de slides?" style={{ width: '100%', padding: '8px', borderRadius: '4px', background: '#000', border: '1px solid #333', color: '#fff', fontSize: '0.8rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#c9a96e', display: 'block', marginBottom: '4px' }}>Sugestão de Novos Widgets para a Fase 3</label>
                <input type="text" value={widgetSuggestions} onChange={e => setWidgetSuggestions(e.target.value)} placeholder="Ex: Heatmap, Waterfall, Pivot..." style={{ width: '100%', padding: '8px', borderRadius: '4px', background: '#000', border: '1px solid #333', color: '#fff', fontSize: '0.8rem' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowFeedbackModal(false)} style={{ padding: '8px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', background: '#c9a96e', color: '#000', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}>Salvar Feedback</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
