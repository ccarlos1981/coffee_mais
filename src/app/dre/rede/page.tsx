"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ChevronDown, ChevronRight, RefreshCw, Layers, Home } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { createClient } from "@/lib/supabase/client";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const YEARS = [2026, 2025, 2024, 2023];

export default function DRERedePage() {
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterManager, setFilterManager] = useState("Todos");
  const [filterFamilia, setFilterFamilia] = useState("Todos");
  const [filterChannel, setFilterChannel] = useState("Todos");
  const [filterOptions, setFilterOptions] = useState<{
    managers: string[];
    familias: string[];
    channels: string[];
  }>({ managers: [], familias: [], channels: [] });

  const [rows, setRows] = useState<any[]>([]);
  const [prevRows, setPrevRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRedes, setExpandedRedes] = useState<Record<string, boolean>>({});

  const supabase = createClient();

  // Buscar opções de filtro
  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/filters?year=${filterYear}&month=${filterMonth}`);
      const json = await res.json();
      if (json.success) {
        setFilterOptions(json.filters);
      }
    } catch (e) {
      console.error("Erro ao carregar filtros:", e);
    }
  }, [filterYear, filterMonth]);

  // Calcular ano e mês anterior
  const prevPeriod = useMemo(() => {
    let y = filterYear;
    let m = filterMonth - 1;
    if (m === 0) {
      m = 12;
      y = filterYear - 1;
    }
    return { year: y, month: m };
  }, [filterYear, filterMonth]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Mês Atual
      let q1 = supabase
        .from("cm_dre_financeiro")
        .select("*")
        .eq("ano", filterYear)
        .eq("mes", filterMonth)
        .eq("is_active", true)
        .eq("is_deleted", false);

      if (filterManager !== "Todos") q1 = q1.eq("gerente_id", filterManager);
      if (filterChannel !== "Todos") q1 = q1.eq("canal_id", filterChannel);
      if (filterFamilia !== "Todos") q1 = q1.eq("familia_id", filterFamilia);

      const { data: currentData } = await q1;

      // 2. Mês Anterior
      let q2 = supabase
        .from("cm_dre_financeiro")
        .select("*")
        .eq("ano", prevPeriod.year)
        .eq("mes", prevPeriod.month)
        .eq("is_active", true)
        .eq("is_deleted", false);

      if (filterManager !== "Todos") q2 = q2.eq("gerente_id", filterManager);
      if (filterChannel !== "Todos") q2 = q2.eq("canal_id", filterChannel);
      if (filterFamilia !== "Todos") q2 = q2.eq("familia_id", filterFamilia);

      const { data: previousData } = await q2;

      setRows(currentData || []);
      setPrevRows(previousData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterMonth, prevPeriod, supabase, filterManager, filterChannel, filterFamilia]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Agregações no nível de Rede (Matriz)
  const networkData = useMemo(() => {
    const map: Record<string, {
      matriz: string;
      gerente: string;
      regiao: string;
      canal: string;
      tons: number;
      fat: number;
      imp: number;
      desc_bonif_acord: number;
      rec_liq: number;
      fret: number;
      cmv: number;
      mc: number;
      ebitda: number;
      prevMc: number;
      prevTons: number;
      prevFat: number;
    }> = {};

    // Mês Atual
    rows.forEach((r) => {
      const rede = r.codigo_matriz || "Sem Rede";
      if (!map[rede]) {
        map[rede] = {
          matriz: rede,
          gerente: r.gerente_id || "Todos",
          regiao: r.uf || "N/D",
          canal: r.canal_id || "Todos",
          tons: 0,
          fat: 0,
          imp: 0,
          desc_bonif_acord: 0,
          rec_liq: 0,
          fret: 0,
          cmv: 0,
          mc: 0,
          ebitda: 0,
          prevMc: 0,
          prevTons: 0,
          prevFat: 0
        };
      }
      const m = map[rede];
      m.tons += Number(r.volume) || 0;
      m.fat += Number(r.receita_bruta) || 0;
      m.imp += Number(r.impostos) || 0;
      m.desc_bonif_acord += Number(r.investimento_comercial) || 0;
      m.rec_liq += Number(r.receita_liquida) || 0;
      m.fret += Number(r.frete) || 0;
      m.cmv += Number(r.custo_produtos) || 0;
      m.mc += Number(r.margem_contribuicao) || 0;
      m.ebitda += Number(r.ebitda) || 0;
    });

    // Mesclar Mês Anterior
    prevRows.forEach((r) => {
      const rede = r.codigo_matriz || "Sem Rede";
      if (map[rede]) {
        map[rede].prevMc += Number(r.margem_contribuicao) || 0;
        map[rede].prevTons += Number(r.volume) || 0;
        map[rede].prevFat += Number(r.receita_bruta) || 0;
      }
    });

    return Object.values(map).sort((a, b) => {
      if (b.tons !== a.tons) return b.tons - a.tons;
      return b.fat - a.fat; // fallback to faturamento
    });
  }, [rows, prevRows]);

  // Breakdown de SKUs e Família de uma determinada rede
  const getBreakdown = (matriz: string) => {
    const list = rows.filter(r => (r.codigo_matriz || "Sem Rede") === matriz);
    // Agrupar por SKU e Família
    const grouped: Record<string, {
      familia: string;
      sku: string;
      volume: number;
      receita: number;
      margem: number;
      ebitda: number;
    }> = {};

    list.forEach(r => {
      const key = `${r.familia_id || "ALL"}_${r.sku_id || "ALL"}`;
      if (!grouped[key]) {
        grouped[key] = {
          familia: r.familia_id || "N/A",
          sku: r.sku_id || "N/A",
          volume: 0,
          receita: 0,
          margem: 0,
          ebitda: 0
        };
      }
      grouped[key].volume += Number(r.volume) || 0;
      grouped[key].receita += Number(r.receita_bruta) || 0;
      grouped[key].margem += Number(r.margem_contribuicao) || 0;
      grouped[key].ebitda += Number(r.ebitda) || 0;
    });

    return Object.values(grouped);
  };

  const toggleRede = (matriz: string) => {
    setExpandedRedes(prev => ({ ...prev, [matriz]: !prev[matriz] }));
  };

  const fmtVal = (v: number) => {
    if (v === 0 || isNaN(v) || !isFinite(v)) return "0";
    const abs = Math.abs(v);
    const formatted = abs.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return v < 0 ? `(${formatted})` : formatted;
  };

  const fmtUnit = (v: number) => {
    if (v === 0 || isNaN(v) || !isFinite(v)) return "0,00";
    const abs = Math.abs(v);
    const formatted = abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return v < 0 ? `(${formatted})` : formatted;
  };

  const fmtPct = (v: number) => {
    if (v === 0 || isNaN(v) || !isFinite(v)) return "0,0%";
    const abs = Math.abs(v);
    const formatted = abs.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return v < 0 ? `(${formatted}%)` : `${formatted}%`;
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
          <Link href="/dre/consolidado" className="cm-nav-link">Gerentes</Link>
          <Link href="/dre/rede" className="cm-nav-link active">Redes</Link>
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

          <p className="dash-sidebar-title">Gerente</p>
          <select value={filterManager} onChange={(e) => setFilterManager(e.target.value)} className="dash-filter-select">
            <option value="Todos">Todos</option>
            {filterOptions.managers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <p className="dash-sidebar-title">Família</p>
          <select value={filterFamilia} onChange={(e) => setFilterFamilia(e.target.value)} className="dash-filter-select">
            <option value="Todos">Todos</option>
            {filterOptions.familias.map(f => <option key={f} value={f}>{f}</option>)}
          </select>

          <p className="dash-sidebar-title">Canal</p>
          <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="dash-filter-select">
            <option value="Todos">Todos</option>
            {filterOptions.channels.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </aside>

        {/* MAIN CONTENT */}
        <main className="dash-content" style={{ width: "100%", padding: 24 }}>
          {/* Page Header */}
          <div style={{ display: "flex", justifyContent: "between", alignItems: "center", marginBottom: 15, width: "100%", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--foreground)", margin: 0, textTransform: "uppercase" }}>
                DRE por Matriz / Rede
              </h2>
              <p style={{ fontSize: "0.68rem", color: "var(--foreground-muted)", margin: "2px 0 0 0" }}>
                Demonstrativo detalhado por cliente e canais com drill-down por SKU/Família — <span style={{ opacity: 0.7 }}>*Valores em R$ Mil / Volume em Tons</span>
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-3">
              <Loader2 className="w-8 h-8 text-gold animate-spin" />
              <span className="text-sm text-muted">Carregando DRE por rede...</span>
            </div>
          ) : (
            <div className="glass-card overflow-hidden p-0">
            <div style={{ overflowX: "auto" }}>
              <table className="w-full text-left border-collapse text-[0.72rem] font-sans" style={{ width: "100%" }}>
                <thead>
                  <tr className="bg-background/80 border-b border-border text-muted font-semibold uppercase font-mono text-[9.5px]">
                    <th className="p-2 w-6"></th>
                    <th className="p-2">Rede</th>
                    <th className="p-2">Gestor</th>
                    <th className="p-2 text-center">Vol (Tons)</th>
                    <th className="p-2 text-center">Fat R$</th>
                    <th className="p-2 text-center">Imp (%)</th>
                    <th className="p-2 text-center">Inv (%)</th>
                    <th className="p-2 text-center">R. Líq</th>
                    <th className="p-2 text-center">Custo</th>
                    <th className="p-2 text-center">Frete (%)</th>
                    <th className="p-2 text-center text-gold bg-gold/12 border-l border-r border-gold/30 font-bold text-[10px]">MC</th>
                    <th className="p-2 text-center text-gold">MC/Kg</th>
                    <th className="p-2 text-center">MC/Kg Ant</th>
                    <th className="p-2 text-center">P/Kg</th>
                    <th className="p-2 text-center">MC Ant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {networkData.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="p-8 text-center text-muted">Nenhum dado encontrado para o período selecionado.</td>
                    </tr>
                  ) : (
                    networkData.map((n) => {
                      const isExpanded = !!expandedRedes[n.matriz];
                      const mcKg = n.tons > 0 ? (n.mc / n.tons) : 0;
                      const prevMcKg = n.prevTons > 0 ? (n.prevMc / n.prevTons) : 0;
                      const faturamentoKg = n.tons > 0 ? (n.fat / n.tons) : 0;

                      return (
                        <Fragment key={n.matriz}>
                          <tr className="hover:bg-foreground/5 cursor-pointer font-sans" onClick={() => toggleRede(n.matriz)}>
                            <td className="p-2 text-center text-gold">
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </td>
                            <td className="p-2 font-semibold text-foreground">{n.matriz}</td>
                            <td className="p-2 text-muted">{n.gerente}</td>
                            <td className="p-2 text-center font-mono">{fmtVal(n.tons)}</td>
                            <td className="p-2 text-center font-mono">R$ {fmtVal(n.fat)}</td>
                            <td className="p-2 text-center font-mono">{fmtPct(-(n.fat > 0 ? (n.imp / n.fat) * 100 : 0))}</td>
                            <td className="p-2 text-center font-mono">{fmtPct(-(n.fat > 0 ? (n.desc_bonif_acord / n.fat) * 100 : 0))}</td>
                            <td className="p-2 text-center font-mono">R$ {fmtVal(n.rec_liq)}</td>
                            <td className="p-2 text-center font-mono">{n.cmv === 0 ? "0" : `(${fmtVal(n.cmv)})`}</td>
                            <td className="p-2 text-center font-mono">{fmtPct(-(n.fat > 0 ? (n.fret / n.fat) * 100 : 0))}</td>
                            <td className="p-2 text-center font-mono text-gold font-bold bg-gold/12 border-l border-r border-gold/30 text-[0.78rem]">R$ {fmtVal(n.mc)}</td>
                            <td className="p-2 text-center font-mono text-gold">R$ {fmtUnit(mcKg)}</td>
                            <td className="p-2 text-center font-mono">R$ {fmtUnit(prevMcKg)}</td>
                            <td className="p-2 text-center font-mono">R$ {fmtUnit(faturamentoKg)}</td>
                            <td className="p-2 text-center font-mono text-muted">R$ {fmtVal(n.prevMc)}</td>
                          </tr>
                          
                          {isExpanded && (
                            <tr className="bg-background-elevated/40">
                              <td colSpan={15} className="p-0">
                                <div className="border-l-4 border-gold bg-elevated/20 pl-6 py-2 pr-2">
                                  <div className="flex items-center gap-1.5 mb-2 text-gold font-bold text-[10px] uppercase font-mono">
                                    <Layers className="w-3.5 h-3.5" /> Breakdown por Família & SKU — {n.matriz}
                                  </div>
                                  <table className="w-full text-[0.65rem] text-left border-collapse" style={{ maxWidth: 900 }}>
                                    <thead>
                                      <tr className="border-b border-border/50 text-muted font-medium font-mono text-[9px] uppercase">
                                        <th className="p-1.5">Família</th>
                                        <th className="p-1.5">SKU</th>
                                        <th className="p-1.5 text-center">Volume (Tons)</th>
                                        <th className="p-1.5 text-center">Faturamento</th>
                                        <th className="p-1.5 text-center">Margem (MC)</th>
                                        <th className="p-1.5 text-center">EBITDA</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/20">
                                      {getBreakdown(n.matriz).map((item) => (
                                        <tr key={`${item.familia}_${item.sku}`} className="hover:bg-border/20">
                                          <td className="p-1.5 font-medium text-foreground">{item.familia}</td>
                                          <td className="p-1.5 text-muted">{item.sku}</td>
                                          <td className="p-1.5 text-center font-mono">{fmtVal(item.volume)}</td>
                                          <td className="p-1.5 text-center font-mono">R$ {fmtVal(item.receita)}</td>
                                          <td className="p-1.5 text-center font-mono text-gold">R$ {fmtVal(item.margem)}</td>
                                          <td className="p-1.5 text-center font-mono">R$ {fmtVal(item.ebitda)}</td>
                                        </tr>
                                      ))}
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
          </div>
        )}
        </main>
      </div>
    </div>
  );
}
