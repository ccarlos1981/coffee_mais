'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatCompact, formatCurrency, formatNumber } from '@/lib/formatters';
import { GERENTE_DISPLAY_MAP, MESES_LABEL } from '@/lib/dre-gerencial/types';
import type { RdmSlide1Data, RdmSlide2Data, DreRedeRow } from '@/lib/dre-gerencial/types';

// ─── Formatters ───

function fmtVal(v: number | null | undefined, prefix = ''): string {
  if (v === null || v === undefined) return 'N/A';
  return prefix + formatCompact(v);
}

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'N/A';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
}

function fmtDelta(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'N/A';
  const sign = v >= 0 ? '+' : '';
  return sign + formatCompact(v);
}

function deltaColor(v: number | null | undefined, isCost = false): string {
  if (v === null || v === undefined) return '';
  if (isCost) {
    return v <= 0 ? 'var(--color-positive, #22c55e)' : 'var(--color-negative, #ef4444)';
  }
  return v >= 0 ? 'var(--color-positive, #22c55e)' : 'var(--color-negative, #ef4444)';
}

// ─── Page ───

export default function RdmGerencialPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slide1, setSlide1] = useState<RdmSlide1Data | null>(null);
  const [slide2, setSlide2] = useState<RdmSlide2Data | null>(null);

  // Filtros
  const [ano, setAno] = useState(2026);
  const [competencia, setCompetencia] = useState('2026-07');
  const [gerente, setGerente] = useState('KA');
  const [rede, setRede] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        ano: String(ano),
        competencia,
        canal: 'KA',
      });
      if (gerente && gerente !== 'KA') params.set('gerente', gerente);
      if (rede) params.set('rede', rede);

      const res = await fetch(`/api/rdm-gerencial?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSlide1(data.slide1);
      setSlide2(data.slide2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [ano, competencia, gerente, rede]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Redes disponíveis (do slide2)
  const redesDisponiveis = useMemo(() => {
    if (!slide2) return [];
    const all: string[] = [];
    for (const g of slide2.grupos) {
      for (const r of g.redes) {
        all.push(r.rede);
      }
    }
    return [...new Set(all)].sort();
  }, [slide2]);

  // Competências
  const competenciasOpcoes = useMemo(() => {
    const comps: string[] = [];
    for (let m = 1; m <= 12; m++) {
      comps.push(`${ano}-${String(m).padStart(2, '0')}`);
    }
    return comps;
  }, [ano]);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground)', display: 'flex' }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          RDM — Resultado do Mês
        </h1>
        <button onClick={fetchData} style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--foreground)' }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' }}>Ano</label>
          <select value={ano} onChange={e => setAno(Number(e.target.value))} style={selectStyle}>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' }}>Competência</label>
          <select value={competencia} onChange={e => setCompetencia(e.target.value)} style={selectStyle}>
            {competenciasOpcoes.map(c => {
              const [, m] = c.split('-').map(Number);
              return <option key={c} value={c}>{MESES_LABEL[m]}/{ano}</option>;
            })}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' }}>Gerente</label>
          <select value={gerente} onChange={e => { setGerente(e.target.value); setRede(''); }} style={selectStyle}>
            <option value="KA">KA (Todos)</option>
            <option value="Leandro">Leandro</option>
            <option value="Luiz">Luiz</option>
            <option value="Julliano">Julliano</option>
            <option value="John">John</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' }}>Rede</label>
          <select value={rede} onChange={e => setRede(e.target.value)} style={{ ...selectStyle, minWidth: '180px' }}>
            <option value="">Todas</option>
            {redesDisponiveis.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}
      {error && (
        <div style={{ padding: '1rem', background: 'var(--destructive-bg, #fef2f2)', color: 'var(--destructive, #dc2626)', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {!loading && !error && slide1 && (
        <>
          {/* Slide 1 */}
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--foreground)' }}>
              {slide1.titulo}
            </h2>
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  {/* Linha 1: Agrupadores dos 3 Blocos */}
                  {(() => {
                    const MONTHS_UPPER = ['', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
                    const [, m] = competencia.split('-').map(Number);
                    const t1 = MONTHS_UPPER[m] || 'JULHO';
                    const pm = m === 1 ? 'DEZEMBRO' : MONTHS_UPPER[m - 1];
                    const t2 = m === 1 ? `MÊS ANTERIOR (${pm}/${ano - 1})` : `MÊS ANTERIOR (${pm})`;
                    const t3 = `ANO ANTERIOR (${t1}/${ano - 1})`;

                    return (
                      <tr style={{ background: 'var(--muted, #f1f5f9)', borderBottom: '1px solid var(--border)' }}>
                        <th rowSpan={2} style={{ ...thStyle, verticalAlign: 'middle', borderRight: '2px solid var(--border)' }}>KPI</th>
                        <th colSpan={4} style={{ ...thStyle, textAlign: 'center', fontWeight: 800, borderRight: '3px solid #94a3b8' }}>{t1}</th>
                        <th colSpan={3} style={{ ...thStyle, textAlign: 'center', fontWeight: 800, borderRight: '3px solid #94a3b8' }}>{t2}</th>
                        <th colSpan={3} style={{ ...thStyle, textAlign: 'center', fontWeight: 800 }}>{t3}</th>
                      </tr>
                    );
                  })()}
                  {/* Linha 2: Colunas */}
                  <tr style={{ background: 'var(--muted, #f8fafc)', borderBottom: '2px solid #94a3b8' }}>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Desafio</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actual</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Δ</th>
                    <th style={{ ...thStyle, textAlign: 'right', borderRight: '3px solid #94a3b8' }}>%Δ</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Mês Anterior</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Δ</th>
                    <th style={{ ...thStyle, textAlign: 'right', borderRight: '3px solid #94a3b8' }}>%Δ</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Ano Anterior</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Δ</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>%Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {slide1.linhas.map((l, i) => {
                    const anoAntVal = l.anoAnterior !== null && l.anoAnterior !== undefined ? l.anoAnterior : null;
                    const actualVal = l.actual !== null && l.actual !== undefined ? l.actual : 0;
                    const deltaAnoAnt = anoAntVal !== null && anoAntVal !== 0 ? actualVal - anoAntVal : null;
                    const pctDeltaAnoAnt = anoAntVal !== null && anoAntVal !== 0 ? ((actualVal / anoAntVal) - 1) * 100 : null;

                    const isCost = ['Impostos', 'Invest. Comercial', 'Abatimento', 'Contrato', 'Bonificação', 'CPV', 'Frete'].some(c => l.kpi.includes(c));

                    return (
                      <tr key={i} style={{
                        background: l.isHighlighted ? 'rgba(100, 116, 139, 0.14)' : 'transparent',
                        fontWeight: l.isHighlighted ? 700 : 400,
                        borderTop: l.isHighlighted ? '1px solid rgba(100, 116, 139, 0.25)' : undefined,
                        borderBottom: l.isHighlighted ? '1px solid rgba(100, 116, 139, 0.25)' : undefined,
                      }}>
                        <td style={{ ...tdStyle, paddingLeft: l.indent ? '2rem' : '0.75rem', fontStyle: l.indent ? 'italic' : 'normal', color: l.indent ? 'var(--muted-foreground)' : 'var(--foreground)', borderRight: '2px solid var(--border)', fontWeight: l.isHighlighted ? 800 : 500 }}>{l.kpi}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtVal(l.desafio, l.kpi.includes('Volume') ? '' : 'R$ ')}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtVal(l.actual, l.kpi.includes('Volume') ? '' : 'R$ ')}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: deltaColor(l.deltaDesafio, isCost) }}>{fmtDelta(l.deltaDesafio)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: deltaColor(l.pctDeltaDesafio, isCost), borderRight: '3px solid #94a3b8' }}>{fmtPct(l.pctDeltaDesafio)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtVal(l.mesAnterior, l.kpi.includes('Volume') ? '' : 'R$ ')}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: deltaColor(l.deltaMesAnterior, isCost) }}>{fmtDelta(l.deltaMesAnterior)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: deltaColor(l.pctDeltaMesAnterior, isCost), borderRight: '3px solid #94a3b8' }}>{fmtPct(l.pctDeltaMesAnterior)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtVal(l.anoAnterior, l.kpi.includes('Volume') ? '' : 'R$ ')}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: deltaColor(deltaAnoAnt, isCost) }}>{fmtDelta(deltaAnoAnt)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: deltaColor(pctDeltaAnoAnt, isCost) }}>{fmtPct(pctDeltaAnoAnt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Slide 2 */}
          {slide2 && (
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--foreground)' }}>
                Resultado por Rede
              </h2>
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--muted, #f4f4f5)' }}>
                      <th style={thStyle}>Redes</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Volume</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Fat</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>% Imp</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>% Investimento</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Frete/Unidade</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>CPV/Unidade</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>MC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slide2.grupos.map((grupo, gi) => (
                      <React.Fragment key={gi}>
                        {/* Linha de grupo (gerente) */}
                        <tr style={{ background: 'var(--accent, #e4e4e7)' }}>
                          <td colSpan={8} style={{ ...tdStyle, fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {grupo.gerente}
                          </td>
                        </tr>
                        {/* Redes do grupo */}
                        {grupo.redes.map((r, ri) => (
                          <tr key={ri} style={{ borderBottom: '1px solid var(--border-light, #e5e7eb)' }}>
                            <td style={{ ...tdStyle, fontWeight: 500 }}>{r.rede}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>{formatNumber(r.volume, 0)}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCompact(r.faturamento)}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>{r.impPct !== null ? `${r.impPct.toFixed(1)}%` : 'N/A'}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>{r.investPct !== null ? `${r.investPct.toFixed(1)}%` : 'N/A'}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>{r.freteUnidade !== null ? formatCurrency(r.freteUnidade, 2) : 'N/A'}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>{r.cpvUnidade !== null ? formatCurrency(r.cpvUnidade, 2) : 'N/A'}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatCompact(r.mc)}</td>
                          </tr>
                        ))}
                        {/* Subtotal gerente */}
                        <tr style={{ background: 'var(--muted, #f4f4f5)', fontWeight: 700 }}>
                          <td style={tdStyle}>Total {grupo.gerente}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{formatNumber(grupo.redes.reduce((s, r) => s + r.volume, 0), 0)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCompact(grupo.redes.reduce((s, r) => s + r.faturamento, 0))}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>—</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>—</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>—</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>—</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCompact(grupo.redes.reduce((s, r) => s + r.mc, 0))}</td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  background: 'var(--background)',
  color: 'var(--foreground)',
  fontSize: '0.85rem',
  minWidth: '120px',
};

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--muted-foreground)',
  borderBottom: '2px solid var(--border)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderBottom: '1px solid var(--border-light, #e5e7eb)',
  whiteSpace: 'nowrap',
};
