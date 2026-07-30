'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CustomSlideConfig,
  IDataProvider,
  IStorageProvider,
  LayoutOrientation,
  PeriodType,
  SlideTemplate,
  WidgetConfig,
  WidgetType,
  EXECUTIVE_TEMPLATES,
  TemplateEngine,
  Sanitizer,
  PresentationTelemetry,
} from '../../core';
import { CustomSlideRenderer } from '../CustomSlideRenderer';
import { WidgetRegistry } from '../../core/WidgetRegistry';
import { X, Sparkles, LayoutGrid, Layers, Check, ArrowRight, ArrowLeft, Plus } from 'lucide-react';

interface SlideBuilderWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newSlide: CustomSlideConfig) => void;
  dataProvider: IDataProvider;
  storageProvider: IStorageProvider;
  currentSlideIndex: number;
  monthName: string;
}

export function SlideBuilderWizard({
  isOpen,
  onClose,
  onConfirm,
  dataProvider,
  storageProvider,
  currentSlideIndex,
  monthName,
}: SlideBuilderWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Wizard Form State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(12);
  const [year, setYear] = useState(2026);

  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(['faturamento', 'volume']);
  const [widgetType, setWidgetType] = useState<WidgetType>('kpi_card');
  const [layoutOrientation, setLayoutOrientation] = useState<LayoutOrientation>('2col');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Load saved templates
  const [userTemplates, setUserTemplates] = useState<SlideTemplate[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    async function fetchTemplates() {
      const res = await storageProvider.getTemplates();
      setUserTemplates(Array.isArray(res) ? res : []);
    }
    fetchTemplates();
  }, [storageProvider, isOpen]);

  const allTemplates = useMemo(() => {
    return [...EXECUTIVE_TEMPLATES, ...userTemplates];
  }, [userTemplates]);

  const handleSelectTemplate = (template: SlideTemplate) => {
    setSelectedTemplateId(template.id);
    setTitle(template.name);
    setSubtitle(template.description || '');
    setLayoutOrientation(template.layout);
    if (template.widgets.length > 0) {
      setWidgetType(template.widgets[0].type);
      if (template.widgets[0].indicators) {
        setSelectedIndicators(template.widgets[0].indicators);
      }
    }
  };

  const handleCreateFromScratch = () => {
    setSelectedTemplateId(null);
    setTitle('Novo Slide Personalizado');
    setSubtitle('');
    setLayoutOrientation('2col');
    setWidgetType('kpi_card');
    setSelectedIndicators(['faturamento', 'volume']);
  };

  // Build Preview / Final Slide Object
  const draftSlide: CustomSlideConfig = useMemo(() => {
    const id = `custom_slide_${Date.now()}`;

    // Generate widgets based on current configuration
    let widgets: WidgetConfig[] = [];

    if (selectedTemplateId) {
      const tpl = allTemplates.find(t => t.id === selectedTemplateId);
      if (tpl) {
        widgets = JSON.parse(JSON.stringify(tpl.widgets));
      }
    }

    if (widgets.length === 0) {
      widgets = [
        {
          id: `w_1_${Date.now()}`,
          type: widgetType,
          title: title || 'Indicadores Principais',
          indicators: selectedIndicators,
          period: { type: periodType, startMonth, endMonth, year },
        },
        {
          id: `w_2_${Date.now()}`,
          type: 'table',
          title: 'Detalhamento dos Dados',
          indicators: selectedIndicators,
          period: { type: periodType, startMonth, endMonth, year },
        },
      ];
    } else {
      // Apply period to widgets
      widgets.forEach((w, idx) => {
        w.period = { type: periodType, startMonth, endMonth, year };
        if (idx === 0 && title) w.title = title;
      });
    }

    return {
      id,
      key: id,
      label: title || 'Slide Personalizado',
      subtitle,
      layout: layoutOrientation,
      widgets,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: 'Usuário RDM',
      origin: 'user',
    };
  }, [
    selectedTemplateId,
    allTemplates,
    widgetType,
    title,
    subtitle,
    selectedIndicators,
    periodType,
    startMonth,
    endMonth,
    year,
    layoutOrientation,
  ]);

  if (!isOpen) return null;

  const handleFinish = () => {
    const cleanTitle = Sanitizer.sanitizeText(title) || 'Slide Personalizado';
    const cleanSubtitle = Sanitizer.sanitizeText(subtitle);

    draftSlide.label = cleanTitle;
    draftSlide.subtitle = cleanSubtitle;

    PresentationTelemetry.track('slide_created', {
      slideId: draftSlide.id,
      templateId: selectedTemplateId || undefined,
      metadata: { layout: layoutOrientation, widgetCount: draftSlide.widgets.length },
    });

    if (saveAsTemplate && templateName.trim()) {
      const cleanTplName = Sanitizer.sanitizeText(templateName);
      const newTpl = TemplateEngine.slideToTemplate(draftSlide, cleanTplName, cleanSubtitle);
      storageProvider.saveTemplate(newTpl);
      PresentationTelemetry.track('template_used', { templateId: newTpl.id });
    }

    onConfirm(draftSlide);
    onClose();
  };

  const indicatorOptions = [
    { id: 'volume', label: 'Volume' },
    { id: 'faturamento', label: 'Faturamento' },
    { id: 'investimento', label: 'Investimento' },
    { id: 'positivacao', label: 'Clientes Positivados' },
    { id: 'ticket_medio', label: 'Ticket Médio' },
    { id: 'preco_medio', label: 'Preço Médio' },
    { id: 'mix', label: 'Mix de Produtos' },
    { id: 'margem', label: 'Margem' },
    { id: 'sku', label: 'SKU' },
    { id: 'familia', label: 'Família' },
    { id: 'regiao', label: 'Região' },
    { id: 'canal', label: 'Canal' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div style={{ width: '90%', maxWidth: '1000px', height: '85vh', background: '#0e0e11', border: '1px solid rgba(201,169,110,0.3)', borderRadius: '14px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', overflow: 'hidden' }}>

        {/* Modal Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', background: 'rgba(201,169,110,0.15)', borderRadius: '8px', color: '#c9a96e' }}>
              <Plus size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Georgia, serif', margin: 0 }}>
                Slide Builder <span style={{ color: '#c9a96e', fontSize: '0.8rem', fontWeight: 600 }}>| Novo Slide</span>
              </h3>
              <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', margin: 0, marginTop: '2px' }}>
                Passo {step} de 4 — {step === 1 ? 'Biblioteca de Modelos' : step === 2 ? 'Título e Período' : step === 3 ? 'Indicadores e Layout' : 'Pré-visualização ao Vivo'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '6px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* STEP 1: MODELOS & BIBLIOTECA EXECUÇÃO */}
          {step === 1 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '0.9rem', color: '#c9a96e', margin: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Escolha um Modelo ou Crie do Zero
                </h4>
                <button
                  onClick={handleCreateFromScratch}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    background: selectedTemplateId === null ? '#c9a96e' : 'rgba(255,255,255,0.06)',
                    color: selectedTemplateId === null ? '#000000' : '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  ➕ Criar Slide do Zero
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {allTemplates.map(tpl => {
                  const isSelected = selectedTemplateId === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => handleSelectTemplate(tpl)}
                      style={{
                        padding: '16px',
                        borderRadius: '10px',
                        background: isSelected ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.02)',
                        border: isSelected ? '2px solid #c9a96e' : '1px solid rgba(255,255,255,0.08)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#c9a96e', background: 'rgba(201,169,110,0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                          {tpl.category || 'Executivo'}
                        </span>
                        {isSelected && <Check size={16} color="#c9a96e" />}
                      </div>
                      <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', margin: 0, marginBottom: '4px' }}>
                        {tpl.name}
                      </h5>
                      <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.4 }}>
                        {tpl.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: TÍTULO & PERÍODO */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px', margin: '0 auto' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c9a96e', display: 'block', marginBottom: '6px' }}>
                  Título do Slide *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ex: Resultado do Faturamento por Rede"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.15)', color: '#ffffff', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c9a96e', display: 'block', marginBottom: '6px' }}>
                  Subtítulo (Opcional)
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={e => setSubtitle(e.target.value)}
                  placeholder="Ex: Análise consolidada das redes prioritárias"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.15)', color: '#ffffff', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c9a96e', display: 'block', marginBottom: '8px' }}>
                  Período dos Dados
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'month', label: 'Mês Atual' },
                    { id: '3m', label: 'Últimos 3 Meses' },
                    { id: '6m', label: 'Últimos 6 Meses' },
                    { id: '12m', label: 'Últimos 12 Meses' },
                    { id: 'ytd', label: 'YTD (Acumulado Ano)' },
                    { id: 'custom', label: 'Personalizado' },
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPeriodType(p.id as PeriodType)}
                      style={{
                        padding: '10px',
                        borderRadius: '6px',
                        background: periodType === p.id ? 'rgba(201,169,110,0.2)' : 'rgba(255,255,255,0.03)',
                        border: periodType === p.id ? '1px solid #c9a96e' : '1px solid rgba(255,255,255,0.08)',
                        color: periodType === p.id ? '#c9a96e' : 'rgba(255,255,255,0.8)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {periodType === 'custom' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(201,169,110,0.2)' }}>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#c9a96e' }}>Mês Inicial</span>
                    <input type="number" min={1} max={12} value={startMonth} onChange={e => setStartMonth(Number(e.target.value))} style={{ width: '100%', padding: '6px', borderRadius: '4px', background: '#000', border: '1px solid #333', color: '#fff', fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#c9a96e' }}>Mês Final</span>
                    <input type="number" min={1} max={12} value={endMonth} onChange={e => setEndMonth(Number(e.target.value))} style={{ width: '100%', padding: '6px', borderRadius: '4px', background: '#000', border: '1px solid #333', color: '#fff', fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#c9a96e' }}>Ano</span>
                    <input type="number" min={2024} max={2026} value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: '100%', padding: '6px', borderRadius: '4px', background: '#000', border: '1px solid #333', color: '#fff', fontSize: '0.8rem' }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: INDICADORES & LAYOUT */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c9a96e', display: 'block', marginBottom: '8px' }}>
                  Selecione os Indicadores (KPIs)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
                  {indicatorOptions.map(ind => {
                    const isChecked = selectedIndicators.includes(ind.id);
                    return (
                      <label
                        key={ind.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: isChecked ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.03)',
                          border: isChecked ? '1px solid #c9a96e' : '1px solid rgba(255,255,255,0.08)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          color: '#ffffff',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedIndicators([...selectedIndicators, ind.id]);
                            } else {
                              setSelectedIndicators(selectedIndicators.filter(i => i !== ind.id));
                            }
                          }}
                        />
                        {ind.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c9a96e', display: 'block', marginBottom: '8px' }}>
                  Orientação e Layout do Slide
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {[
                    { id: 'full', label: 'Tela Inteira (1 Coluna)' },
                    { id: '2col', label: '2 Colunas Lado a Lado' },
                    { id: '3col', label: '3 Colunas' },
                    { id: 'dashboard', label: 'Dashboard 2x2' },
                  ].map(l => (
                    <button
                      key={l.id}
                      onClick={() => setLayoutOrientation(l.id as LayoutOrientation)}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        background: layoutOrientation === l.id ? 'rgba(201,169,110,0.2)' : 'rgba(255,255,255,0.03)',
                        border: layoutOrientation === l.id ? '2px solid #c9a96e' : '1px solid rgba(255,255,255,0.08)',
                        color: layoutOrientation === l.id ? '#c9a96e' : 'rgba(255,255,255,0.7)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: PREVIEW WYSIWYG AO VIVO */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
              <div style={{ flex: 1, minHeight: '380px', borderRadius: '10px', border: '1px solid rgba(201,169,110,0.3)', overflow: 'hidden', background: '#09090b' }}>
                <CustomSlideRenderer slide={draftSlide} dataProvider={dataProvider} monthName={monthName} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#ffffff', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={e => setSaveAsTemplate(e.target.checked)}
                  />
                  Salvar este slide como Modelo para reutilização futura
                </label>

                {saveAsTemplate && (
                  <input
                    type="text"
                    placeholder="Nome do Modelo"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '4px', background: '#000', border: '1px solid #333', color: '#fff', fontSize: '0.78rem' }}
                  />
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
          <button
            onClick={() => {
              if (step > 1) setStep((step - 1) as any);
              else onClose();
            }}
            style={{ padding: '8px 16px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: 'none', color: '#ffffff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={16} />
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep((step + 1) as any)}
              style={{ padding: '8px 18px', borderRadius: '6px', background: '#c9a96e', border: 'none', color: '#000000', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              Avançar
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              style={{ padding: '8px 22px', borderRadius: '6px', background: 'linear-gradient(135deg, #c9a96e 0%, #a07840 100%)', border: 'none', color: '#000000', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(201,169,110,0.3)' }}
            >
              <Plus size={16} />
              Criar e Inserir Slide
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
