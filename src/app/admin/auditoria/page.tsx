"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  ShieldAlert, 
  Search, 
  ArrowLeft, 
  TrendingUp, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  MessageSquare,
  History,
  Send,
  Download
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatPercent } from "@/lib/formatters";

interface MatrixOption {
  codigo_matriz: string;
  nome_rede: string;
}

interface Alert {
  type: "Informativo" | "Atenção" | "Crítico" | "Bloqueante";
  source: "FINANCIAL" | "TEMPORAL" | "GOVERNANCE" | "DATA_QUALITY";
  title: string;
  description: string;
  code: string;
  timestamp: string;
}

interface FinancialRecord {
  nro_nota: string;
  dt_faturamento: string;
  cod_top: string;
  desc_top: string;
  valor_liquido: number;
  quantidade: number;
  cod_produto: string;
  desc_produto: string;
}

interface ActionAuditDetail {
  acaoId: string;
  plannedValue: number;
  plannedStart: string;
  plannedEnd: string;
  praticadoValue: number;
  deviationPercent: number;
  auditStatus: "CONFORME" | "DIVERGENTE";
  alerts: Alert[];
  financialMovement: {
    salesValue: number;
    bonificationValue: number;
    devolutionValue: number;
    praticadoValue: number;
    records: FinancialRecord[];
  };
}

interface ConciliationResult {
  executionId: string;
  matrixCode: string;
  periodStart: string;
  periodEnd: string;
  processedAt: string;
  executedBy: string;
  summary: {
    actionsAudited: number;
    actionsConforme: number;
    actionsDivergente: number;
    complianceRate: number;
    totalValuePlanned: number;
    totalValuePraticado: number;
    deviationPercent: number;
    alertsCount: number;
  };
  details: {
    financialMovement: {
      clientCode: string;
      periodStart: string;
      periodEnd: string;
      records: FinancialRecord[];
      salesValue: number;
      bonificationValue: number;
      devolutionValue: number;
      praticadoValue: number;
    };
    actions: ActionAuditDetail[];
  };
}

interface JustificationLog {
  id: string;
  justificativa: string;
  executed_at: string;
  executed_by: string;
  executionId: string;
  cm_user_profiles?: {
    name: string;
    email: string;
  };
}

export default function ConciliationDashboard() {
  const supabase = createClient();

  // Matrices list
  const [matrices, setMatrices] = useState<MatrixOption[]>([]);
  const [selectedMatrix, setSelectedMatrix] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [plannedAcaoId, setPlannedAcaoId] = useState("");

  // Result state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConciliationResult | null>(null);
  const [selectedActionIndex, setSelectedActionIndex] = useState<number>(0);

  // Justification state
  const [justificationText, setJustificationText] = useState("");
  const [justificationLogs, setJustificationLogs] = useState<JustificationLog[]>([]);
  const [savingJustification, setSavingJustification] = useState(false);
  const [justificationMessage, setJustificationMessage] = useState<string | null>(null);

  // Load available matrices on mount
  useEffect(() => {
    async function fetchMatrices() {
      const { data, error } = await supabase
        .from("cm_redes_matrizes")
        .select("codigo_matriz, nome_rede")
        .order("nome_rede", { ascending: true });
      
      if (!error && data) {
        setMatrices(data);
      }
    }
    fetchMatrices();

    // Default dates (current month)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    setPeriodStart(firstDay);
    setPeriodEnd(lastDay);
  }, []);

  // Fetch justification history when selected action changes
  useEffect(() => {
    const acaoId = result?.details?.actions?.[selectedActionIndex]?.acaoId;
    if (acaoId) {
      loadJustifications(acaoId);
    } else {
      setJustificationLogs([]);
    }
  }, [result, selectedActionIndex]);

  async function loadJustifications(acaoId: string) {
    try {
      const response = await fetch(`/api/governance/master/conciliar/justificar?acaoId=${acaoId}`);
      const resData = await response.json();
      if (resData.success) {
        setJustificationLogs(resData.data || []);
      }
    } catch (err) {
      console.error("Erro ao carregar logs de justificativas", err);
    }
  }

  async function handleConciliation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMatrix) {
      setError("Por favor, selecione uma rede comercial.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedActionIndex(0);

    try {
      const response = await fetch("/api/governance/master/conciliar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matrixCode: selectedMatrix,
          periodStart,
          periodEnd,
          plannedAcaoId: plannedAcaoId || undefined
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Erro ao processar conciliação.");
      }

      setResult(data.data);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido ao chamar motor de conciliação.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveJustification(e: React.FormEvent) {
    e.preventDefault();
    const acaoId = result?.details?.actions?.[selectedActionIndex]?.acaoId;
    const executionId = result?.executionId;
    if (!acaoId || !justificationText.trim()) return;

    setSavingJustification(true);
    setJustificationMessage(null);

    try {
      const response = await fetch("/api/governance/master/conciliar/justificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acaoId,
          justificativa: justificationText,
          executionId
        })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.message || "Erro ao salvar justificativa.");
      }

      setJustificationText("");
      setJustificationMessage("Justificativa registrada com sucesso!");
      loadJustifications(acaoId);
    } catch (err: any) {
      setJustificationMessage(`Erro: ${err.message}`);
    } finally {
      setSavingJustification(false);
    }
  }

  // Export report to Excel XLSX using project endpoint /api/export
  function handleExportReport() {
    if (!result) return;

    const dataToExport = result.details.actions.map(action => ({
      "Ação ID": action.acaoId,
      "Início Planejado": action.plannedStart,
      "Fim Planejado": action.plannedEnd,
      "Valor Planejado (R$)": action.plannedValue,
      "Valor Praticado (R$)": action.praticadoValue,
      "Desvio (%)": action.deviationPercent,
      "Status Auditoria": action.auditStatus,
      "Total Alertas": action.alerts.length,
      "Alertas": action.alerts.map(a => `[${a.type}] ${a.title}`).join(" | ")
    }));

    // Create a dynamic form to submit post parameters to /api/export
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/export";
    form.target = "_blank";

    const dataInput = document.createElement("input");
    dataInput.type = "hidden";
    dataInput.name = "data";
    dataInput.value = JSON.stringify(dataToExport);
    form.appendChild(dataInput);

    const filenameInput = document.createElement("input");
    filenameInput.type = "hidden";
    filenameInput.name = "filename";
    filenameInput.value = `relatorio_auditoria_${result.matrixCode}_${result.periodStart}.xlsx`;
    form.appendChild(filenameInput);

    const sheetInput = document.createElement("input");
    sheetInput.type = "hidden";
    sheetInput.name = "sheetName";
    sheetInput.value = "Auditoria";
    form.appendChild(sheetInput);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  // Summary Metrics
  const complianceRate = result?.summary?.complianceRate ?? 0;
  const actionsAudited = result?.summary?.actionsAudited ?? 0;
  const actionsConforme = result?.summary?.actionsConforme ?? 0;
  const actionsDivergente = result?.summary?.actionsDivergente ?? 0;
  const totalValuePlanned = result?.summary?.totalValuePlanned ?? 0;
  const totalValuePraticado = result?.summary?.totalValuePraticado ?? 0;
  const deviation = result?.summary?.deviationPercent ?? 0;

  const currentAction = result?.details?.actions?.[selectedActionIndex];
  const hasCriticalOrBlocker = currentAction?.alerts?.some(
    a => a.type === "Crítico" || a.type === "Bloqueante" || a.type === "Atenção"
  );

  return (
    <div className="min-h-screen bg-[#0d0f12] text-[#f3f4f6]">
      {/* Header bar */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#0d0f12]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/cadastro-mestre" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <div className="h-4 w-[1px] bg-white/10" />
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-indigo-500" />
              Painel de Conciliação e Auditoria Comercial
            </h1>
          </div>
          <div className="text-xs text-gray-400">Fase 6 — Inteligência de Alocação</div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-4">
          
          {/* Column 1: Controls Panel (Glass Card) */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Parâmetros de Auditoria</h2>
              <form onSubmit={handleConciliation} className="space-y-4">
                
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Rede Comercial</label>
                  <select 
                    value={selectedMatrix} 
                    onChange={e => setSelectedMatrix(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#16191f] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Selecione uma rede...</option>
                    {matrices.map(m => (
                      <option key={m.codigo_matriz} value={m.codigo_matriz}>
                        {m.nome_rede} ({m.codigo_matriz})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Início</label>
                    <input 
                      type="date"
                      value={periodStart}
                      onChange={e => setPeriodStart(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-[#16191f] px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Fim</label>
                    <input 
                      type="date"
                      value={periodEnd}
                      onChange={e => setPeriodEnd(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-[#16191f] px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">ID da Ação (Opcional)</label>
                  <input 
                    type="text"
                    placeholder="Auto-seleção caso vazio"
                    value={plannedAcaoId}
                    onChange={e => setPlannedAcaoId(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#16191f] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  <Search className="h-4 w-4" />
                  {loading ? "Processando..." : "Auditar Movimentação"}
                </button>

              </form>
            </div>
          </div>

          {/* Columns 2-4: Results View */}
          <div className="lg:col-span-3 space-y-8">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                {error}
              </div>
            )}

            {!result && !loading && (
              <div className="rounded-xl border border-dashed border-white/10 p-16 text-center text-gray-500">
                <ShieldAlert className="mx-auto h-12 w-12 text-gray-600 mb-4 animate-pulse" />
                <p className="text-sm">Selecione os parâmetros e clique em "Auditar Movimentação" para iniciar.</p>
              </div>
            )}

            {loading && (
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-24 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mb-4" />
                <p className="text-sm text-gray-400">Consolidando faturamento regional e mapeando conformidade de investimentos...</p>
              </div>
            )}

            {result && (
              <div className="space-y-8">
                
                {/* Executive KPIs Banner & Actions Summary */}
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Resumo de Conformidade Executiva</h2>
                  <button 
                    onClick={handleExportReport}
                    className="flex items-center gap-2 rounded bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition"
                  >
                    <Download className="h-3.5 w-3.5" /> Exportar Relatório (XLSX)
                  </button>
                </div>

                {/* 1. Executive Compliance Cards */}
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                    <div className="text-xs text-gray-400 mb-1">Ações Auditadas</div>
                    <div className="text-2xl font-bold text-white">{actionsAudited}</div>
                    <div className="text-[10px] text-gray-500 mt-1">Total no período</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                    <div className="text-xs text-gray-400 mb-1">Conformes</div>
                    <div className="text-2xl font-bold text-emerald-400">{actionsConforme}</div>
                    <div className="text-[10px] text-gray-500 mt-1">Zero desvios registrados</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                    <div className="text-xs text-gray-400 mb-1">Divergentes</div>
                    <div className="text-2xl font-bold text-red-400">{actionsDivergente}</div>
                    <div className="text-[10px] text-gray-500 mt-1">Exigem justificativas</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                    <div className="text-xs text-gray-400 mb-1">Taxa de Conformidade</div>
                    <div className={`text-2xl font-bold ${complianceRate >= 90 ? "text-emerald-400" : complianceRate >= 70 ? "text-yellow-400" : "text-red-400"}`}>
                      {complianceRate}%
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">Meta corporativa: 95%</div>
                  </div>
                </div>

                {/* 2. Selection list for actions */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Detalhamento por Ação Planejada</h3>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {result.details.actions.map((act, idx) => (
                      <button
                        key={act.acaoId}
                        onClick={() => setSelectedActionIndex(idx)}
                        className={`rounded-lg border px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 ${
                          selectedActionIndex === idx
                            ? "border-indigo-500 bg-indigo-500/10 text-white"
                            : "border-white/10 bg-white/[0.02] text-gray-400 hover:text-white"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${act.auditStatus === "CONFORME" ? "bg-emerald-400" : "bg-red-400"}`} />
                        Ação: {act.acaoId.slice(0, 8)} ({formatCurrency(act.plannedValue)})
                      </button>
                    ))}
                  </div>
                </div>

                {currentAction && (
                  <div className="space-y-8 animate-fadeIn">
                    
                    {/* Action-specific metrics */}
                    <div className="grid gap-4 sm:grid-cols-4 bg-white/[0.01] p-5 rounded-xl border border-white/5">
                      <div>
                        <div className="text-xs text-gray-500">Valor Planejado</div>
                        <div className="text-lg font-bold text-white">{formatCurrency(currentAction.plannedValue)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Valor Praticado (Segmento)</div>
                        <div className="text-lg font-bold text-white">{formatCurrency(currentAction.praticadoValue)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Desvio Financeiro (%)</div>
                        <div className={`text-lg font-bold ${
                          currentAction.deviationPercent > 5 ? "text-red-400" : currentAction.deviationPercent > 0 ? "text-yellow-400" : "text-emerald-400"
                        }`}>
                          {formatPercent(currentAction.deviationPercent)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Vigência Planejada</div>
                        <div className="text-sm font-semibold text-white mt-1">
                          {currentAction.plannedStart} a {actFormatDate(currentAction.plannedEnd)}
                        </div>
                      </div>
                    </div>

                    {/* Alertas & Cronograma */}
                    <div className="grid gap-6 md:grid-cols-3">
                      
                      {/* Alerts feed */}
                      <div className="md:col-span-2 space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Alertas para a Ação Selecionada ({currentAction.alerts.length})
                        </h3>
                        <div className="space-y-2">
                          {currentAction.alerts.length === 0 ? (
                            <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.01] p-4 text-xs text-emerald-400 flex items-center gap-2">
                              <CheckCircle className="h-4 w-4" />
                              <span>Ação em total conformidade cadastral e financeira!</span>
                            </div>
                          ) : (
                            currentAction.alerts.map((a, aIdx) => (
                              <div 
                                key={aIdx} 
                                className={`rounded-xl border p-4 flex gap-3 ${
                                  a.type === "Bloqueante" ? "border-red-500/20 bg-red-500/[0.02]" :
                                  a.type === "Crítico" ? "border-orange-500/20 bg-orange-500/[0.02]" :
                                  a.type === "Atenção" ? "border-yellow-500/20 bg-yellow-500/[0.02]" :
                                  "border-sky-500/20 bg-sky-500/[0.02]"
                                }`}
                              >
                                <div className="mt-0.5">
                                  {a.type === "Bloqueante" || a.type === "Crítico" ? (
                                    <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
                                  ) : (
                                    <AlertTriangle className="h-4.5 w-4.5 text-yellow-500" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="font-bold text-white">{a.title}</span>
                                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-gray-400 uppercase">
                                      {a.source}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-400 mt-1">{a.description}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Execution Details & Traceability */}
                      <div className="md:col-span-1">
                        <div className="rounded-xl border border-white/10 bg-white/[0.01] p-4 space-y-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Rastreabilidade</h4>
                          <div className="text-xs space-y-2 font-mono text-gray-400">
                            <div>Execution ID:</div>
                            <div className="bg-white/5 p-2 rounded text-[10px] break-all">{result.executionId}</div>
                            <div className="flex justify-between mt-2">
                              <span>Processado:</span>
                              <span className="text-white">{new Date(result.processedAt).toLocaleTimeString("pt-BR")}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Invoices segment table */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Notas Faturadas Dentro da Vigência Planejada ({currentAction.financialMovement.records.length})
                      </h4>
                      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.01]">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-white/10 bg-white/5 text-[10px] text-gray-400 uppercase">
                            <tr>
                              <th className="px-4 py-2.5">Nota</th>
                              <th className="px-4 py-2.5">Data</th>
                              <th className="px-4 py-2.5">TOP</th>
                              <th className="px-4 py-2.5">Produto</th>
                              <th className="px-4 py-2.5 text-right">Valor Líquido</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-gray-300">
                            {currentAction.financialMovement.records.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                                  Nenhuma nota fiscal ou devolução no período planejado desta ação.
                                </td>
                              </tr>
                            ) : (
                              currentAction.financialMovement.records.map((rec, rIdx) => (
                                <tr key={rIdx} className="hover:bg-white/[0.02]">
                                  <td className="px-4 py-2.5 font-mono">{rec.nro_nota}</td>
                                  <td className="px-4 py-2.5 text-gray-400">{rec.dt_faturamento}</td>
                                  <td className="px-4 py-2.5 font-mono">{rec.cod_top}</td>
                                  <td className="px-4 py-2.5 truncate max-w-[200px] text-gray-400">{rec.desc_produto}</td>
                                  <td className={`px-4 py-2.5 text-right font-mono ${rec.valor_liquido < 0 ? "text-red-400" : "text-white"}`}>
                                    {formatCurrency(rec.valor_liquido)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Justifications Row */}
                    {hasCriticalOrBlocker && (
                      <div className="grid gap-6 md:grid-cols-2">
                        
                        {/* Save justification form */}
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                            <MessageSquare className="h-3.5 w-3.5 text-indigo-500" />
                            Justificar Desvios da Ação Selecionada
                          </h4>
                          <form onSubmit={handleSaveJustification} className="space-y-3">
                            <textarea
                              placeholder="Forneça o parecer comercial para este desvio..."
                              rows={3}
                              value={justificationText}
                              onChange={e => setJustificationText(e.target.value)}
                              className="w-full rounded-lg border border-white/10 bg-[#16191f] p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <button
                              type="submit"
                              disabled={savingJustification || !justificationText.trim()}
                              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 focus:outline-none disabled:opacity-50 transition flex items-center gap-2"
                            >
                              <Send className="h-3 w-3" />
                              {savingJustification ? "Salvando..." : "Registrar Justificativa"}
                            </button>
                          </form>
                          {justificationMessage && (
                            <p className="text-[11px] text-indigo-400">{justificationMessage}</p>
                          )}
                        </div>

                        {/* Justifications log timeline (with executionId) */}
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                            <History className="h-3.5 w-3.5 text-sky-500" />
                            Trilha de Auditoria e Justificativas
                          </h4>
                          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                            {justificationLogs.length === 0 ? (
                              <p className="text-xs text-gray-500 text-center py-6">Nenhuma justificativa prévia registrada.</p>
                            ) : (
                              justificationLogs.map((log) => (
                                <div key={log.id} className="rounded bg-white/5 p-3 text-xs space-y-1.5 border-l-2 border-indigo-500">
                                  <p className="text-gray-300 font-medium">{log.justificativa}</p>
                                  <div className="flex justify-between text-[9px] text-gray-500">
                                    <span>Por: {log.cm_user_profiles?.name || log.executed_by}</span>
                                    <span>{new Date(log.executed_at).toLocaleString("pt-BR")}</span>
                                  </div>
                                  <div className="text-[8px] text-gray-600 font-mono">
                                    Audit Execution: {log.executionId}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                      </div>
                    )}

                  </div>
                )}

              </div>
            )}

          </div>

        </div>
      </main>
    </div>
  );
}

// Small date formatter helper
function actFormatDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}
