"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, BarChart3, TrendingUp, DollarSign, MapPin, Building2, Coffee, Wallet } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

export default function DashboardClient({ acoes, pdvs }: { acoes: any[]; pdvs: any[] }) {
  const [selectedRede, setSelectedRede] = useState<string>("Todas");
  const [selectedGlobalMonth, setSelectedGlobalMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const last6Months = useMemo(() => {
    const months = [{ value: 'Todos', label: 'Todos os meses' }];
    const now = new Date();
    for (let i = 0; i <= 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        value: format(d, 'yyyy-MM'),
        label: format(d, 'MMM/yyyy', { locale: ptBR })
      });
    }
    return months;
  }, []);

  const filteredAcoesGlobal = useMemo(() => {
    if (selectedGlobalMonth === "Todos") return acoes;
    return acoes.filter(a => {
      if (!a.data_inicio) return false;
      return format(parseISO(a.data_inicio), 'yyyy-MM') === selectedGlobalMonth;
    });
  }, [acoes, selectedGlobalMonth]);

  // 1. UF Mapping
  const ufMap = useMemo(() => {
    const map: Record<string, string> = {};
    pdvs.forEach(p => {
      if (p.rede && p.uf) {
        map[p.rede.toUpperCase()] = p.uf;
      }
    });
    return map;
  }, [pdvs]);

  // 2. Extracted Unique Redes
  const redesList = useMemo(() => {
    const redes = Array.from(new Set(filteredAcoesGlobal.map(a => a.rede).filter(Boolean)));
    return redes.sort();
  }, [filteredAcoesGlobal]);

  // 3. Helper to get Expectativa (Valor Projetado)
  const getValorProjetado = (a: any) => {
    if (a.abrangencia === "SKU" && a.skus_detalhes) {
      return a.skus_detalhes.reduce((acc: number, curr: any) => acc + ((Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0)), 0);
    }
    return (Number(a.valor_investimento) || 0) * (Number(a.expectativa_volume) || 0);
  };

  // Helper to get Faturamento Estimado (Preço * Volume)
  const getFaturamentoEstimado = (a: any) => {
    if (a.abrangencia === "SKU" && a.skus_detalhes) {
      return a.skus_detalhes.reduce((acc: number, curr: any) => acc + ((Number(curr.preco_acao || curr.preco_flat) || 0) * (Number(curr.expectativa_volume) || 0)), 0);
    }
    return (Number(a.preco_acao || a.preco_flat) || 0) * (Number(a.expectativa_volume) || 0);
  };

  // 4. Data for Faturamento vs Investimento Chart
  const chartDataFatInv = useMemo(() => {
    let filtered = acoes;
    if (selectedRede !== "Todas") {
      filtered = filtered.filter(a => a.rede === selectedRede);
    }

    const referenceDate = selectedGlobalMonth === "Todos" 
      ? new Date() 
      : new Date(`${selectedGlobalMonth}-02T00:00:00`); // Day 02 to avoid TZ shift to previous month

    const validMonthKeys = new Set<string>();
    const groups: Record<string, { month: string; Investimento: number; Faturamento: number }> = {};
    
    // Pre-fill the last 6 months ending on the reference date
    for (let i = 5; i >= 0; i--) {
      const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
      const monthKey = format(d, 'yyyy-MM');
      const monthLabel = format(d, 'MMM/yy', { locale: ptBR });
      groups[monthKey] = { month: monthLabel, Investimento: 0, Faturamento: 0 };
      validMonthKeys.add(monthKey);
    }
    
    filtered.forEach(a => {
      if (!a.data_inicio) return;
      const monthKey = format(parseISO(a.data_inicio), 'yyyy-MM');
      
      // Only plot if the action falls into the 6-month historical window
      if (validMonthKeys.has(monthKey)) {
        groups[monthKey].Investimento += Number(a.apuracao_valor_realizado) || 0;
        groups[monthKey].Faturamento += 0; 
      }
    });

    return Object.keys(groups).sort().map(k => {
      const g = groups[k];
      return {
        ...g,
        percentual: g.Faturamento > 0 ? (g.Investimento / g.Faturamento) * 100 : 0
      };
    });
  }, [acoes, selectedRede, selectedGlobalMonth]);

  // 5. Data for % Investimento por Rede
  const chartDataPercRede = useMemo(() => {
    const groups: Record<string, { rede: string; Investimento: number; Faturamento: number }> = {};
    
    filteredAcoesGlobal.forEach(a => {
      const r = a.rede || 'Desconhecida';
      if (!groups[r]) {
        groups[r] = { rede: r, Investimento: 0, Faturamento: 0 };
      }
      groups[r].Investimento += Number(a.apuracao_valor_realizado) || 0;
      // Faturamento (aparecerá zerado por enquanto até integrarmos os dados)
      groups[r].Faturamento += 0;
    });

    return Object.values(groups)
      .map(g => ({
        name: g.rede,
        Investimento: g.Investimento,
        percentual: g.Faturamento > 0 ? Number(((g.Investimento / g.Faturamento) * 100).toFixed(2)) : 0
      }))
      .filter(item => item.Investimento > 0)
      .sort((a, b) => b.percentual - a.percentual)
      .slice(0, 10);
  }, [filteredAcoesGlobal]);

  // 6. Data for Table: Investimento por Rede
  const tableDataRedes = useMemo(() => {
    const groups: Record<string, { rede: string; fatAcao: number; expectFatMes: number; expectInvest: number; investFechado: number; naoProvisionado: number; provisionado: number }> = {};
    
    filteredAcoesGlobal.forEach(a => {
      const r = a.rede || 'Desconhecida';
      if (!groups[r]) {
        groups[r] = { rede: r, fatAcao: 0, expectFatMes: 0, expectInvest: 0, investFechado: 0, naoProvisionado: 0, provisionado: 0 };
      }
      
      groups[r].expectInvest += getValorProjetado(a);
      groups[r].fatAcao += getFaturamentoEstimado(a);
      groups[r].expectFatMes += 0; // faturamento total do mês (aparecerá zerado por enquanto)
      
      const valorRealizado = Number(a.apuracao_valor_realizado) || 0;
      groups[r].investFechado += valorRealizado;
      
      if (valorRealizado > 0) {
        if (a.apuracao_boleto_id) {
          groups[r].provisionado += valorRealizado;
        } else {
          groups[r].naoProvisionado += valorRealizado;
        }
      }
    });

    return Object.values(groups)
      .filter(g => g.expectInvest > 0 || g.naoProvisionado > 0 || g.provisionado > 0)
      .sort((a, b) => b.expectInvest - a.expectInvest);
  }, [filteredAcoesGlobal]);

  // Table Totals
  const totalFatAcao = tableDataRedes.reduce((acc, curr) => acc + curr.fatAcao, 0);
  const totalExpectFatMes = tableDataRedes.reduce((acc, curr) => acc + curr.expectFatMes, 0);
  const totalExpectInvest = tableDataRedes.reduce((acc, curr) => acc + curr.expectInvest, 0);
  const totalInvestFechado = tableDataRedes.reduce((acc, curr) => acc + curr.investFechado, 0);
  const totalNaoProvisionado = tableDataRedes.reduce((acc, curr) => acc + curr.naoProvisionado, 0);
  const totalProvisionado = tableDataRedes.reduce((acc, curr) => acc + curr.provisionado, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Link 
            href="/investimento" 
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-foreground hover:bg-elevated transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-fuchsia-500 to-fuchsia-700">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight leading-tight">
              Dashboard Executivo
            </h1>
            <p className="text-[0.65rem] text-muted leading-tight uppercase tracking-wider">
              Análise de Investimentos
            </p>
          </div>
          <div className="ml-auto">
            <select 
              value={selectedGlobalMonth}
              onChange={(e) => setSelectedGlobalMonth(e.target.value)}
              className="bg-elevated border border-border text-foreground text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-fuchsia-500/50 capitalize"
            >
              {last6Months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3 text-muted">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Wallet className="w-5 h-5 text-emerald-500" />
                </div>
                <h3 className="font-semibold text-sm">Faturamento</h3>
              </div>
            </div>
            <p className="text-xl sm:text-3xl font-black text-foreground tracking-tight">
              R$ 0,00
            </p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-3 text-muted mb-2">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="font-semibold text-sm">Investimento Projetado (Total)</h3>
            </div>
            <p className="text-xl sm:text-3xl font-black text-foreground tracking-tight">
              {formatCurrency(totalExpectInvest)}
            </p>
          </div>
          
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-3 text-muted mb-2">
              <div className="p-2 bg-fuchsia-500/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-fuchsia-500" />
              </div>
              <h3 className="font-semibold text-sm">Valor Realizado (Apuração)</h3>
            </div>
            <p className="text-xl sm:text-3xl font-black text-foreground tracking-tight">
              {formatCurrency(totalInvestFechado)}
            </p>
          </div>
          
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-3 text-muted mb-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="font-semibold text-sm">Redes com Ação</h3>
            </div>
            <p className="text-xl sm:text-3xl font-black text-foreground tracking-tight">
              {redesList.length}
            </p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Faturamento vs Investimento */}
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                Faturamento vs Investimento
              </h2>
              <select 
                value={selectedRede}
                onChange={(e) => setSelectedRede(e.target.value)}
                className="bg-elevated border border-border text-foreground text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-fuchsia-500/50"
              >
                <option value="Todas">Todas as Redes</option>
                {redesList.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-h-[400px]">
              {isMounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartDataFatInv} margin={{ top: 10, right: 0, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="month" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis 
                    yAxisId="left"
                    stroke="#888888" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    width={45}
                    tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} 
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="#6366f1" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    width={30}
                    tickFormatter={(value) => `${value.toFixed(0)}%`} 
                  />
                  <Tooltip 
                    formatter={(value: any, name: any) => {
                      if (name === '% de Investimento') return `${Number(value).toFixed(2)}%`;
                      return formatCurrency(Number(value));
                    }}
                    contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--foreground)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar yAxisId="left" dataKey="Faturamento" fill="#10b981" radius={[4, 4, 0, 0]} name="Faturamento do Mês" />
                  <Bar yAxisId="left" dataKey="Investimento" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Investimento do Mês" />
                  <Line yAxisId="right" type="monotone" dataKey="percentual" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#card' }} activeDot={{ r: 6 }} name="% de Investimento" />
                </ComposedChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* % Investimento por Rede */}
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-6">
              % de Investimento por Rede
            </h2>
            <div className="flex-1 min-h-[400px] flex items-center justify-center">
              {!isMounted ? null : chartDataPercRede.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartDataPercRede} margin={{ top: 10, right: 5, left: -10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#888888" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      angle={-45} 
                      textAnchor="end"
                    />
                    <YAxis 
                      type="number" 
                      stroke="#888888" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      width={35}
                      tickFormatter={(value) => `${value}%`} 
                    />
                    <Tooltip 
                      formatter={(value: any) => `${value}%`}
                      contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)', borderRadius: '8px' }}
                      itemStyle={{ color: 'var(--foreground)' }}
                    />
                    <Bar dataKey="percentual" fill="#14b8a6" radius={[4, 4, 0, 0]} name="% Investimento" barSize={32} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted flex flex-col items-center">
                  <Building2 className="w-8 h-8 mb-2 opacity-50" />
                  <p>Sem dados de investimento para o período.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table: Lista de Investimento por Rede */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">
              Lista de Investimento por Rede
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-elevated text-muted uppercase text-[0.7rem] tracking-wider">
                <tr>
                  <th className="px-6 py-3 border-b border-border border-r border-border/50 font-semibold" rowSpan={2}>Rede</th>
                  <th className="px-6 py-3 border-b border-border border-r-2 border-border font-semibold text-center text-fuchsia-500" rowSpan={2}>% TT de Invest.</th>
                  <th className="px-6 py-3 border-b border-border border-r-2 border-border font-semibold text-center" colSpan={3}>Faturamento</th>
                  <th className="px-6 py-3 border-b border-border font-semibold text-center" colSpan={3}>Investimento</th>
                </tr>
                <tr>
                  <th className="px-6 py-3 border-b border-border font-semibold text-right">Fat. da Ação</th>
                  <th className="px-6 py-3 border-b border-border font-semibold text-right">Expect. de Faturamento</th>
                  <th className="px-6 py-3 border-b border-border border-r-2 border-border font-semibold text-right">% do Faturamento</th>
                  
                  <th className="px-6 py-3 border-b border-border font-semibold text-right">Expect. Invest.</th>
                  <th className="px-6 py-3 border-b border-border font-semibold text-right">Não Provisionado</th>
                  <th className="px-6 py-3 border-b border-border font-semibold text-right text-emerald-500">Provisionado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tableDataRedes.map((row, i) => (
                  <tr key={row.rede} className="hover:bg-elevated/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground flex items-center gap-2 border-r border-border/50">
                      <div className="w-6 h-6 rounded-md bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center flex-shrink-0">
                        <Coffee className="w-3 h-3 text-white" />
                      </div>
                      {row.rede}
                    </td>
                    <td className="px-6 py-4 text-center text-fuchsia-400 font-bold border-r-2 border-border bg-fuchsia-500/5">
                      {row.fatAcao > 0 ? ((row.expectInvest / row.fatAcao) * 100).toFixed(1) + '%' : '-'}
                    </td>
                    <td className="px-6 py-4 text-right text-muted font-medium">
                      {formatCurrency(row.fatAcao)}
                    </td>
                    <td className="px-6 py-4 text-right text-muted font-medium">
                      {formatCurrency(row.expectFatMes)}
                    </td>
                    <td className="px-6 py-4 text-right text-muted font-medium border-r-2 border-border">
                      {row.expectFatMes > 0 ? ((row.fatAcao / row.expectFatMes) * 100).toFixed(1) + '%' : '-'}
                    </td>
                    <td className="px-6 py-4 text-right text-muted font-medium">
                      {formatCurrency(row.expectInvest)}
                    </td>
                    <td className="px-6 py-4 text-right text-orange-400 font-medium">
                      {formatCurrency(row.naoProvisionado)}
                    </td>
                    <td className="px-6 py-4 text-right text-emerald-400 font-medium">
                      {formatCurrency(row.provisionado)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-elevated/80 border-t-2 border-border font-bold">
                <tr>
                  <td className="px-6 py-4 text-foreground border-r border-border/50">TOTAL GERAL</td>
                  <td className="px-6 py-4 text-center text-fuchsia-400 border-r-2 border-border bg-fuchsia-500/5">
                    {totalFatAcao > 0 ? ((totalExpectInvest / totalFatAcao) * 100).toFixed(1) + '%' : '-'}
                  </td>
                  <td className="px-6 py-4 text-right text-muted">{formatCurrency(totalFatAcao)}</td>
                  <td className="px-6 py-4 text-right text-muted">{formatCurrency(totalExpectFatMes)}</td>
                  <td className="px-6 py-4 text-right text-muted border-r-2 border-border">
                    {totalExpectFatMes > 0 ? ((totalFatAcao / totalExpectFatMes) * 100).toFixed(1) + '%' : '-'}
                  </td>
                  <td className="px-6 py-4 text-right text-foreground">{formatCurrency(totalExpectInvest)}</td>
                  <td className="px-6 py-4 text-right text-orange-400">{formatCurrency(totalNaoProvisionado)}</td>
                  <td className="px-6 py-4 text-right text-emerald-400">{formatCurrency(totalProvisionado)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
