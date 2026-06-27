"use client";

import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
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
  preco_flat: number;
  preco_acao: number;
}

interface FamiliaRow {
  familia: string;
  months: Record<string, MonthData>;
  total: MonthData;
}

interface RedeRow {
  rede: string;
  gerente: string;
  uf: string;
  canal: string;
  familias: Record<string, FamiliaRow>;
  months: Record<string, MonthData>;
  total: MonthData;
}

export default function InvestimentoPorMesPage() {
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
  const [expandedRedes, setExpandedRedes] = useState<Set<string>>(new Set());

  const [rawVendas, setRawVendas] = useState<any[]>([]);
  const [rawInvest, setRawInvest] = useState<any[]>([]);
  const [redesMap, setRedesMap] = useState<Record<string, RedeMapInfo>>({});

  const toggleRede = (rede: string) => {
    setExpandedRedes(prev => {
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

      // 2. Fetch Vendas
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
        .select("mes_referencia, rede, familia_produto, valor_investimento, preco_flat, preco_acao")
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
    };

    const grouped: Record<string, RedeRow> = {};

    const getOrCreateRede = (redeRaw: string) => {
      const redeKey = (redeRaw || "N/I").toUpperCase().trim();
      if (!grouped[redeKey]) {
        const info = redesMap[redeKey] || { nome: redeRaw || "N/I", gerente: "Sem Gerente", uf: "N/I", canal: "N/I" };
        grouped[redeKey] = {
          rede: redeRaw || "N/I",
          gerente: info.gerente,
          uf: info.uf,
          canal: info.canal,
          familias: {},
          months: {},
          total: { fat: 0, inv: 0, preco_flat: 0, preco_acao: 0 }
        };
      }
      return { redeKey, row: grouped[redeKey] };
    };

    const getOrCreateFamilia = (redeRow: RedeRow, familiaRaw: string) => {
      const famKey = (familiaRaw || "N/I").toUpperCase().trim();
      if (!redeRow.familias[famKey]) {
        redeRow.familias[famKey] = {
          familia: familiaRaw || "N/I",
          months: {},
          total: { fat: 0, inv: 0, preco_flat: 0, preco_acao: 0 }
        };
      }
      return redeRow.familias[famKey];
    };

    // 1. Process Vendas
    rawVendas.forEach((v: any) => {
      const { redeKey, row } = getOrCreateRede(v.rede);
      const famRow = getOrCreateFamilia(row, v.tipo_produto);
      const mes = v.mes;
      const fat = (Number(v.fat) || 0) / 1000;

      if (!row.months[mes]) row.months[mes] = { fat: 0, inv: 0, preco_flat: 0, preco_acao: 0 };
      if (!famRow.months[mes]) famRow.months[mes] = { fat: 0, inv: 0, preco_flat: 0, preco_acao: 0 };

      row.months[mes].fat += fat;
      famRow.months[mes].fat += fat;
      row.total.fat += fat;
      famRow.total.fat += fat;

      mapOptions.managers.add(row.gerente);
      mapOptions.ufs.add(row.uf);
      mapOptions.channels.add(row.canal);
      mapOptions.matrizes.add(row.rede);
      mapOptions.familias.add(famRow.familia);
    });

    // 2. Process Investimentos
    rawInvest.forEach((i: any) => {
      const { redeKey, row } = getOrCreateRede(i.rede);
      const famRow = getOrCreateFamilia(row, i.familia_produto);
      const mes = i.mes_referencia;
      const inv = Number(i.valor_investimento) || 0;
      const precoFlat = Number(i.preco_flat) || 0;
      const precoAcao = Number(i.preco_acao) || 0;

      if (!row.months[mes]) row.months[mes] = { fat: 0, inv: 0, preco_flat: 0, preco_acao: 0 };
      if (!famRow.months[mes]) famRow.months[mes] = { fat: 0, inv: 0, preco_flat: 0, preco_acao: 0 };

      row.months[mes].inv += inv;
      famRow.months[mes].inv += inv;
      row.total.inv += inv;
      famRow.total.inv += inv;
      
      if (precoFlat > 0) {
        row.months[mes].preco_flat = Math.max(row.months[mes].preco_flat, precoFlat);
        famRow.months[mes].preco_flat = Math.max(famRow.months[mes].preco_flat, precoFlat);
        row.total.preco_flat = Math.max(row.total.preco_flat, precoFlat);
        famRow.total.preco_flat = Math.max(famRow.total.preco_flat, precoFlat);
      }
      if (precoAcao > 0) {
        row.months[mes].preco_acao = Math.max(row.months[mes].preco_acao, precoAcao);
        famRow.months[mes].preco_acao = Math.max(famRow.months[mes].preco_acao, precoAcao);
        row.total.preco_acao = Math.max(row.total.preco_acao, precoAcao);
        famRow.total.preco_acao = Math.max(famRow.total.preco_acao, precoAcao);
      }

      mapOptions.managers.add(row.gerente);
      mapOptions.ufs.add(row.uf);
      mapOptions.channels.add(row.canal);
      mapOptions.matrizes.add(row.rede);
      mapOptions.familias.add(famRow.familia);
    });

    // 3. Apply Filters
    let filtered = Object.values(grouped).filter(r => {
      if (r.total.inv <= 0) return false;
      if (filterManager.length > 0 && !filterManager.includes(r.gerente)) return false;
      if (filterUf.length > 0 && !filterUf.includes(r.uf)) return false;
      if (filterChannel.length > 0 && !filterChannel.includes(r.canal)) return false;
      if (filterMatriz.length > 0 && !filterMatriz.includes(r.rede)) return false;
      return true;
    });

    // Filtro de família precisa ser aplicado dentro das redes, ou remover a rede se não sobrar família
    filtered = filtered.filter(r => {
        // Só exibir famílias que tiveram investimento
        let fams = Object.values(r.familias).filter(f => f.total.inv > 0);
        
        if (filterFamilia.length > 0) {
          fams = fams.filter(f => filterFamilia.includes(f.familia));
        }

        if (fams.length === 0) return false;
        
        // Recalcular totais da rede baseados apenas nas famílias filtradas
        r.familias = {};
        r.months = {};
        r.total = { fat: 0, inv: 0, preco_flat: 0, preco_acao: 0 };
        
        fams.forEach(f => {
          r.familias[f.familia.toUpperCase()] = f;
          Object.keys(f.months).forEach(m => {
            if (!r.months[m]) r.months[m] = { fat: 0, inv: 0, preco_flat: 0, preco_acao: 0 };
            r.months[m].fat += f.months[m].fat;
            r.months[m].inv += f.months[m].inv;
            r.months[m].preco_flat = Math.max(r.months[m].preco_flat, f.months[m].preco_flat);
            r.months[m].preco_acao = Math.max(r.months[m].preco_acao, f.months[m].preco_acao);
          });
          r.total.fat += f.total.fat;
          r.total.inv += f.total.inv;
          r.total.preco_flat = Math.max(r.total.preco_flat, f.total.preco_flat);
          r.total.preco_acao = Math.max(r.total.preco_acao, f.total.preco_acao);
        });
        
        return true;
      });

    const getPctInternal = (inv: number, fat: number) => fat > 0 ? (inv / fat) * 100 : 0;
    
    filtered.sort((a, b) => {
      const pctA = getPctInternal(a.total.inv, a.total.fat);
      const pctB = getPctInternal(b.total.inv, b.total.fat);
      if (Math.abs(pctA - pctB) > 0.01) return pctB - pctA;
      return b.total.inv - a.total.inv;
    });

    const gTotal = { fat: 0, inv: 0, preco_flat: 0, preco_acao: 0, months: {} as Record<string, MonthData> };
    filtered.forEach(r => {
      gTotal.fat += r.total.fat;
      gTotal.inv += r.total.inv;
      gTotal.preco_flat = Math.max(gTotal.preco_flat, r.total.preco_flat);
      gTotal.preco_acao = Math.max(gTotal.preco_acao, r.total.preco_acao);
      Object.keys(r.months).forEach(m => {
        if (!gTotal.months[m]) gTotal.months[m] = { fat: 0, inv: 0, preco_flat: 0, preco_acao: 0 };
        gTotal.months[m].fat += r.months[m].fat;
        gTotal.months[m].inv += r.months[m].inv;
        gTotal.months[m].preco_flat = Math.max(gTotal.months[m].preco_flat, r.months[m].preco_flat);
        gTotal.months[m].preco_acao = Math.max(gTotal.months[m].preco_acao, r.months[m].preco_acao);
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
        products: [] // placeholder for Linha SKU
      }
    };
  }, [rawVendas, rawInvest, redesMap, filterManager, filterFamilia, filterUf, filterChannel, filterMatriz]);

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
              Rede: r.rede,
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
                Investimento por Mês
              </h1>
              <p className="text-foreground-secondary mt-2 flex items-center gap-2">
                Acompanhamento mensal de Investimento vs Faturamento
              </p>
            </div>
          </header>

          <div className="glass-card flex-1 flex flex-col overflow-hidden relative">
            {loading ? (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : null}

            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse min-w-max text-[11px]">
                <thead className="sticky top-0 z-30 shadow-[0_2px_10px_rgba(0,0,0,0.1)]">
                  <tr>
                    <th rowSpan={2} className="p-3 border-b border-border border-r font-semibold text-foreground bg-background-elevated sticky left-0 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-bottom">
                      Redes
                    </th>
                    <th colSpan={5} className="p-2 text-center border-b border-r border-border font-bold text-foreground bg-background-elevated uppercase tracking-widest text-[10px]">
                      Total Período
                    </th>
                    {monthsInRange.map(m => (
                      <th key={m} colSpan={5} className="p-2 text-center border-b border-r border-border font-bold text-foreground bg-background-elevated uppercase tracking-widest text-[10px]">
                        {renderMonthLabel(m)}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className="p-2 text-right border-b border-border bg-background-elevated text-foreground-secondary font-medium w-[90px]">Fat</th>
                    <th className="p-2 text-right border-b border-border bg-background-elevated text-cyan-600 font-medium w-[90px]">Inv</th>
                    <th className="p-2 text-right border-b border-border bg-background-elevated text-foreground-secondary font-medium w-[60px]">%</th>
                    <th className="p-2 text-right border-b border-border bg-background-elevated text-foreground-secondary font-medium w-[90px]">Pr. Flat</th>
                    <th className="p-2 text-right border-b border-r border-border bg-background-elevated text-foreground-secondary font-medium w-[90px]">Pr. Promo</th>
                    
                    {monthsInRange.map(m => (
                      <Fragment key={`sub-${m}`}>
                        <th className="p-2 text-right border-b border-border bg-background-elevated text-foreground-secondary font-medium w-[90px]">Fat</th>
                        <th className="p-2 text-right border-b border-border bg-background-elevated text-cyan-600 font-medium w-[90px]">Inv</th>
                        <th className="p-2 text-right border-b border-border bg-background-elevated text-foreground-secondary font-medium w-[60px]">%</th>
                        <th className="p-2 text-right border-b border-border bg-background-elevated text-foreground-secondary font-medium w-[90px]">Pr. Flat</th>
                        <th className="p-2 text-right border-b border-r border-border bg-background-elevated text-foreground-secondary font-medium w-[90px]">Pr. Promo</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tableData.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={5 + (monthsInRange.length * 5)} className="p-8 text-center text-foreground-muted">
                        Nenhum dado encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {tableData.map(row => {
                        const isExpanded = expandedRedes.has(row.rede);
                        const famList = Object.values(row.familias).sort((a, b) => {
                          const pctA = getPct(a.total.inv, a.total.fat);
                          const pctB = getPct(b.total.inv, b.total.fat);
                          if (Math.abs(pctA - pctB) > 0.01) return pctB - pctA;
                          return b.total.inv - a.total.inv;
                        });

                        return (
                          <Fragment key={row.rede}>
                            {/* LINHA PRINCIPAL - REDE */}
                            <tr className="hover:bg-foreground/5 transition-colors group cursor-pointer" onClick={() => toggleRede(row.rede)}>
                              <td className="p-3 border-r border-border font-semibold text-foreground sticky left-0 bg-background-card group-hover:bg-background-elevated z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                                <div className="flex items-center gap-2">
                                  <ChevronRight className={`w-4 h-4 text-foreground-muted transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                  <span className="truncate max-w-[200px]" title={row.rede}>{row.rede}</span>
                                </div>
                              </td>
                              
                              {/* TOTAL PERIODO */}
                              <td className="p-2 text-right font-medium text-foreground">{formatCurrency(row.total.fat)}</td>
                              <td className="p-2 text-right font-medium text-cyan-500" style={{ color: (row.total.inv > 0 && row.total.fat <= 0) ? 'var(--danger)' : undefined }}>{formatCurrency(row.total.inv)}</td>
                              <td className="p-2 text-right font-bold border-border" style={{ color: (row.total.inv > 0 && row.total.fat <= 0) || getPct(row.total.inv, row.total.fat) > 10 ? 'var(--danger)' : 'var(--foreground)' }}>
                                {formatPercent(getPct(row.total.inv, row.total.fat))}
                              </td>
                              <td className="p-2 text-right font-medium text-foreground-secondary">{row.total.preco_flat > 0 ? formatCurrency(row.total.preco_flat) : '-'}</td>
                              <td className="p-2 text-right font-medium text-foreground-secondary border-r border-border">{row.total.preco_acao > 0 ? formatCurrency(row.total.preco_acao) : '-'}</td>

                              {/* MESES */}
                              {monthsInRange.map(m => {
                                const d = row.months[m] || { fat: 0, inv: 0 };
                                const pctVal = getPct(d.inv, d.fat);
                                return (
                                  <Fragment key={`cell-${row.rede}-${m}`}>
                                    <td className="p-2 text-right text-foreground-secondary">{d.fat ? formatCurrency(d.fat) : '-'}</td>
                                    <td className="p-2 text-right text-cyan-600/80" style={{ color: (d.inv > 0 && d.fat <= 0) ? 'var(--danger)' : undefined }}>{d.inv ? formatCurrency(d.inv) : '-'}</td>
                                    <td className="p-2 text-right border-border" style={{ color: (d.inv > 0 && d.fat <= 0) || pctVal > 10 ? 'var(--danger)' : 'var(--foreground-muted)' }}>
                                      {d.fat || d.inv ? formatPercent(pctVal) : '-'}
                                    </td>
                                    <td className="p-2 text-right text-foreground-muted">{d.preco_flat > 0 ? formatCurrency(d.preco_flat) : '-'}</td>
                                    <td className="p-2 text-right border-r border-border text-foreground-muted">{d.preco_acao > 0 ? formatCurrency(d.preco_acao) : '-'}</td>
                                  </Fragment>
                                );
                              })}
                            </tr>

                            {/* LINHAS EXPANDIDAS - FAMILIAS */}
                            {isExpanded && famList.map(fam => (
                              <tr key={`${row.rede}-${fam.familia}`} className="bg-foreground/[0.02] hover:bg-foreground/[0.04]">
                                <td className="p-3 pl-8 border-r border-border font-medium text-foreground-secondary sticky left-0 bg-background-elevated z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                  <span className="truncate max-w-[180px] block" title={fam.familia}>{fam.familia}</span>
                                </td>
                                
                                <td className="p-2 text-right text-foreground-secondary">{formatCurrency(fam.total.fat)}</td>
                                <td className="p-2 text-right text-cyan-600/70" style={{ color: (fam.total.inv > 0 && fam.total.fat <= 0) ? 'var(--danger)' : undefined }}>{formatCurrency(fam.total.inv)}</td>
                                <td className="p-2 text-right border-border text-foreground-muted" style={{ color: (fam.total.inv > 0 && fam.total.fat <= 0) ? 'var(--danger)' : undefined }}>
                                  {formatPercent(getPct(fam.total.inv, fam.total.fat))}
                                </td>
                                <td className="p-2 text-right text-foreground-muted">{fam.total.preco_flat > 0 ? formatCurrency(fam.total.preco_flat) : '-'}</td>
                                <td className="p-2 text-right border-r border-border text-foreground-muted">{fam.total.preco_acao > 0 ? formatCurrency(fam.total.preco_acao) : '-'}</td>

                                {monthsInRange.map(m => {
                                  const d = fam.months[m] || { fat: 0, inv: 0 };
                                  return (
                                    <Fragment key={`fcell-${fam.familia}-${m}`}>
                                      <td className="p-2 text-right text-foreground-muted">{d.fat ? formatCurrency(d.fat) : '-'}</td>
                                      <td className="p-2 text-right text-cyan-600/50" style={{ color: (d.inv > 0 && d.fat <= 0) ? 'var(--danger)' : undefined }}>{d.inv ? formatCurrency(d.inv) : '-'}</td>
                                      <td className="p-2 text-right border-border text-foreground-muted/50" style={{ color: (d.inv > 0 && d.fat <= 0) ? 'var(--danger)' : undefined }}>
                                        {d.fat || d.inv ? formatPercent(getPct(d.inv, d.fat)) : '-'}
                                      </td>
                                      <td className="p-2 text-right text-foreground-muted/50">{d.preco_flat > 0 ? formatCurrency(d.preco_flat) : '-'}</td>
                                      <td className="p-2 text-right border-r border-border text-foreground-muted/50">{d.preco_acao > 0 ? formatCurrency(d.preco_acao) : '-'}</td>
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
                      <td className="p-2 text-right font-semibold text-foreground-secondary">{grandTotal.preco_flat > 0 ? formatCurrency(grandTotal.preco_flat) : '-'}</td>
                      <td className="p-2 text-right font-semibold text-foreground-secondary border-r border-border">{grandTotal.preco_acao > 0 ? formatCurrency(grandTotal.preco_acao) : '-'}</td>
                      
                      {monthsInRange.map(m => {
                        const d = grandTotal.months[m] || { fat: 0, inv: 0 };
                        return (
                          <Fragment key={`tcell-${m}`}>
                            <td className="p-2 text-right font-semibold text-foreground-secondary">{formatCurrency(d.fat)}</td>
                            <td className="p-2 text-right font-semibold text-cyan-600">{formatCurrency(d.inv)}</td>
                            <td className="p-2 text-right font-semibold text-foreground-secondary border-border">{formatPercent(getPct(d.inv, d.fat))}</td>
                            <td className="p-2 text-right font-semibold text-foreground-secondary">{d.preco_flat > 0 ? formatCurrency(d.preco_flat) : '-'}</td>
                            <td className="p-2 text-right font-semibold text-foreground-secondary border-r border-border">{d.preco_acao > 0 ? formatCurrency(d.preco_acao) : '-'}</td>
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
