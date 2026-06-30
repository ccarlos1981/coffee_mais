"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, Search, Save, Filter, Clock, 
  CheckCircle2, AlertCircle, ChevronDown, 
  RefreshCw, DollarSign, FileText, Lock
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { formatCurrency } from "@/lib/formatters";

interface RemuneracaoRecord {
  id: string;
  remuneracao_id: string | null;
  employee_code: string;
  name: string;
  uf: string;
  variavel_base: number;
  fator_proporcional: number;
  atingimento_mensal: number | null;
  status_performance: { label: string; colorClass: string };
  valor_calculado: number;
  recuperacao_trimestral: number;
  valor_pago_mensal: number;
  override_reason: string;
  status_pagamento: string;
  payment_year: number;
  payment_month: number;
  quarter_locked: boolean;
}

export default function RemuneracaoPromotorPage() {
  const [records, setRecords] = useState<RemuneracaoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(7);
  const [year, setYear] = useState(2026);
  const [searchTerm, setSearchTerm] = useState("");
  const [globalStatus, setGlobalStatus] = useState<string>("DRAFT");

  const fetchRecords = async (m: number, y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/remuneracao-promotor?month=${m}&year=${y}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setRecords(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords(month, year);
  }, [month, year]);

  const handleSave = async (statusOverride?: string, lockQuarter = false) => {
    setSaving(true);
    try {
      const quarter = Math.ceil(month / 3);
      const res = await fetch("/api/remuneracao-promotor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records,
          competency_year: year,
          competency_month: month,
          quarter,
          new_status: statusOverride,
          lock_quarter: lockQuarter
        })
      });
      const json = await res.json();
      if (json.success) {
        alert("Remuneração salva com sucesso!");
        if (statusOverride) setGlobalStatus(statusOverride);
        fetchRecords(month, year);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const updateRecord = (id: string, field: keyof RemuneracaoRecord, value: any) => {
    setRecords(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, [field]: value };
        if (field === "variavel_base" || field === "atingimento_mensal") {
          const targetQty = updated.variavel_base;
          const ach = updated.atingimento_mensal || 0;
          const realQty = Math.round(targetQty * (ach / 100) * updated.fator_proporcional);
          
          let basePayment = 0;
          if (ach >= 100) {
            basePayment = realQty * 0.06;
          }
          updated.valor_calculado = basePayment + updated.recuperacao_trimestral;
          updated.valor_pago_mensal = updated.valor_calculado;
        }
        return updated;
      }
      return r;
    }));
  };

  const filtered = records.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.employee_code.includes(searchTerm)
  );

  const formatMonth = (m: number) => {
    const d = new Date();
    d.setMonth(m - 1);
    return d.toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
  };

  const totalCalculado = records.reduce((acc, r) => acc + (r.valor_calculado || 0), 0);
  const totalPago = records.reduce((acc, r) => acc + (r.valor_pago_mensal || 0), 0);
  const isQuarterEnd = month % 3 === 0;
  const isLocked = records.some(r => r.quarter_locked);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-20 transition-colors duration-300">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-muted hover:text-foreground transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div className="h-6 w-[1px] bg-border hidden md:block"></div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-amber-500">
              Remuneração Promotores
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          
          <div className="flex items-center gap-3 bg-card border border-border rounded-lg p-1">
            {[7, 8, 9].map(m => (
              <button
                key={m}
                onClick={() => setMonth(m)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  month === m 
                  ? "bg-neutral-800 dark:bg-zinc-800 text-amber-400 shadow-sm" 
                  : "text-muted hover:text-foreground"
                }`}
              >
                {formatMonth(m)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="text"
                placeholder="Buscar promotor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-amber-500/50"
              />
            </div>
            
            <button 
              onClick={() => handleSave()}
              disabled={saving || loading || isLocked}
              className="flex items-center gap-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 px-4 py-2 rounded-lg font-medium transition-colors text-sm disabled:opacity-50"
            >
              {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
              Salvar Rascunho
            </button>

            <button 
              onClick={() => handleSave("APROVADO_RH")}
              disabled={saving || loading || isLocked}
              className="flex items-center gap-2 bg-amber-500 text-black hover:bg-amber-400 px-4 py-2 rounded-lg font-bold transition-colors text-sm shadow-[0_0_15px_rgba(245,158,11,0.2)] disabled:opacity-50"
            >
              Aprovar Fechamento
            </button>

            {isQuarterEnd && (
               <button 
               onClick={() => {
                 if (confirm("ATENÇÃO: Isso travará todo o trimestre e não poderá ser alterado! Confirma?")) {
                   handleSave("PAGO", true);
                 }
               }}
               disabled={saving || loading || isLocked}
               className="flex items-center gap-2 bg-red-600 text-white hover:bg-red-500 px-4 py-2 rounded-lg font-bold transition-colors text-sm shadow-[0_0_15px_rgba(220,38,38,0.2)] disabled:opacity-50"
             >
               <Lock size={16} />
               {isLocked ? "Trimestre Travado" : "Travar Trimestre"}
             </button>
            )}
          </div>
        </div>

        {/* REGRAS DE REMUNERAÇÃO CARD */}
        <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-5 mb-8">
          <h3 className="text-sm font-black text-amber-850 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <FileText size={16} /> Regras de Remuneração Variável (Q3 2026)
          </h3>
          <ul className="text-xs space-y-2 text-zinc-800 dark:text-zinc-200 font-medium">
            <li className="leading-relaxed">
              🎯 <strong>Indicador Principal (KPI):</strong> Quantidade de produto (Volume em caixas), em substituição ao Faturamento.
            </li>
            <li className="leading-relaxed">
              💰 <strong>Apuração Mensal:</strong> Atingindo <strong className="text-amber-900 dark:text-amber-400 font-black">100% ou mais</strong> da meta do mês, o promotor ganha <strong className="text-amber-900 dark:text-amber-400 font-black">R$ 0,06 por caixa vendida</strong>. Caso o atingimento seja inferior a 100%, a remuneração variável do mês é R$ 0,00.
            </li>
            <li className="leading-relaxed">
              🏆 <strong>Super Bônus Trimestral:</strong> Se o promotor atingir a meta em todos os 3 meses do ciclo (Julho, Agosto e Setembro), receberá um prêmio extra de <strong className="text-amber-900 dark:text-amber-400 font-black">R$ 500,00</strong> no fechamento trimestral (consolidado na folha de Setembro).
            </li>
          </ul>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card/50 border border-border rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Folha Projetada (Calculada)</p>
              <h3 className="text-2xl font-bold mt-1">{formatCurrency(totalCalculado)}</h3>
            </div>
          </div>
          <div className="bg-card/50 border border-border rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Total a Pagar (Revisado)</p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-400">{formatCurrency(totalPago)}</h3>
            </div>
          </div>
          <div className="bg-card/50 border border-border rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Competência / Pagamento</p>
              <h3 className="text-xl font-bold mt-1">
                {formatMonth(month).substring(0,3)} → {formatMonth(month === 12 ? 1 : month + 1).substring(0,3)}
              </h3>
            </div>
          </div>
        </div>

        {isLocked && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-3">
            <Lock size={20} />
            <p className="text-sm font-medium">Este trimestre já foi fechado e os valores estão bloqueados para auditoria.</p>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-neutral-900/20 dark:bg-black/60 border-b border-border text-muted">
                  <th className="px-4 py-4 font-semibold w-16">CÓD.</th>
                  <th className="px-4 py-4 font-semibold">NOME DO PROMOTOR</th>
                  <th className="px-4 py-4 font-semibold w-28 text-right">META (QTD)</th>
                  <th className="px-4 py-4 font-semibold w-28 text-right">REAL (QTD)</th>
                  <th className="px-4 py-4 font-semibold text-amber-400 w-24 text-center">ATING. MÊS</th>
                  {isQuarterEnd && (
                    <th className="px-4 py-4 font-semibold text-emerald-400 w-32 text-right">+ BÔNUS TRI</th>
                  )}
                  <th className="px-4 py-4 font-semibold text-right w-32">CALCULADO</th>
                  <th className="px-4 py-4 font-semibold text-right w-48">VALOR FINAL (RH)</th>
                  <th className="px-4 py-4 font-semibold w-32">STATUS PGT.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={isQuarterEnd ? 9 : 8} className="px-4 py-8 text-center text-zinc-500">
                      <RefreshCw className="animate-spin mx-auto mb-2" size={20} />
                      Carregando folha de pagamento...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={isQuarterEnd ? 9 : 8} className="px-4 py-8 text-center text-zinc-500">
                      <div className="max-w-md mx-auto py-8">
                        <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-zinc-300 mb-2">Sem Promotores Cadastrados</h3>
                        <p className="text-sm text-zinc-500 mb-6 whitespace-normal">
                          A folha não encontrou nenhum funcionário ativo com o perfil de "Promotor".
                        </p>
                        <Link href="/gente-gestao/cadastro" className="bg-amber-500 text-black px-6 py-2 rounded-lg font-bold text-sm hover:bg-amber-400 transition-colors">
                          Cadastrar Promotores
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((record) => {
                    const isOverriden = Math.abs(record.valor_pago_mensal - record.valor_calculado) > 1.0;
                    return (
                      <tr key={record.id} className="hover:bg-neutral-500/10 transition-colors group border-b border-border/50">
                        <td className="px-4 py-3 text-muted font-mono text-xs">{record.employee_code}</td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {record.name}
                          {record.fator_proporcional < 1 && (
                            <span className="ml-2 text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                              PROPORCIONAL
                            </span>
                          )}
                        </td>
                        
                        <td className="px-4 py-3">
                          <div className="relative">
                            <input 
                              type="number"
                              disabled={isLocked}
                              value={record.variavel_base}
                              onChange={(e) => updateRecord(record.id, "variavel_base", parseFloat(e.target.value) || 0)}
                              className="w-full bg-background border border-border rounded-md py-1.5 px-2 text-right text-sm focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <span className="text-[10px] text-muted block text-right mt-1">cx</span>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right font-mono text-foreground font-bold">
                          {Math.round(record.variavel_base * ((record.atingimento_mensal || 0) / 100) * record.fator_proporcional).toLocaleString("pt-BR")} cx
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-bold text-amber-400">{record.atingimento_mensal !== null ? record.atingimento_mensal.toFixed(1) + '%' : '-'}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${record.status_performance.colorClass} border`}>
                              {record.status_performance.label.split(' ')[0]}
                            </span>
                          </div>
                        </td>

                        {isQuarterEnd && (
                          <td className="px-4 py-3 text-right font-mono text-emerald-500 font-bold bg-emerald-500/5">
                            {record.recuperacao_trimestral > 0 ? `+ ${formatCurrency(record.recuperacao_trimestral)}` : '-'}
                          </td>
                        )}

                        <td className="px-4 py-3 text-right font-mono text-muted">
                          {formatCurrency(record.valor_calculado)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="relative flex flex-col gap-1">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs">R$</span>
                              <input 
                                type="number"
                                disabled={isLocked}
                                value={record.valor_pago_mensal}
                                onChange={(e) => updateRecord(record.id, "valor_pago_mensal", parseFloat(e.target.value) || 0)}
                                className={`w-full bg-background border rounded-md py-1.5 pl-8 pr-2 text-right text-sm focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isOverriden ? 'border-amber-500 text-amber-500' : 'border-emerald-500/30 text-emerald-500 font-bold focus:border-emerald-500'}`}
                              />
                            </div>
                            
                            {/* Visual Badges for Audit */}
                            <div className="flex flex-wrap gap-1 mt-1 justify-end">
                              {isOverriden ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                  Ajustado Manualmente
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                  Calculado Auto
                                </span>
                              )}
                              
                              {record.recuperacao_trimestral > 0 && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  + Bônus Trimestral
                                </span>
                              )}
                            </div>

                            {isOverriden && (
                              <input 
                                type="text"
                                disabled={isLocked}
                                placeholder="Motivo do ajuste..."
                                value={record.override_reason || ""}
                                onChange={(e) => updateRecord(record.id, "override_reason", e.target.value)}
                                className="w-full bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[10px] rounded px-2 py-1 placeholder-amber-700 focus:outline-none focus:border-amber-500 disabled:opacity-50 mt-1"
                              />
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top pt-4">
                          <select
                            disabled={isLocked}
                            value={record.status_pagamento}
                            onChange={(e) => updateRecord(record.id, "status_pagamento", e.target.value)}
                            className={`w-full bg-background border rounded-md py-1.5 px-2 text-xs font-semibold focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                              record.status_pagamento === 'APROVADO_RH' ? 'border-amber-500/50 text-amber-500' :
                              record.status_pagamento === 'ENVIADO_FOLHA' ? 'border-blue-500/50 text-blue-500' :
                              record.status_pagamento === 'PAGO' ? 'border-emerald-500/50 text-emerald-500' :
                              'border-border text-muted'
                            }`}
                          >
                            <option value="DRAFT">DRAFT</option>
                            <option value="FECHADO">FECHADO</option>
                            <option value="APROVADO_RH">APROVADO RH</option>
                            <option value="ENVIADO_FOLHA">ENVIADO FOLHA</option>
                            <option value="PAGO">PAGO</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
