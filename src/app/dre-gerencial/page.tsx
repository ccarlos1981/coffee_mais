'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowLeft, Loader2, RefreshCw, Upload, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatCompact, formatCurrency, formatNumber } from '@/lib/formatters';
import { MESES_LABEL } from '@/lib/dre-gerencial/types';
import type { DreMensalColuna, DreKpis, ImportPreview } from '@/lib/dre-gerencial/types';

// ─── Types ───

interface DreApiResponse {
  ano: number;
  competencias: string[];
  consolidado: DreMensalColuna[];
  porGerente: { gerente: string; colunas: DreMensalColuna[] }[];
  porRede: { rede: string; gerente: string; colunas: DreMensalColuna[] }[];
}

type Visao = 'consolidado' | 'gerente' | 'rede';

// ─── KPI Row Names ───

const KPI_ROWS: { key: keyof DreKpis; label: string; highlighted: boolean; indent?: boolean }[] = [
  { key: 'volume', label: 'Volume', highlighted: false },
  { key: 'faturamento', label: 'Faturamento', highlighted: true },
  { key: 'impostos', label: 'Impostos', highlighted: false },
  { key: 'investComercial', label: 'Invest. Comercial', highlighted: false },
  { key: 'abatimento', label: '  Abatimento', highlighted: false, indent: true },
  { key: 'contrato', label: '  Contrato', highlighted: false, indent: true },
  { key: 'bonificacao', label: '  Bonificação', highlighted: false, indent: true },
  { key: 'receitaLiquida', label: 'Receita Líquida', highlighted: true },
  { key: 'cpv', label: 'CPV', highlighted: false },
  { key: 'frete', label: 'Frete', highlighted: false },
  { key: 'margemContribuicao', label: 'Margem de Contribuição', highlighted: true },
];

// ─── Page ───

export default function DreGerencialPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DreApiResponse | null>(null);

  // Filtros
  const [ano, setAno] = useState(new Date().getFullYear());
  const [gerente, setGerente] = useState('KA');
  const [rede, setRede] = useState('');
  const [visao, setVisao] = useState<Visao>('consolidado');

  // Import modal
  const [showImport, setShowImport] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        ano: String(ano),
        canal: 'KA',
        visao,
      });
      if (gerente && gerente !== 'KA') params.set('gerente', gerente);
      if (rede) params.set('rede', rede);

      const res = await fetch(`/api/dre-gerencial?${params}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [ano, gerente, rede, visao]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Redes disponíveis
  const redesDisponiveis = useMemo(() => {
    if (!data) return [];
    return data.porRede.map(r => r.rede).sort();
  }, [data]);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => router.push('/')} style={iconBtnStyle}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>DRE Gerencial</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setShowImport(true)} style={{ ...btnStyle, background: 'var(--primary, #2563eb)', color: '#fff', border: 'none' }}>
            <Upload size={14} /> Importar DRE
          </button>
          <button onClick={fetchData} style={btnStyle}><RefreshCw size={14} /> Atualizar</button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'end' }}>
        <FilterSelect label="Ano" value={String(ano)} onChange={v => setAno(Number(v))} options={[
          { value: '2025', label: '2025' },
          { value: '2026', label: '2026' },
        ]} />
        <FilterSelect label="Gerente" value={gerente} onChange={v => { setGerente(v); setRede(''); }} options={[
          { value: 'KA', label: 'KA (Todos)' },
          { value: 'Leandro', label: 'Leandro' },
          { value: 'Luiz', label: 'Luiz' },
          { value: 'Julliano', label: 'Julliano' },
          { value: 'John', label: 'John' },
        ]} />
        <FilterSelect label="Rede" value={rede} onChange={setRede} options={[
          { value: '', label: 'Todas' },
          ...redesDisponiveis.map(r => ({ value: r, label: r })),
        ]} wider />
        <div style={{ display: 'flex', gap: '4px', alignSelf: 'end' }}>
          {(['consolidado', 'gerente', 'rede'] as Visao[]).map(v => (
            <button key={v} onClick={() => setVisao(v)} style={{
              ...btnStyle,
              background: visao === v ? 'var(--primary, #2563eb)' : 'var(--background)',
              color: visao === v ? '#fff' : 'var(--foreground)',
              border: visao === v ? 'none' : '1px solid var(--border)',
              textTransform: 'capitalize',
            }}>
              {v === 'consolidado' ? 'Consolidado' : v === 'gerente' ? 'Por Gerente' : 'Por Rede'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading / Error */}
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} /></div>}
      {error && <div style={{ padding: '1rem', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}

      {/* Data Tables */}
      {!loading && !error && data && (
        <>
          {visao === 'consolidado' && data.consolidado.length > 0 && (
            <DreTable title="DRE Consolidado KA" colunas={data.consolidado} />
          )}
          {visao === 'gerente' && data.porGerente.map((g, i) => (
            <DreTable key={i} title={`DRE — ${g.gerente}`} colunas={g.colunas} />
          ))}
          {visao === 'rede' && data.porRede.map((r, i) => (
            <DreTable key={i} title={`${r.rede} (${r.gerente})`} colunas={r.colunas} />
          ))}
          {visao === 'consolidado' && data.consolidado.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
              Nenhum dado encontrado para {ano}. Importe dados da planilha DRE.
            </div>
          )}
        </>
      )}

      {/* Import Modal */}
      {showImport && <ImportModal onClose={() => { setShowImport(false); fetchData(); }} />}

      <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── DRE Table Component ───

function DreTable({ title, colunas }: { title: string; colunas: DreMensalColuna[] }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{title}</h3>
      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: 'var(--muted, #f4f4f5)' }}>
              <th style={thStyle}>KPI</th>
              {colunas.map((c, i) => (
                <th key={i} style={{ ...thStyle, textAlign: 'right' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {KPI_ROWS.map((kpi, ki) => (
              <tr key={ki} style={{
                background: kpi.highlighted ? 'rgba(100, 116, 139, 0.14)' : 'transparent',
                fontWeight: kpi.highlighted ? 700 : 400,
                borderTop: kpi.highlighted ? '1px solid rgba(100, 116, 139, 0.25)' : undefined,
                borderBottom: kpi.highlighted ? '1px solid rgba(100, 116, 139, 0.25)' : undefined,
              }}>
                <td style={{ ...tdStyle, paddingLeft: kpi.indent ? '2rem' : '0.75rem', fontStyle: kpi.indent ? 'italic' : 'normal', color: kpi.indent ? 'var(--muted-foreground)' : 'var(--foreground)', whiteSpace: 'nowrap' }}>
                  {kpi.label}
                </td>
                {colunas.map((c, ci) => {
                  const val = c.kpis[kpi.key];
                  const isVolume = kpi.key === 'volume';
                  return (
                    <td key={ci} style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {isVolume ? formatNumber(val, 0) : formatCompact(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Import Modal ───

function ImportModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [competencia, setCompetencia] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file || !competencia) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('competencia', competencia);
      const res = await fetch('/api/dre-gerencial/importar', { method: 'POST', body: formData });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro no upload');
      }
      setPreview(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch('/api/dre-gerencial/importar?action=confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: preview.batchId }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro');
      }
      const data = await res.json();
      setResult(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '5vh', zIndex: 1000 }}>
      <div style={{ background: 'var(--background)', borderRadius: '12px', padding: '1.5rem', width: '90%', maxWidth: '800px', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Importar DRE</h2>
          <button onClick={onClose} style={iconBtnStyle}><X size={18} /></button>
        </div>

        {result ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <CheckCircle size={48} color="#22c55e" />
            <p style={{ marginTop: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>{result}</p>
            <button onClick={onClose} style={{ ...btnStyle, marginTop: '1rem', background: 'var(--primary)', color: '#fff', border: 'none' }}>Fechar</button>
          </div>
        ) : !preview ? (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Arquivo (.xlsx / .xlsm)</label>
              <input ref={fileRef} type="file" accept=".xlsx,.xlsm" onChange={e => setFile(e.target.files?.[0] || null)} style={{ display: 'block', marginTop: '4px' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Competência</label>
              <select value={competencia} onChange={e => setCompetencia(e.target.value)} style={{ ...selectFilterStyle, display: 'block', marginTop: '4px' }}>
                <option value="">Selecionar...</option>
                {Array.from({ length: 12 }, (_, i) => {
                  const m = i + 1;
                  return <option key={m} value={`2026-${String(m).padStart(2, '0')}`}>{MESES_LABEL[m]}/2026</option>;
                })}
                {Array.from({ length: 12 }, (_, i) => {
                  const m = i + 1;
                  return <option key={`25-${m}`} value={`2025-${String(m).padStart(2, '0')}`}>{MESES_LABEL[m]}/2025</option>;
                })}
              </select>
            </div>
            {error && <div style={{ padding: '0.5rem', background: '#fef2f2', color: '#dc2626', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}
            <button onClick={handleUpload} disabled={!file || !competencia || uploading} style={{ ...btnStyle, background: 'var(--primary)', color: '#fff', border: 'none', opacity: (!file || !competencia || uploading) ? 0.5 : 1 }}>
              {uploading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Processando...</> : <><Upload size={14} /> Enviar e Validar</>}
            </button>
          </>
        ) : (
          <>
            {/* Preview */}
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--muted)', borderRadius: '8px', fontSize: '0.85rem' }}>
              <p><strong>Arquivo:</strong> {preview.filename}</p>
              <p><strong>Competência:</strong> {preview.competencia}</p>
              <p><strong>Redes:</strong> {preview.totalRedes} total, {preview.redesMatched} identificadas no sistema, {preview.redesUnmatched} novas (nome da planilha)</p>
              {preview.isReimport && (
                <p style={{ color: '#f59e0b', fontWeight: 600 }}><AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Reimportação: competência já existente (será atualizada)</p>
              )}
            </div>

            {preview.redesUnmatched > 0 && (
              <div style={{ padding: '0.75rem', background: '#fffbeb', color: '#92400e', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                <strong>ℹ {preview.redesUnmatched} rede(s) sem vendas no sistema (serão importadas com nome da planilha):</strong>
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.5rem' }}>
                  {preview.rows.filter(r => r.matchStatus === 'auto_named').map((r, i) => (
                    <li key={i}>{r.redePlanilha} → {r.redeNormalizada}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ overflowX: 'auto', marginBottom: '1rem', maxHeight: '40vh' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'var(--muted)' }}>
                    <th style={thStyle}>Rede Planilha</th>
                    <th style={thStyle}>Rede Sistema</th>
                    <th style={thStyle}>Gerente</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>ICMS%</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>CPV</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Invest.</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Contrato</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i} style={{ background: r.matchStatus === 'unmatched' ? '#fef2f2' : 'transparent' }}>
                      <td style={tdStyle}>{r.redePlanilha}</td>
                      <td style={tdStyle}>{r.redeSistema || '—'}</td>
                      <td style={tdStyle}>{r.gerenteSistema || '—'}</td>
                      <td style={tdStyle}>
                        <span style={{ color: r.matchStatus === 'matched' ? '#22c55e' : '#dc2626', fontWeight: 600 }}>
                          {r.matchStatus === 'matched' ? '✓' : '✗'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{(r.icmsPct * 100).toFixed(1)}%</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCompact(r.cpvValor)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCompact(r.investimentoValor)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCompact(r.contratoValor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && <div style={{ padding: '0.5rem', background: '#fef2f2', color: '#dc2626', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setPreview(null)} style={btnStyle}>Voltar</button>
              <button onClick={handleConfirm} disabled={!preview.canImport || confirming} style={{
                ...btnStyle,
                background: preview.canImport ? '#22c55e' : '#9ca3af',
                color: '#fff',
                border: 'none',
                opacity: confirming ? 0.5 : 1,
              }}>
                {confirming ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Importando...</> : <><CheckCircle size={14} /> Confirmar Importação</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Filter Select Component ───

function FilterSelect({ label, value, onChange, options, wider }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  wider?: boolean;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...selectFilterStyle, minWidth: wider ? '180px' : '120px' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Styles ───

const iconBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground)', display: 'flex' };
const btnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, background: 'var(--background)', color: 'var(--foreground)' };
const labelStyle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' };
const selectFilterStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.85rem' };
const thStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground)', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '6px 12px', borderBottom: '1px solid var(--border-light, #e5e7eb)', whiteSpace: 'nowrap' };
