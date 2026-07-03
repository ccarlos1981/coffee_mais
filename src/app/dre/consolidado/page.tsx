"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, DollarSign, BarChart3, TrendingUp, History, Users, Loader2, ChevronDown, ChevronRight, Percent, Calendar, Home } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { createClient } from "@/lib/supabase/client";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const YEARS = [2026, 2025, 2024, 2023];

export default function DREConsolidadoPage() {
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGerentes, setExpandedGerentes] = useState<Record<string, boolean>>({});

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("cm_dre_financeiro")
        .select("*")
        .eq("ano", filterYear)
        .eq("mes", filterMonth)
        .eq("is_active", true)
        .eq("is_deleted", false);

      setRows(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterMonth, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Agregações de Gerente & Redes
  const aggregates = useMemo(() => {
    const managerMap: Record<string, {
      name: string;
      volume: number;
      receita: number;
      impostos: number;
      invest_comercial: number;
      receita_liquida: number;
      custo_produtos: number;
      frete: number;
      mc: number;
      dga: number;
      custo_rede: number;
      ebitda: number;
      redes: Record<string, {
        name: string;
        volume: number;
        receita: number;
        impostos: number;
        invest_comercial: number;
        receita_liquida: number;
        custo_produtos: number;
        frete: number;
        mc: number;
        dga: number;
        custo_rede: number;
        ebitda: number;
      }>;
    }> = {};

    rows.forEach((r) => {
      const gerente = r.gerente_id || "Sem Gerente";
      const rede = r.codigo_matriz || "Sem Rede";

      if (!managerMap[gerente]) {
        managerMap[gerente] = {
          name: gerente,
          volume: 0,
          receita: 0,
          impostos: 0,
          invest_comercial: 0,
          receita_liquida: 0,
          custo_produtos: 0,
          frete: 0,
          mc: 0,
          dga: 0,
          custo_rede: 0,
          ebitda: 0,
          redes: {},
        };
      }

      const m = managerMap[gerente];
      m.volume += Number(r.volume) || 0;
      m.receita += Number(r.receita_bruta) || 0;
      m.impostos += Number(r.impostos) || 0;
      m.invest_comercial += Number(r.investimento_comercial) || 0;
      m.receita_liquida += Number(r.receita_liquida) || 0;
      m.custo_produtos += Number(r.custo_produtos) || 0;
      m.frete += Number(r.frete) || 0;
      m.mc += Number(r.margem_contribuicao) || 0;
      m.dga += Number(r.dga) || 0;
      m.custo_rede += Number(r.custo_rede) || 0;
      m.ebitda += Number(r.ebitda) || 0;

      if (!m.redes[rede]) {
        m.redes[rede] = {
          name: rede,
          volume: 0,
          receita: 0,
          impostos: 0,
          invest_comercial: 0,
          receita_liquida: 0,
          custo_produtos: 0,
          frete: 0,
          mc: 0,
          dga: 0,
          custo_rede: 0,
          ebitda: 0,
        };
      }

      const n = m.redes[rede];
      n.volume += Number(r.volume) || 0;
      n.receita += Number(r.receita_bruta) || 0;
      n.impostos += Number(r.impostos) || 0;
      n.invest_comercial += Number(r.investimento_comercial) || 0;
      n.receita_liquida += Number(r.receita_liquida) || 0;
      n.custo_produtos += Number(r.custo_produtos) || 0;
      n.frete += Number(r.frete) || 0;
      n.mc += Number(r.margem_contribuicao) || 0;
      n.dga += Number(r.dga) || 0;
      n.custo_rede += Number(r.custo_rede) || 0;
      n.ebitda += Number(r.ebitda) || 0;
    });

    return Object.values(managerMap).sort((a, b) => {
      if (b.volume !== a.volume) return b.volume - a.volume;
      return b.receita - a.receita; // secondary sort by faturamento
    });
  }, [rows]);

  // Totais Globais
  const totals = useMemo(() => {
    const t = { volume: 0, receita: 0, mc: 0, ebitda: 0, invest_comercial: 0 };
    aggregates.forEach((m) => {
      t.volume += m.volume;
      t.receita += m.receita;
      t.mc += m.mc;
      t.ebitda += m.ebitda;
      t.invest_comercial += m.invest_comercial;
    });
    return t;
  }, [aggregates]);

  const toggleGerente = (name: string) => {
    setExpandedGerentes(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const fmtVal = (v: number) => {
    if (v === 0 || isNaN(v) || !isFinite(v)) return "0";
    const abs = Math.abs(v);
    const formatted = abs.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return v < 0 ? `(${formatted})` : formatted;
  };

  const fmtPct = (v: number) => {
    if (v === undefined || v === null || v === 0 || isNaN(v) || !isFinite(v)) return "0.0%";
    return `${v.toFixed(1)}%`;
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* NAVBAR */}
      <nav className="cm-navbar" style={{ position: "relative" }}>
        <Link href="/" className="cm-logo">Coffee<span>++</span></Link>
        <div className="cm-nav-links">
          <Link href="/" className="cm-nav-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 10, borderRight: "1px solid var(--border)", paddingRight: 15 }}>
            <Home style={{ width: 14, height: 14, color: "var(--accent-gold)" }} />
            <span>Menu</span>
          </Link>
          <Link href="/dre" className="cm-nav-link">Consolidado</Link>
          <Link href="/dre/historico" className="cm-nav-link">Mês a Mês</Link>
          <Link href="/dre/consolidado" className="cm-nav-link active">Gerentes</Link>
          <Link href="/dre/rede" className="cm-nav-link">Redes</Link>
          <Link href="/dre/historico/auditoria" className="cm-nav-link">Auditoria & Fechamento</Link>
        </div>
        <div className="cm-nav-right">
          <ThemeToggle />
        </div>
      </nav>

      {/* BODY: SIDEBAR + MAIN */}
      <div className="dash-body">
        {/* SIDEBAR */}
        <aside className="dash-sidebar">
          <p className="dash-sidebar-title" style={{ marginTop: 0 }}>Exercício</p>
          <select title="Ano" value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="dash-filter-select">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <p className="dash-sidebar-title">Mês</p>
          <select title="Mês" value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="dash-filter-select">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </aside>

        {/* MAIN CONTENT */}
        <main className="dash-content" style={{ width: "100%", padding: 24 }}>
          {/* Page Header */}
          <div style={{ display: "flex", justifyContent: "between", alignItems: "center", marginBottom: 15, width: "100%", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--foreground)", margin: 0, textTransform: "uppercase" }}>
                DRE — Performance por Gerente
              </h2>
              <p style={{ fontSize: "0.68rem", color: "var(--foreground-muted)", margin: "2px 0 0 0" }}>
                Comparativo de resultados e margens por gestor — <span style={{ opacity: 0.7 }}>*Valores em R$ Mil / Volume em Tons</span>
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-3">
              <Loader2 className="w-8 h-8 text-gold animate-spin" />
              <span className="text-sm text-muted">Consolidando DRE por gerente...</span>
            </div>
          ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="glass-card flex flex-col justify-between p-4">
                <span className="text-xs text-muted font-semibold uppercase">Faturamento Bruto</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-black text-foreground">R$ {fmtVal(totals.receita)}</span>
                </div>
              </div>
              <div className="glass-card flex flex-col justify-between p-4">
                <span className="text-xs text-muted font-semibold uppercase">Volume Total</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-black text-foreground">{fmtVal(totals.volume)} <span className="text-xs font-normal text-muted">Tons</span></span>
                </div>
              </div>
              <div className="glass-card flex flex-col justify-between p-4">
                <span className="text-xs text-muted font-semibold uppercase">Margem de Contribuição</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-black text-gold">R$ {fmtVal(totals.mc)}</span>
                </div>
              </div>
              <div className="glass-card flex flex-col justify-between p-4">
                <span className="text-xs text-muted font-semibold uppercase">EBITDA Total</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-black text-foreground">R$ {fmtVal(totals.ebitda)}</span>
                </div>
              </div>
              <div className="glass-card flex flex-col justify-between p-4">
                <span className="text-xs text-muted font-semibold uppercase">Preço / Kg</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-black text-foreground">
                    R$ {totals.volume > 0 ? (totals.receita / totals.volume).toFixed(2).replace(".", ",") : "0,00"}
                  </span>
                </div>
              </div>
            </div>

            {/* Gerente Table */}
            <div className="glass-card overflow-hidden p-0">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-background/80 border-b border-border text-muted font-semibold text-xs uppercase font-mono">
                    <th className="p-3 w-8"></th>
                    <th className="p-3">Gerente</th>
                    <th className="p-3 text-center">Volume (Tons)</th>
                    <th className="p-3 text-center">Receita Bruta</th>
                    <th className="p-3 text-center">Margem Contrib. (MC)</th>
                    <th className="p-3 text-center">EBITDA</th>
                    <th className="p-3 text-center">ROI (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {aggregates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted">Nenhum dado encontrado para o período selecionado.</td>
                    </tr>
                  ) : (
                    aggregates.map((m) => {
                      const isExpanded = !!expandedGerentes[m.name];
                      // ROI = EBITDA / Investimento Comercial * 100
                      const roi = m.invest_comercial > 0 ? (m.ebitda / m.invest_comercial) * 100 : 0;

                      return (
                        <Fragment key={m.name}>
                          <tr className="hover:bg-foreground/5 cursor-pointer font-sans" onClick={() => toggleGerente(m.name)}>
                            <td className="p-3 text-center text-gold">
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </td>
                            <td className="p-3 font-semibold text-foreground">{m.name}</td>
                            <td className="p-3 text-center font-mono">{fmtVal(m.volume)}</td>
                            <td className="p-3 text-center font-mono">R$ {fmtVal(m.receita)}</td>
                            <td className="p-3 text-center font-mono text-gold">R$ {fmtVal(m.mc)}</td>
                            <td className="p-3 text-center font-mono">R$ {fmtVal(m.ebitda)}</td>
                            <td className="p-3 text-center font-mono text-gold">{fmtPct(roi)}</td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-background-elevated/40">
                              <td colSpan={7} className="p-0">
                                <div className="border-l-4 border-gold bg-elevated/20 pl-4 py-2 pr-2">
                                  <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                      <tr className="border-b border-border/50 text-muted font-medium font-mono text-[10px] uppercase">
                                        <th className="p-2">Rede (Código Matriz)</th>
                                        <th className="p-2 text-center">Volume (Tons)</th>
                                        <th className="p-2 text-center">Receita Bruta</th>
                                        <th className="p-2 text-center">MC</th>
                                        <th className="p-2 text-center">EBITDA</th>
                                        <th className="p-2 text-center">ROI (%)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/20">
                                      {Object.values(m.redes).map((r: any) => {
                                        const rRoi = r.invest_comercial > 0 ? (r.ebitda / r.invest_comercial) * 100 : 0;
                                        return (
                                          <tr key={r.name} className="hover:bg-border/20">
                                            <td className="p-2 font-medium text-foreground">{r.name}</td>
                                            <td className="p-2 text-center font-mono">{fmtVal(r.volume)}</td>
                                            <td className="p-2 text-center font-mono">R$ {fmtVal(r.receita)}</td>
                                            <td className="p-2 text-center font-mono text-gold">R$ {fmtVal(r.mc)}</td>
                                            <td className="p-2 text-center font-mono">R$ {fmtVal(r.ebitda)}</td>
                                            <td className="p-2 text-center font-mono text-gold">{fmtPct(rRoi)}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
        </main>
      </div>
    </div>
  );
}
