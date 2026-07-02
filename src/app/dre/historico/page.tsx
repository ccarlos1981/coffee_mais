"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Upload, DollarSign, BarChart3, TrendingUp, Info } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import {
  buscarDREHistorico,
  buscarAnosDisponiveis,
  listarGerentesParaDRE,
} from "./lancar/actions";
import { DREHistoricoRow } from "./constants";

const MESES_ABREV = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
const ANOS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
const CENARIOS = ["REAL", "BUDGET", "FORECAST"] as const;
type Cenario = typeof CENARIOS[number];

interface Gerente { id: string; name: string | null; role: string; }

function fmt(val: number | null, isUnit: boolean, isPercent: boolean): string {
  if (val === null) return "–";
  if (isPercent) return `${val.toFixed(1)}%`;
  if (isUnit) return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return val.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function colorClass(val: number | null, isNegGood: boolean): string {
  if (val === null) return "";
  if (val > 0) return isNegGood ? "dre-hist-neg" : "dre-hist-pos";
  if (val < 0) return isNegGood ? "dre-hist-pos" : "dre-hist-neg";
  return "";
}

const NEG_GOOD = ["impostos","invest_comerciais","custo_produtos","fretes","ggf","depreciacao","armazenagem","desp_comerciais","marketing"];

export default function DREHistoricoPage() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [cenario, setCenario] = useState<Cenario>("REAL");
  const [gerenteId, setGerenteId] = useState("");
  const [showMetricas, setShowMetricas] = useState(true);

  const [anos, setAnos] = useState<number[]>(ANOS);
  const [gerentes, setGerentes] = useState<Gerente[]>([]);
  const [rows, setRows] = useState<DREHistoricoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  // Carregar opções de filtro
  useEffect(() => {
    Promise.all([buscarAnosDisponiveis(), listarGerentesParaDRE()]).then(
      ([anosData, gerentesData]) => {
        setAnos(anosData);
        setGerentes(gerentesData);
      }
    );
  }, []);

  // Carregar dados
  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await buscarDREHistorico({ ano, cenario, gerente_id: gerenteId || null });
    setRows(data);
    setHasData(data.some((r) => r.meses.some((v) => v !== null)));
    setLoading(false);
  }, [ano, cenario, gerenteId]);

  useEffect(() => { loadData(); }, [loadData]);

  const plRows   = rows.filter((r) => !r.isUnit);
  const unitRows = rows.filter((r) => r.isUnit);
  const gerenteSelecionado = gerentes.find((g) => g.id === gerenteId);

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className="cm-navbar" style={{ position: "relative" }}>
        <Link href="/" className="cm-logo">Coffee<span>++</span></Link>
        <div className="cm-nav-links">
          <Link href="/vendas" className="cm-nav-link">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <BarChart3 style={{ width: 12, height: 12 }} /> Dashboard
            </span>
          </Link>
          <Link href="/dre" className="cm-nav-link">DRE Mensal</Link>
          <Link href="/dre/historico" className="cm-nav-link active">Histórico DRE</Link>
          <Link href="/investimento" className="cm-nav-link">Investimento</Link>
        </div>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-heading)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
            DRE — Histórico Anual
          </h1>
          <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", marginTop: 2 }}>
            {ano} — {cenario} — {gerenteSelecionado ? gerenteSelecionado.name : "Consolidado"} · <span style={{ opacity: 0.7 }}>*Valores em R$ mil</span>
          </p>
        </div>
        <div className="cm-nav-right">
          <ThemeToggle />
        </div>
      </nav>

      {/* ── Body: Sidebar + Content ─────────────────────────────── */}
      <div className="dash-body">

        {/* ── Sidebar ── */}
        <aside className="dash-sidebar">
          <p className="dash-sidebar-title" style={{ marginTop: 0 }}>Ano</p>
          <select
            value={ano}
            onChange={(e) => setAno(parseInt(e.target.value))}
            className="dash-filter-select"
            title="Ano"
          >
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>

          <p className="dash-sidebar-title">Cenário</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {CENARIOS.map((c) => (
              <button
                key={c}
                onClick={() => setCenario(c)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: cenario === c ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                  background: cenario === c ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--background-card, var(--background))",
                  color: cenario === c ? "var(--accent)" : "var(--foreground-secondary)",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                {c}
              </button>
            ))}
          </div>

          <p className="dash-sidebar-title">Gerente</p>
          <select
            value={gerenteId}
            onChange={(e) => setGerenteId(e.target.value)}
            className="dash-filter-select"
            title="Gerente"
          >
            <option value="">Consolidado</option>
            {gerentes.map((g) => (
              <option key={g.id} value={g.id}>{g.name ?? g.id}</option>
            ))}
          </select>

          {/* Toggle métricas */}
          <button
            onClick={() => setShowMetricas((v) => !v)}
            style={{
              width: "100%",
              padding: "8px 10px",
              marginTop: 12,
              borderRadius: 6,
              border: showMetricas ? "1.5px solid var(--accent-gold)" : "1px solid var(--border)",
              background: showMetricas ? "rgba(184,134,11,0.12)" : "var(--background-card, var(--background))",
              color: showMetricas ? "var(--accent-gold)" : "var(--foreground-secondary)",
              fontSize: "0.72rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "all 0.2s",
            }}
          >
            <TrendingUp style={{ width: 13, height: 13 }} />
            {showMetricas ? "Ocultar Análise" : "Ver Análise"}
          </button>

          {/* Lançar dados */}
          <Link
            href="/dre/historico/lancar"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 10px",
              marginTop: 8,
              borderRadius: 6,
              border: "1px solid var(--accent)",
              background: "var(--accent)",
              color: "#fff",
              fontSize: "0.72rem",
              fontWeight: 700,
              textDecoration: "none",
              transition: "opacity 0.15s",
            }}
          >
            <Upload style={{ width: 13, height: 13 }} />
            Lançar Dados
          </Link>

          {/* Info filtros ativos */}
          {(gerenteId || cenario !== "REAL") && (
            <div className="sidebar-info-box" style={{ marginTop: 10 }}>
              {cenario !== "REAL" && <div>Cenário: <strong style={{ color: "var(--foreground)" }}>{cenario}</strong></div>}
              {gerenteSelecionado && <div>Gerente: <strong style={{ color: "var(--foreground)" }}>{gerenteSelecionado.name}</strong></div>}
            </div>
          )}
        </aside>

        {/* ── Conteúdo Principal ── */}
        <main className="dash-content" style={{ maxWidth: "100%", overflowX: "hidden" }}>

          {/* Empty State */}
          {!loading && !hasData && (
            <div className="dre-hist-empty">
              <DollarSign size={48} className="dre-hist-empty-icon" />
              <h2>Nenhum dado encontrado</h2>
              <p>Não há dados de DRE para {ano} — {cenario} — {gerenteSelecionado ? gerenteSelecionado.name : "Consolidado"}.</p>
              <Link href="/dre/historico/lancar" className="dre-hist-lancar-btn">
                <Upload size={16} />
                Lançar Dados Agora
              </Link>
            </div>
          )}

          {/* Tabela P&L */}
          {(loading || hasData) && (
            <>
              <div className="dre-hist-section-label">
                <span>P&L — {cenario} {ano} — R$ mil</span>
              </div>

              <div className="dre-hist-table-wrap">
                <table className="dre-hist-table">
                  <thead>
                    <tr>
                      <th className="dre-th-label">P&L</th>
                      {MESES_ABREV.map((m) => <th key={m} className="dre-th-mes">{m}</th>)}
                      <th className="dre-th-acum">ACUM</th>
                      {showMetricas && (
                        <>
                          <th className="dre-th-metric" title="Média últimos 3 meses">Méd 3m</th>
                          <th className="dre-th-metric" title="Rolling average 6 meses">Rol 6m</th>
                          <th className="dre-th-metric" title="Média últimos 12 meses">Méd 12m</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 15 }).map((_, i) => (
                          <tr key={i} className="dre-row-skeleton">
                            <td colSpan={showMetricas ? 17 : 14}>
                              <div className="dre-skeleton-bar" />
                            </td>
                          </tr>
                        ))
                      : plRows.map((row) => (
                          <tr
                            key={row.linha_codigo}
                            className={`dre-row ${row.isBold ? "dre-row--bold" : ""} ${row.isHighlight ? "dre-row--highlight" : ""}`}
                          >
                            <td className="dre-td-label">{row.linha_nome}</td>
                            {row.meses.map((v, i) => (
                              <td key={i} className={`dre-td-val ${v === null ? "dre-td-empty" : ""}`}>
                                {fmt(v, false, false)}
                              </td>
                            ))}
                            <td className={`dre-td-acum ${colorClass(row.acum, NEG_GOOD.includes(row.linha_codigo))}`}>
                              {fmt(row.acum, false, false)}
                            </td>
                            {showMetricas && (
                              <>
                                <td className="dre-td-metric">{fmt(row.media3m, false, false)}</td>
                                <td className="dre-td-metric">{fmt(row.rolling6m, false, false)}</td>
                                <td className="dre-td-metric">{fmt(row.media12m, false, false)}</td>
                              </>
                            )}
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>

              {/* Tabela Indicadores Unitários */}
              <div className="dre-hist-section-label" style={{ marginTop: "1.25rem" }}>
                <span>Indicadores Unitários (por Kg / %)</span>
              </div>

              <div className="dre-hist-table-wrap">
                <table className="dre-hist-table dre-hist-table--unit">
                  <thead>
                    <tr>
                      <th className="dre-th-label">Indicador</th>
                      {MESES_ABREV.map((m) => <th key={m} className="dre-th-mes">{m}</th>)}
                      <th className="dre-th-acum">MÉD</th>
                      {showMetricas && (
                        <>
                          <th className="dre-th-metric">Méd 3m</th>
                          <th className="dre-th-metric">Rol 6m</th>
                          <th className="dre-th-metric">Méd 12m</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 17 }).map((_, i) => (
                          <tr key={i} className="dre-row-skeleton">
                            <td colSpan={showMetricas ? 17 : 14}>
                              <div className="dre-skeleton-bar" />
                            </td>
                          </tr>
                        ))
                      : unitRows.map((row) => (
                          <tr
                            key={row.linha_codigo}
                            className={`dre-row ${row.isBold ? "dre-row--bold" : ""}`}
                          >
                            <td className="dre-td-label">{row.linha_nome}</td>
                            {row.meses.map((v, i) => (
                              <td key={i} className={`dre-td-val ${v === null ? "dre-td-empty" : ""}`}>
                                {fmt(v, true, row.isPercent ?? false)}
                              </td>
                            ))}
                            <td className="dre-td-acum dre-td-acum--unit">
                              {fmt(row.acum, true, row.isPercent ?? false)}
                            </td>
                            {showMetricas && (
                              <>
                                <td className="dre-td-metric">{fmt(row.media3m, true, row.isPercent ?? false)}</td>
                                <td className="dre-td-metric">{fmt(row.rolling6m, true, row.isPercent ?? false)}</td>
                                <td className="dre-td-metric">{fmt(row.media12m, true, row.isPercent ?? false)}</td>
                              </>
                            )}
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>

              {/* Legenda */}
              {showMetricas && (
                <div className="dre-hist-legend">
                  <Info size={13} />
                  <span><strong>Méd 3m</strong>: média dos 3 últimos meses com dados</span>
                  <span className="dre-hist-legend-sep">·</span>
                  <span><strong>Rol 6m</strong>: rolling average 6 meses</span>
                  <span className="dre-hist-legend-sep">·</span>
                  <span><strong>Méd 12m</strong>: média dos últimos 12 meses</span>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── Bottom Nav ─────────────────────────────────────────── */}
      <nav className="bottom-nav">
        <Link href="/" className="bottom-tab"><span>🏠</span><span>Início</span></Link>
        <span className="bottom-tab bottom-tab--active">
          <DollarSign className="bottom-tab-icon" /> DRE
        </span>
        <Link href="/vendas" className="bottom-tab">
          <BarChart3 className="bottom-tab-icon" /><span>Vendas</span>
        </Link>
      </nav>
    </div>
  );
}
