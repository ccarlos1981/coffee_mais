"use client";

import { useState, useEffect, useMemo, useCallback, Fragment, useRef } from "react";
import Link from "next/link";
import { Filter, ChevronRight, BarChart3, Calendar, Layers, DollarSign, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { ThemeToggle } from "@/components/ThemeProvider";
import { MultiSelect } from "@/components/MultiSelect";
import { ExportButton } from "@/components/ExportButton";

const MONTHS_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

const YEARS = [2026, 2025, 2024, 2023, 2022];

interface RedeMapInfo {
  nome: string;
  gerente: string;
  uf: string;
  canal: string;
}

interface MonthData {
  fat: number;
  inv: number;
}

interface CanalSubRow {
  nome: string;
  months: Record<string, MonthData>;
  total: MonthData;
}

interface GerenteRow {
  gerente: string;
  canais: Record<string, CanalSubRow>;
  months: Record<string, MonthData>;
  total: MonthData;
}

export default function DashGerencialPage() {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const currentYear = new Date().getFullYear();
  const [startMonth, setStartMonth] = useState<number>(1);
  const [startYear, setStartYear] = useState<number>(currentYear);
  const [endMonth, setEndMonth] = useState<number>(12);
  const [endYear, setEndYear] = useState<number>(currentYear);

  const [filterManager, setFilterManager] = useState<string[]>([]);
  const [filterFamilia, setFilterFamilia] = useState<string[]>([]);
  const [filterUf, setFilterUf] = useState<string[]>([]);
  const [filterChannel, setFilterChannel] = useState<string[]>([]);
  const [filterMatriz, setFilterMatriz] = useState<string[]>([]);
  const [filterProduct, setFilterProduct] = useState<string[]>([]); // Linha SKU (placeholder)

  const [loading, setLoading] = useState(false);
  const [expandedGerentes, setExpandedGerentes] = useState<Set<string>>(new Set());

  const [rawVendas, setRawVendas] = useState<any[]>([]);
  const [rawInvest, setRawInvest] = useState<any[]>([]);
  const [redesMap, setRedesMap] = useState<Record<string, RedeMapInfo>>({});

  const toggleGerente = (rede: string) => {
    setExpandedGerentes(prev => {
      const next = new Set(prev);
      if (next.has(rede)) next.delete(rede);
      else next.add(rede);
      return next;
    });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const sDate = `${startYear}-${String(startMonth).padStart(2, '0')}`;
      const eDate = `${endYear}-${String(endMonth).padStart(2, '0')}`;

      // 1. Fetch Matrizes details for mapping
      const { data: matrizes, error: mErr } = await supabase
        .from("v_redes_matrizes_detalhes")
        .select("nome, gerente, uf, canal");
      
      if (mErr) throw mErr;
      
      const rMap: Record<string, RedeMapInfo> = {};
      (matrizes || []).forEach((m: any) => {
        if (m.nome) {
          rMap[m.nome.toUpperCase().trim()] = {
            nome: m.nome,
            gerente: m.gerente || "Sem Gerente",
            uf: m.uf || "N/I",
            canal: m.canal || "N/I"
          };
        }
      });
      setRedesMap(rMap);

      const { data: vendas, error: vErr } = await supabase
        .from("mv_vendas_mensal")
        .select("mes, rede, tipo_produto, fat")
        .gte("mes", sDate)
        .lte("mes", eDate)
        .limit(50000);

      if (vErr) throw vErr;
      setRawVendas(vendas || []);

      // 3. Fetch Investimentos
      const { data: invs, error: iErr } = await supabase
        .from("cm_acoes_investimento")
        .select("mes_referencia, rede, valor_investimento")
        .eq("is_planejamento", false)
        .gte("mes_referencia", sDate)
        .lte("mes_referencia", eDate);
      
      if (iErr) throw iErr;
      setRawInvest(invs || []);

    } catch (err) {
      console.error("Erro ao buscar dados:", err);
    } finally {
      setLoading(false);
    }
  }, [startMonth, startYear, endMonth, endYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClearFilters = () => {
    setFilterManager([]);
    setFilterFamilia([]);
    setFilterUf([]);
    setFilterChannel([]);
    setFilterMatriz([]);
    setFilterProduct([]);
  };

  const activeFilterCount = filterManager.length + filterFamilia.length + filterUf.length + filterChannel.length + filterMatriz.length + filterProduct.length;
  const hasActiveFilters = activeFilterCount > 0;

  // Gerar lista de meses no range selecionado
  const monthsInRange = useMemo(() => {
    const list: string[] = [];
    let currentY = startYear;
    let currentM = startMonth;
    while (currentY < endYear || (currentY === endYear && currentM <= endMonth)) {
      list.push(`${currentY}-${String(currentM).padStart(2, '0')}`);
      currentM++;
      if (currentM > 12) {
        currentM = 1;
        currentY++;
      }
      // Safety break
      if (list.length > 36) break;
    }
    return list;
  }, [startMonth, startYear, endMonth, endYear]);

  // Aggregate and Filter Data
  const { tableData, filterOptions, grandTotal } = useMemo(() => {
    const mapOptions = {
      managers: new Set<string>(),
      familias: new Set<string>(),
      ufs: new Set<string>(),
      channels: new Set<string>(),
      matrizes: new Set<string>(),
      products: new Set<string>()
    };

    const grouped: Record<string, GerenteRow> = {};

    const getOrCreateGerente = (gerenteRaw: string) => {
      const gerenteKey = (gerenteRaw || "N/I").toUpperCase().trim();
      if (!grouped[gerenteKey]) {
        grouped[gerenteKey] = {
          gerente: gerenteRaw || "N/I",
          canais: {},
          months: {},
          total: { fat: 0, inv: 0 }
        };
      }
      return { gerenteKey, row: grouped[gerenteKey] };
    };

    const getOrCreateCanalSub = (gerenteRow: GerenteRow, canalRaw: string) => {
      const canalKey = (canalRaw || "N/I").toUpperCase().trim();
      if (!gerenteRow.canais[canalKey]) {
        gerenteRow.canais[canalKey] = {
          nome: canalRaw || "N/I",
          months: {},
          total: { fat: 0, inv: 0 }
        };
      }
      return gerenteRow.canais[canalKey];
    };

    // 1. Process Vendas
    rawVendas.forEach((v: any) => {
      const redeNorm = v.rede ? v.rede.toUpperCase().trim() : "";
      const redeInfo = redesMap[redeNorm] || { gerente: "Sem Gerente", uf: "N/I", canal: "N/I" };
      
      const gerente = redeInfo.gerente || "Sem Gerente";
      const canal = redeInfo.canal || "N/I";
      const uf = redeInfo.uf || "N/I";
      const rede = v.rede || "N/I";
      const familia = v.tipo_produto || "N/I";

      mapOptions.managers.add(gerente);
      mapOptions.ufs.add(uf);
      mapOptions.channels.add(canal);
      mapOptions.matrizes.add(rede);
      mapOptions.familias.add(familia);

      if (filterManager.length > 0 && !filterManager.includes(gerente)) return;
      if (filterUf.length > 0 && !filterUf.includes(uf)) return;
      if (filterChannel.length > 0 && !filterChannel.includes(canal)) return;
      if (filterMatriz.length > 0 && !filterMatriz.includes(rede)) return;
      if (filterFamilia.length > 0 && !filterFamilia.includes(familia)) return;

      const { row } = getOrCreateGerente(gerente);
      const subRow = getOrCreateCanalSub(row, canal);
      const mes = v.mes;
      const fat = (Number(v.fat) || 0) / 1000;

      if (!row.months[mes]) row.months[mes] = { fat: 0, inv: 0 };
      if (!subRow.months[mes]) subRow.months[mes] = { fat: 0, inv: 0 };

      row.months[mes].fat += fat;
      subRow.months[mes].fat += fat;
      row.total.fat += fat;
      subRow.total.fat += fat;
    });

    // 2. Process Investimentos
    rawInvest.forEach((v: any) => {
      const redeNorm = v.rede ? v.rede.toUpperCase().trim() : "";
      const redeInfo = redesMap[redeNorm] || { gerente: "Sem Gerente", uf: "N/I", canal: "N/I" };
      
      const gerente = redeInfo.gerente || "Sem Gerente";
      const canal = redeInfo.canal || "N/I";
      const uf = redeInfo.uf || "N/I";
      const rede = v.rede || "N/I";

      mapOptions.managers.add(gerente);
      mapOptions.ufs.add(uf);
      mapOptions.channels.add(canal);
      mapOptions.matrizes.add(rede);

      if (filterManager.length > 0 && !filterManager.includes(gerente)) return;
      if (filterUf.length > 0 && !filterUf.includes(uf)) return;
      if (filterChannel.length > 0 && !filterChannel.includes(canal)) return;
      if (filterMatriz.length > 0 && !filterMatriz.includes(rede)) return;

      const { row } = getOrCreateGerente(gerente);
      const subRow = getOrCreateCanalSub(row, canal);
      const mes = v.mes_referencia;
      const inv = Number(v.valor_investimento) || 0;

      if (!row.months[mes]) row.months[mes] = { fat: 0, inv: 0 };
      if (!subRow.months[mes]) subRow.months[mes] = { fat: 0, inv: 0 };

      row.months[mes].inv += inv;
      subRow.months[mes].inv += inv;
      row.total.inv += inv;
      subRow.total.inv += inv;
    });

    let filtered = Object.values(grouped).filter(r => {
      // Filtrar canais sem investimento
      let canaisComInv = Object.values(r.canais).filter(c => c.total.inv > 0);
      if (canaisComInv.length === 0) return false;
      
      // Recalcular os totais do gerente baseados APENAS nos canais que sobraram
      r.canais = {};
      r.months = {};
      r.total = { fat: 0, inv: 0 };
      
      canaisComInv.forEach(c => {
        r.canais[c.nome.toUpperCase()] = c;
        Object.keys(c.months).forEach(m => {
          if (!r.months[m]) r.months[m] = { fat: 0, inv: 0 };
          r.months[m].fat += c.months[m].fat;
          r.months[m].inv += c.months[m].inv;
        });
        r.total.fat += c.total.fat;
        r.total.inv += c.total.inv;
      });

      return r.total.inv > 0;
    });

    const getPctInternal = (inv: number, fat: number) => fat > 0 ? (inv / fat) * 100 : 0;
    
    filtered.sort((a, b) => {
      const pctA = getPctInternal(a.total.inv, a.total.fat);
      const pctB = getPctInternal(b.total.inv, b.total.fat);
      if (Math.abs(pctA - pctB) > 0.01) return pctB - pctA;
      return b.total.inv - a.total.inv;
    });

    let gTotal = { fat: 0, inv: 0, months: {} as Record<string, MonthData> };
    monthsInRange.forEach(m => gTotal.months[m] = { fat: 0, inv: 0 });
    filtered.forEach(r => {
      gTotal.fat += r.total.fat;
      gTotal.inv += r.total.inv;
      Object.keys(r.months).forEach(m => {
        gTotal.months[m].fat += r.months[m].fat;
        gTotal.months[m].inv += r.months[m].inv;
      });
    });

    return {
      tableData: filtered,
      grandTotal: gTotal,
      filterOptions: {
        managers: Array.from(mapOptions.managers).sort(),
        familias: Array.from(mapOptions.familias).sort(),
        ufs: Array.from(mapOptions.ufs).sort(),
        channels: Array.from(mapOptions.channels).sort(),
        matrizes: Array.from(mapOptions.matrizes).sort(),
        products: []
      }
    };
  }, [rawVendas, rawInvest, filterManager, filterFamilia, filterUf, filterChannel, filterMatriz, filterProduct, monthsInRange, redesMap]);

  const renderMonthLabel = (YYYYMM: string) => {
    const parts = YYYYMM.split('-');
    if (parts.length !== 2) return YYYYMM;
    const mIdx = parseInt(parts[1], 10) - 1;
    return `${MONTHS_NAMES[mIdx]}/${parts[0].slice(2)}`;
  };

  const getPct = (inv: number, fat: number) => {
    if (fat <= 0) return 0;
    return (inv / fat) * 100;
  };

  useEffect(() => {
    if (!loading && tableData.length > 0) {
      // pequeno delay para o DOM renderizar a tabela
      const timer = setTimeout(() => {
        const currentMonthStr = new Date().toISOString().slice(0, 7);
        const th = document.getElementById(`header-${currentMonthStr}`);
        const container = tableContainerRef.current;
        if (th && container) {
          const containerRect = container.getBoundingClientRect();
          const thRect = th.getBoundingClientRect();
          // scroll atual + posição do th relativa ao container, menos 260px (largura da coluna fixa)
          const targetScrollLeft = container.scrollLeft + (thRect.left - containerRect.left) - 260;
          container.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: 'smooth' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [loading, tableData.length]);

  return (
    <div className="flex h-screen bg-background font-sans">
      {/* ═══ SIDEBAR ═══ */}
      <aside className="w-[280px] flex-shrink-0 bg-background-elevated border-r border-border overflow-y-auto hidden lg:flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] relative z-20">
        <div className="p-6 sticky top-0 bg-background-elevated/80 backdrop-blur-xl border-b border-border z-10">
          <Link href="/" className="inline-flex items-center gap-2 text-foreground-secondary hover:text-foreground transition-colors mb-6 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Voltar ao Painel</span>
          </Link>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-500" />
              Filtros
            </h2>
            <ThemeToggle />
          </div>
          <p className="text-xs text-foreground-muted leading-relaxed">
            Visão consolidada de Investimentos por Mês.
          </p>
        </div>

        <div className="p-6 flex-1 space-y-6">
          <div className="space-y-4">
            <div>
              <p className="dash-sidebar-title" style={{ marginTop: 0 }}>Mês Inicial</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                <select value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))} className="dash-filter-select">
                  {MONTHS_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} className="dash-filter-select">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div>
              <p className="dash-sidebar-title">Mês Final</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                <select value={endMonth} onChange={(e) => setEndMonth(Number(e.target.value))} className="dash-filter-select">
                  {MONTHS_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select value={endYear} onChange={(e) => setEndYear(Number(e.target.value))} className="dash-filter-select">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div>
              <p className="dash-sidebar-title">Gerente</p>
              <MultiSelect value={filterManager} onChange={setFilterManager} options={filterOptions.managers} className="dash-filter-select" placeholder="Todos" />
            </div>

            <div>
              <p className="dash-sidebar-title">Família</p>
              <MultiSelect value={filterFamilia} onChange={setFilterFamilia} options={filterOptions.familias} className="dash-filter-select" placeholder="Todas" />
            </div>

            <div>
              <p className="dash-sidebar-title">Região (UF)</p>
              <MultiSelect value={filterUf} onChange={setFilterUf} options={filterOptions.ufs} className="dash-filter-select" placeholder="Todos" />
            </div>

            <div>
              <p className="dash-sidebar-title">Canal</p>
              <MultiSelect value={filterChannel} onChange={setFilterChannel} options={filterOptions.channels} className="dash-filter-select" placeholder="Todos" />
            </div>

            <div>
              <p className="dash-sidebar-title">Rede</p>
              <MultiSelect value={filterMatriz} onChange={setFilterMatriz} options={filterOptions.matrizes} className="dash-filter-select" placeholder="Todas" />
            </div>

            <div>
              <p className="dash-sidebar-title">Linha SKU</p>
              <MultiSelect value={filterProduct} onChange={setFilterProduct} options={filterOptions.products} className="dash-filter-select" placeholder="Todas" />
            </div>
          </div>

          {hasActiveFilters && (
            <button onClick={handleClearFilters} className="cm-btn-clear w-full mt-4">
              <Filter style={{ width: 11, height: 11 }} />
              Limpar Filtros ({activeFilterCount})
            </button>
          )}

          <ExportButton 
            data={tableData.map(r => ({
              Gerente: r.gerente,
              Total_Fat: Number(r.total.fat.toFixed(2)),
              Total_Inv: Number(r.total.inv.toFixed(2)),
              Total_Pct: Number(getPct(r.total.inv, r.total.fat).toFixed(2))
            }))}
            filename={`Investimento_por_Mes`}
            className="w-full mt-4 justify-center"
            variant="outline"
          />
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="flex-1 overflow-auto bg-[url('/noise.png')] bg-repeat opacity-95 relative flex flex-col">
        <div className="p-8 max-w-[1600px] mx-auto w-full flex-1 flex flex-col">
          
          <header className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                Dash Gerencial
              </h1>
              <p className="text-foreground-secondary mt-2 flex items-center gap-2">
                Visão global de negócios por Gerente e Canal
              </p>
            </div>
          </header>

          <div className="glass-card flex-1 flex flex-col overflow-hidden relative">
            {loading ? (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : null}

            <div className="overflow-auto flex-1" ref={tableContainerRef}>
              <table className="w-full text-left border-collapse min-w-max text-[11px]">
                <thead className="sticky top-0 z-30 shadow-[0_2px_10px_rgba(0,0,0,0.1)]">
                  <tr>
                    <th rowSpan={2} className="p-3 border-b border-border border-r font-semibold text-foreground bg-background-elevated sticky left-0 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-bottom">
                      Gerente / Canal
                    </th>
                    <th colSpan={3} className="p-2 text-center border-b border-r border-border font-bold text-foreground bg-background-elevated uppercase tracking-widest text-[10px]">
                      Total Período
                    </th>
                    {monthsInRange.map(m => (
                      <th key={m} id={`header-${m}`} colSpan={3} className="p-2 text-center border-b border-r border-border font-bold text-foreground bg-background-elevated uppercase tracking-widest text-[10px]">
                        {renderMonthLabel(m)}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className="p-2 text-right border-b border-border bg-background-elevated text-foreground-secondary font-medium w-[90px]">Fat</th>
                    <th className="p-2 text-right border-b border-border bg-background-elevated text-cyan-600 font-medium w-[90px]">Inv</th>
                    <th className="p-2 text-right border-b border-border bg-background-elevated text-foreground-secondary font-medium w-[60px]">%</th>
                    
                    {monthsInRange.map(m => (
                      <Fragment key={`sub-${m}`}>
                        <th className="p-2 text-right border-b border-border bg-background-elevated text-foreground-secondary font-medium w-[90px]">Fat</th>
                        <th className="p-2 text-right border-b border-border bg-background-elevated text-cyan-600 font-medium w-[90px]">Inv</th>
                        <th className="p-2 text-right border-b border-border bg-background-elevated text-foreground-secondary font-medium w-[60px]">%</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tableData.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={3 + (monthsInRange.length * 3)} className="p-8 text-center text-foreground-muted">
                        Nenhum dado encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {tableData.map(row => {
                        const isExpanded = expandedGerentes.has(row.gerente);
                        const subList = Object.values(row.canais).sort((a, b) => {
                          const pctA = getPct(a.total.inv, a.total.fat);
                          const pctB = getPct(b.total.inv, b.total.fat);
                          if (Math.abs(pctA - pctB) > 0.01) return pctB - pctA;
                          return b.total.inv - a.total.inv;
                        });

                        return (
                          <Fragment key={row.gerente}>
                            {/* LINHA PRINCIPAL - REDE */}
                            <tr className="hover:bg-foreground/5 transition-colors group cursor-pointer" onClick={() => toggleGerente(row.gerente)}>
                              <td className="p-3 border-r border-border font-semibold text-foreground sticky left-0 bg-background-card group-hover:bg-background-elevated z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                                <div className="flex items-center gap-2">
                                  <ChevronRight className={`w-4 h-4 text-foreground-muted transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                  <span className="truncate max-w-[200px]" title={row.gerente}>{row.gerente}</span>
                                </div>
                              </td>
                              
                              {/* TOTAL PERIODO */}
                              <td className="p-2 text-right font-medium text-foreground">{formatCurrency(row.total.fat)}</td>
                              <td className="p-2 text-right font-medium text-cyan-500" style={{ color: (row.total.inv > 0 && row.total.fat <= 0) ? 'var(--danger)' : undefined }}>{formatCurrency(row.total.inv)}</td>
                              <td className="p-2 text-right font-bold border-border" style={{ color: (row.total.inv > 0 && row.total.fat <= 0) || getPct(row.total.inv, row.total.fat) > 10 ? 'var(--danger)' : 'var(--foreground)' }}>
                                {formatPercent(getPct(row.total.inv, row.total.fat))}
                              </td>

                              {/* MESES */}
                              {monthsInRange.map(m => {
                                const d = row.months[m] || { fat: 0, inv: 0 };
                                const pctVal = getPct(d.inv, d.fat);
                                return (
                                  <Fragment key={`cell-${row.gerente}-${m}`}>
                                    <td className="p-2 text-right text-foreground-secondary">{d.fat ? formatCurrency(d.fat) : '-'}</td>
                                    <td className="p-2 text-right text-cyan-600/80" style={{ color: (d.inv > 0 && d.fat <= 0) ? 'var(--danger)' : undefined }}>{d.inv ? formatCurrency(d.inv) : '-'}</td>
                                    <td className="p-2 text-right border-border" style={{ color: (d.inv > 0 && d.fat <= 0) || pctVal > 10 ? 'var(--danger)' : 'var(--foreground-muted)' }}>
                                      {d.fat || d.inv ? formatPercent(pctVal) : '-'}
                                    </td>
                                  </Fragment>
                                );
                              })}
                            </tr>

                            {/* LINHAS EXPANDIDAS - FAMILIAS */}
                            {isExpanded && subList.map(sub => (
                              <tr key={`${row.gerente}-${sub.nome}`} className="bg-foreground/[0.02] hover:bg-foreground/[0.04]">
                                <td className="p-3 pl-8 border-r border-border font-medium text-foreground-secondary sticky left-0 bg-background-elevated z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                  <span className="truncate max-w-[180px] block" title={sub.nome}>{sub.nome}</span>
                                </td>
                                
                                <td className="p-2 text-right text-foreground-secondary">{formatCurrency(sub.total.fat)}</td>
                                <td className="p-2 text-right text-cyan-600/70" style={{ color: (sub.total.inv > 0 && sub.total.fat <= 0) ? 'var(--danger)' : undefined }}>{formatCurrency(sub.total.inv)}</td>
                                <td className="p-2 text-right border-border text-foreground-muted" style={{ color: (sub.total.inv > 0 && sub.total.fat <= 0) ? 'var(--danger)' : undefined }}>
                                  {formatPercent(getPct(sub.total.inv, sub.total.fat))}
                                </td>

                                {monthsInRange.map(m => {
                                  const d = sub.months[m] || { fat: 0, inv: 0 };
                                  return (
                                    <Fragment key={`fcell-${sub.nome}-${m}`}>
                                      <td className="p-2 text-right text-foreground-muted">{d.fat ? formatCurrency(d.fat) : '-'}</td>
                                      <td className="p-2 text-right text-cyan-600/50" style={{ color: (d.inv > 0 && d.fat <= 0) ? 'var(--danger)' : undefined }}>{d.inv ? formatCurrency(d.inv) : '-'}</td>
                                      <td className="p-2 text-right border-border text-foreground-muted/50" style={{ color: (d.inv > 0 && d.fat <= 0) ? 'var(--danger)' : undefined }}>
                                        {d.fat || d.inv ? formatPercent(getPct(d.inv, d.fat)) : '-'}
                                      </td>
                                    </Fragment>
                                  );
                                })}
                              </tr>
                            ))}
                          </Fragment>
                        );
                      })}
                    </>
                  )}
                </tbody>
                {tableData.length > 0 && (
                  <tfoot className="sticky bottom-0 z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
                    <tr className="bg-background-elevated border-t-2 border-border">
                      <td className="p-3 border-r border-border font-bold text-foreground sticky left-0 bg-background-elevated z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] uppercase text-[10px] tracking-widest">
                        TOTAL GERAL
                      </td>
                      <td className="p-2 text-right font-bold text-foreground">{formatCurrency(grandTotal.fat)}</td>
                      <td className="p-2 text-right font-bold text-cyan-500">{formatCurrency(grandTotal.inv)}</td>
                      <td className="p-2 text-right font-bold text-foreground border-border">{formatPercent(getPct(grandTotal.inv, grandTotal.fat))}</td>
                      
                      {monthsInRange.map(m => {
                        const d = grandTotal.months[m] || { fat: 0, inv: 0 };
                        return (
                          <Fragment key={`tcell-${m}`}>
                            <td className="p-2 text-right font-semibold text-foreground-secondary">{formatCurrency(d.fat)}</td>
                            <td className="p-2 text-right font-semibold text-cyan-600">{formatCurrency(d.inv)}</td>
                            <td className="p-2 text-right font-semibold text-foreground-secondary border-border">{formatPercent(getPct(d.inv, d.fat))}</td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
