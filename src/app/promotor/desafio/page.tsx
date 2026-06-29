"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, Trophy, Target, Users,
  Filter, Eye, Clock, X
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import type { PromotorRankingEntry } from "@/lib/engines/challenge-engine";

interface DashboardData {
  total_eligible: number;
  above_target: number;
  ranking: PromotorRankingEntry[];
  lastUpdated: string;
  currentUserCode?: string;
}

type ViewRole = "PROMOTOR" | "SUPERVISOR" | "ADMIN";

export default function DesafioPerformancePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserCode, setCurrentUserCode] = useState("0100");
  
  const [filterRegion, setFilterRegion] = useState("Geral");
  const [filterSupervisor, setFilterSupervisor] = useState("Todos");
  const [filterUF, setFilterUF] = useState("Todos");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [currentRole, setCurrentRole] = useState<ViewRole>("PROMOTOR");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filterRegion !== "Geral") params.set("region", filterRegion);
        if (filterSupervisor !== "Todos") params.set("supervisor", filterSupervisor);
        if (filterUF !== "Todos") params.set("uf", filterUF);
        
        const res = await fetch(`/api/promotor/desafio?${params.toString()}`, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          setData(json);
          if (json.currentUserCode) {
            setCurrentUserCode(json.currentUserCode);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filterRegion, filterSupervisor, filterUF]);

  const cycleRole = () => {
    if (currentRole === "PROMOTOR") setCurrentRole("SUPERVISOR");
    else if (currentRole === "SUPERVISOR") setCurrentRole("ADMIN");
    else setCurrentRole("PROMOTOR");
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  };

  const renderPercentage = (val: number | null) => {
    if (val === null) return <span className="text-neutral-500 font-bold tracking-widest">--</span>;
    return <span>{val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>;
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return `Hoje ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const getStatusIcon = (label: string) => {
    if (label === "META BATIDA") return "🟢";
    if (label === "QUASE LÁ") return "🟡";
    if (label === "ATENÇÃO") return "🟠";
    if (label === "PRECISA MELHORAR") return "🔴";
    return "⚪";
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col font-sans transition-colors duration-300 pb-16">
      
      {/* Header */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-50 px-3 py-3 md:px-6 md:py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link 
              href="/"
              className="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-xl border border-border bg-card/40 hover:bg-neutral-500/10 transition-all text-neutral-400 hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 md:w-5 md:h-5 text-gold" />
                <h1 className="text-lg md:text-xl font-black tracking-tight text-foreground">
                  Desafio Promotor
                </h1>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <button 
              onClick={cycleRole}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all bg-neutral-800 text-white border-neutral-700"
            >
              <Eye className="w-3.5 h-3.5" />
              Visão: {currentRole}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 py-4 md:px-6 md:py-6 w-full flex-grow relative z-10">
        
        {/* Simple Visual Legend */}
        <div className="mb-5 flex flex-wrap justify-center items-center gap-3 md:gap-5 bg-neutral-900/40 border border-border/50 py-2 px-3 rounded-xl backdrop-blur-sm">
          <div className="flex items-center gap-1.5"><span className="text-[14px]">🟢</span><span className="text-[10px] md:text-[14px] font-black uppercase">Meta Batida</span></div>
          <div className="flex items-center gap-1.5"><span className="text-[14px]">🟡</span><span className="text-[10px] md:text-[14px] font-black uppercase">Quase Lá</span></div>
          <div className="flex items-center gap-1.5"><span className="text-[14px]">🟠</span><span className="text-[10px] md:text-[14px] font-black uppercase">Atenção</span></div>
          <div className="flex items-center gap-1.5"><span className="text-[14px]">🔴</span><span className="text-[10px] md:text-[14px] font-black uppercase">Precisa Melhorar</span></div>
        </div>

        {/* Top KPIs & Filters for Supervisor/Admin */}
        {currentRole !== "PROMOTOR" && (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-5">
            <div className="flex gap-3">
              <div className="px-3 py-2 rounded-xl border border-border bg-card/30 flex items-center gap-2">
                <Users className="w-4 h-4 text-neutral-500" />
                <span className="text-[10px] text-muted uppercase font-bold">Elegíveis:</span>
                <span className="font-black text-sm">{data?.total_eligible || 0}</span>
              </div>
              <div className="px-3 py-2 rounded-xl border border-border bg-card/30 flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] text-muted uppercase font-bold">Batendo:</span>
                <span className="font-black text-sm">{data?.above_target || 0}</span>
              </div>
            </div>

            {/* Mobile Filter Button */}
            <button 
              className="md:hidden w-full flex items-center justify-center gap-2 bg-neutral-900 border border-border rounded-xl py-2.5 text-xs font-bold uppercase"
              onClick={() => setIsFilterOpen(true)}
            >
              <Filter className="w-3.5 h-3.5" /> Filtros
            </button>

            {/* Desktop Filters Inline */}
            <div className="hidden md:flex flex-wrap items-center gap-2 bg-card/30 p-1.5 rounded-xl border border-border/50">
              <div className="px-2 text-muted"><Filter className="w-3.5 h-3.5" /></div>
              <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} className="bg-neutral-900 border border-border rounded-lg text-[11px] px-2 py-1 outline-none">
                <option value="Geral">Região: Brasil</option><option value="Sudeste">Sudeste</option><option value="Sul">Sul</option><option value="Nordeste">Nordeste</option>
              </select>
              <select value={filterSupervisor} onChange={(e) => setFilterSupervisor(e.target.value)} className="bg-neutral-900 border border-border rounded-lg text-[11px] px-2 py-1 outline-none">
                <option value="Todos">Sup: Todos</option><option value="Marcos Souza">Marcos Souza</option><option value="Fernanda Costa">Fernanda Costa</option>
              </select>
              <select value={filterUF} onChange={(e) => setFilterUF(e.target.value)} className="bg-neutral-900 border border-border rounded-lg text-[11px] px-2 py-1 outline-none">
                <option value="Todos">UF: Todas</option><option value="SP">SP</option><option value="MG">MG</option><option value="RJ">RJ</option><option value="PR">PR</option><option value="RS">RS</option><option value="BA">BA</option>
              </select>
            </div>
          </div>
        )}

        {/* Mobile Filters Modal */}
        {isFilterOpen && currentRole !== "PROMOTOR" && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end md:hidden">
            <div className="bg-neutral-950 w-full rounded-t-3xl border-t border-border p-5 pb-8 animate-in slide-in-from-bottom-full duration-200">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-black text-lg">Filtros</h3>
                <button onClick={() => setIsFilterOpen(false)} className="p-2 bg-neutral-900 rounded-full"><X className="w-5 h-5"/></button>
              </div>
              <div className="space-y-3">
                <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} className="w-full bg-neutral-900 border border-border rounded-xl text-[16px] px-4 py-3 outline-none">
                  <option value="Geral">Região: Brasil</option><option value="Sudeste">Região: Sudeste</option><option value="Sul">Região: Sul</option><option value="Nordeste">Região: Nordeste</option>
                </select>
                <select value={filterSupervisor} onChange={(e) => setFilterSupervisor(e.target.value)} className="w-full bg-neutral-900 border border-border rounded-xl text-[16px] px-4 py-3 outline-none">
                  <option value="Todos">Supervisor: Todos</option><option value="Marcos Souza">Marcos Souza</option><option value="Fernanda Costa">Fernanda Costa</option>
                </select>
                <select value={filterUF} onChange={(e) => setFilterUF(e.target.value)} className="w-full bg-neutral-900 border border-border rounded-xl text-[16px] px-4 py-3 outline-none">
                  <option value="Todos">UF: Todas</option><option value="SP">SP</option><option value="MG">MG</option><option value="RJ">RJ</option><option value="PR">PR</option><option value="RS">RS</option><option value="BA">BA</option>
                </select>
                <button onClick={() => setIsFilterOpen(false)} className="w-full bg-gold text-neutral-950 font-black py-4 rounded-xl mt-3 text-[16px]">Aplicar Filtros</button>
              </div>
            </div>
          </div>
        )}

        {/* Last Updated Timestamp */}
        <div className="flex items-center gap-1.5 text-[12px] text-muted font-bold mb-3 uppercase pl-1">
          <Clock className="w-4 h-4" />
          <span>Última atualização: {data ? formatTime(data.lastUpdated) : '...'}</span>
        </div>

        {/* Loading State Skeleton */}
        {loading && (
          <div className="space-y-3 mt-4">
            <div className="w-full h-16 bg-neutral-900/50 rounded-lg animate-pulse"></div>
            <div className="w-full h-16 bg-neutral-900/40 rounded-lg animate-pulse"></div>
            <div className="w-full h-16 bg-neutral-900/30 rounded-lg animate-pulse"></div>
          </div>
        )}

        {/* Data Presentation */}
        {!loading && data && data.ranking.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-card/10 rounded-2xl border border-border mt-6">
            <div className="w-16 h-16 bg-neutral-900/50 rounded-full flex items-center justify-center mb-4 border border-border">
              <Users className="w-8 h-8 text-neutral-500" />
            </div>
            <h3 className="text-xl font-black text-foreground mb-2">Sem Promotores Ativos</h3>
            <p className="text-muted text-sm max-w-md mb-6">
              Para visualizar o ranking de desafios, cadastre funcionários e atribua o perfil de "Promotor" a eles.
            </p>
            {(currentRole === "ADMIN" || currentRole === "SUPERVISOR") && (
              <Link href="/gente-gestao/cadastro" className="px-5 py-2.5 bg-gold text-black hover:bg-gold/90 transition-colors rounded-lg font-black uppercase text-[12px] tracking-wide">
                Cadastrar no Gente & Gestão
              </Link>
            )}
          </div>
        )}

        {!loading && data && data.ranking.length > 0 && (
          <>
            {/* Desktop Table View - Layout Extremamente Simples */}
            <div className="hidden md:block rounded-xl border border-border bg-card/20 shadow-sm mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse text-[14px] min-w-max">
                <thead>
                  <tr className="bg-neutral-950 border-b border-border text-[14px] md:text-[15px] uppercase tracking-wide text-white font-bold">
                    <th className="px-4 py-4 w-20 text-white/90">Código</th>
                    <th className="px-3 py-4">Nome do Promotor</th>
                    <th className="px-3 py-4 w-12 text-white/90">UF</th>
                    
                    {/* Financial Columns - Desafio e Real */}
                    <th className="px-3 py-4 text-right bg-neutral-900/80 text-white/90 w-28">Desafio</th>
                    <th className="px-3 py-4 text-right bg-neutral-900/80 text-white/90 w-28">Real</th>

                    <th className="px-3 py-4 text-white/90">Julho (%)</th>
                    <th className="px-4 py-4 whitespace-nowrap min-w-[200px]">Status</th>
                    
                    {/* Bonus Columns - Only for Admin */}
                    {currentRole === "ADMIN" && (
                      <th className="px-3 py-4 text-right bg-gold/10 text-gold w-28 font-black">Bônus</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {(() => {
                    const isCurrentUserInRanking = data.ranking.some(r => r.employee_code === currentUserCode);
                    return data.ranking.map((row, idx) => {
                      const isSelf = isCurrentUserInRanking ? row.employee_code === currentUserCode : idx === 0;
                      return (
                        <tr 
                          key={row.promotor_id} 
                          className={`transition-colors duration-150 hover:bg-neutral-500/10 ${
                            isSelf ? "bg-gold/5" : ""
                          }`}
                        >
                          <td className="px-4 py-3 font-mono text-muted text-[13px]">
                            {row.employee_code}
                          </td>
                          <td className="px-3 py-3 font-black text-foreground whitespace-nowrap">
                            {row.name}
                            {isSelf && <span className="ml-2 bg-gold text-neutral-950 px-1.5 py-0.5 rounded-[3px] text-[10px] font-black uppercase">Você</span>}
                          </td>
                          <td className="px-3 py-3 text-muted font-bold text-[13px]">
                            {row.uf}
                          </td>

                          {/* Financial Columns - Desafio & Real */}
                          <td className="px-3 py-3 text-right font-mono text-muted text-[13px]">
                            {currentRole === "PROMOTOR" && !isSelf ? (
                              <span className="text-neutral-550">🔒 R$ --</span>
                            ) : (
                              formatCurrency(row.jul.meta)
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-foreground text-[13px]">
                            {currentRole === "PROMOTOR" && !isSelf ? (
                              <span className="text-neutral-550">🔒 R$ --</span>
                            ) : (
                              formatCurrency(row.jul.realizado)
                            )}
                          </td>
                          
                          {/* Only July shown */}
                          <td className="px-3 py-3 font-black text-[16px] text-foreground">
                            {renderPercentage(row.jul.achievement)}
                          </td>
     
                          {/* Status */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-[13px] font-black uppercase tracking-wide flex items-center gap-2">
                               <span className="text-[16px]">{getStatusIcon(row.status.label)}</span> {row.status.label}
                            </span>
                          </td>
                          
                          {/* Bonus Columns - Admin ONLY */}
                          {currentRole === "ADMIN" && (
                            <td className="px-3 py-3 text-right bg-gold/5">
                              <div className="font-black text-gold text-[13px]">{formatCurrency(row.estimated_bonus_value)}</div>
                            </td>
                          )}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
 
            {/* Mobile Cards View - Ultra Simplificado */}
            <div className="flex flex-col gap-2 mt-4 md:hidden">
              {(() => {
                const isCurrentUserInRanking = data.ranking.some(r => r.employee_code === currentUserCode);
                return data.ranking.map((row, idx) => {
                  const isSelf = isCurrentUserInRanking ? row.employee_code === currentUserCode : idx === 0;
                  return (
                    <div 
                      key={row.promotor_id}
                      className={`px-4 py-3 rounded-xl border flex flex-col gap-1.5 ${
                        isSelf 
                          ? "border-gold/40 bg-gold/10 shadow-[0_0_10px_rgba(245,158,11,0.08)]" 
                          : "border-border bg-card/20 shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[14px]">
                        <div className="flex gap-2 items-center">
                          <span className="font-mono text-muted/80">{row.employee_code}</span>
                          <span className="text-muted/40">|</span>
                          <span className="font-black text-foreground truncate">{row.name}</span>
                          {isSelf && <span className="ml-1 bg-gold text-neutral-950 px-1 py-0.2 rounded-[2px] text-[8px] font-black uppercase shrink-0">Você</span>}
                        </div>
                        <span className="font-bold text-muted">{row.uf}</span>
                      </div>
                      
                      {/* Linha 2: Mês | Status */}
                      <div className="flex items-center justify-between mt-1 px-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[14px] font-bold text-muted tracking-wide">Julho:</span>
                          <span className="text-[16px] font-black text-foreground">
                            {renderPercentage(row.jul.achievement)}
                          </span>
                        </div>
                        
                        <span className="text-[13px] font-black uppercase flex items-center gap-1.5">
                           <span className="text-[15px]">{getStatusIcon(row.status.label)}</span> {row.status.label}
                        </span>
                      </div>
     
                      {/* Financials super compactos */}
                      <div className="flex gap-3 text-[11px] font-mono font-bold justify-end mt-1 pt-2 border-t border-border/40">
                          <div className="text-right">
                            <span className="text-muted text-[9px] uppercase mr-1">Desafio</span>
                            {currentRole === "PROMOTOR" && !isSelf ? (
                              <span className="text-neutral-550">🔒 R$ --</span>
                            ) : (
                              formatCurrency(row.jul.meta)
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-muted text-[9px] uppercase mr-1">Real</span>
                            {currentRole === "PROMOTOR" && !isSelf ? (
                              <span className="text-neutral-550">🔒 R$ --</span>
                            ) : (
                              formatCurrency(row.jul.realizado)
                            )}
                          </div>
                          {currentRole === "ADMIN" && (
                            <div className="text-right text-gold border-l border-gold/20 pl-2">
                              <span className="text-gold/70 text-[9px] uppercase mr-1">Prêmio (Est)</span>
                              {formatCurrency(row.estimated_bonus_value)}
                            </div>
                          )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
