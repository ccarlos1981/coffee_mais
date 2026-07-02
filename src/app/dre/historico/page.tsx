"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Upload, DollarSign, BarChart3, TrendingUp, History, Lock, Unlock, ArrowLeft, Loader2, CheckCircle2, AlertCircle, RefreshCw, Undo2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { fecharMesDRE, reabrirMesDRE, desfazerImportacao } from "@/app/dre/historico/lancar/actions";
import { createClient } from "@/lib/supabase/client";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function DREHistoricoPage() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [logs, setLogs] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal de Fechamento
  const [closeModal, setCloseModal] = useState<{ open: boolean; mes: number; notes: string } | null>(null);
  // Modal de Reabertura
  const [reopenModal, setReopenModal] = useState<{ open: boolean; mes: number; reason: string } | null>(null);

  const supabase = createClient();

  const loadLogsAndClosures = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Carregar logs de importação
      const { data: logsData } = await supabase
        .from("cm_dre_import_logs")
        .select("*")
        .order("started_at", { ascending: false });

      // 2. Carregar fechamentos do ano
      const { data: closureData } = await supabase
        .from("cm_dre_month_closure")
        .select("*")
        .eq("ano", ano);

      setLogs(logsData || []);
      
      // Mapear closures de 1 a 12
      const mappedClosures = Array.from({ length: 12 }, (_, idx) => {
        const mesIdx = idx + 1;
        const info = closureData?.find(c => c.mes === mesIdx);
        return {
          mes: mesIdx,
          is_closed: info ? info.is_closed : false,
          closed_by: info?.closed_by,
          closed_at: info?.closed_at,
          notes: info?.notes,
          reopened_by: info?.reopened_by,
          reopened_at: info?.reopened_at,
          reopen_reason: info?.reopen_reason,
          snapshot_checksum: info?.snapshot_checksum
        };
      });
      setClosures(mappedClosures);
    } catch (e) {
      console.error("Erro ao carregar histórico:", e);
    } finally {
      setLoading(false);
    }
  }, [ano, supabase]);

  useEffect(() => {
    loadLogsAndClosures();
  }, [loadLogsAndClosures]);

  const handleRollback = async (logId: string) => {
    if (!confirm("Tem certeza que deseja desfazer essa importação? Todas as linhas e versões geradas serão revertidas.")) return;
    setActionLoading(`rollback_${logId}`);
    try {
      await desfazerImportacao(logId);
      alert("Importação desfeita e versões anteriores recuperadas com sucesso!");
      loadLogsAndClosures();
    } catch (e: any) {
      alert(`Falha no rollback: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCloseMonth = async () => {
    if (!closeModal) return;
    setActionLoading(`close_${closeModal.mes}`);
    try {
      const result = await fecharMesDRE({
        ano,
        mes: closeModal.mes,
        notes: closeModal.notes
      });
      alert(`Mês fechado com sucesso! Checksum gerado: ${result.checksum}`);
      setCloseModal(null);
      loadLogsAndClosures();
    } catch (e: any) {
      alert(`Falha ao fechar mês: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReopenMonth = async () => {
    if (!reopenModal) return;
    if (!reopenModal.reason.trim()) {
      alert("O motivo de reabertura é obrigatório.");
      return;
    }
    setActionLoading(`reopen_${reopenModal.mes}`);
    try {
      await reabrirMesDRE({
        ano,
        mes: reopenModal.mes,
        reason: reopenModal.reason
      });
      alert("Competência reaberta com sucesso!");
      setReopenModal(null);
      loadLogsAndClosures();
    } catch (e: any) {
      alert(`Falha ao reabrir: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navbar */}
      <nav className="cm-navbar px-6 py-4 flex items-center justify-between border-b border-border bg-elevated/50">
        <div className="flex items-center gap-3">
          <Link href="/dre" className="text-muted hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-bold text-lg text-foreground flex items-center gap-2">
            <History className="w-5 h-5 text-gold" /> Histórico & Auditoria DRE
          </span>
        </div>
        <ThemeToggle />
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-8">
        {/* Filtro de Ano */}
        <div className="flex items-center justify-between bg-elevated border border-border p-4 rounded-xl">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold">Exercício:</span>
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="bg-background border border-border px-3 py-1.5 rounded-lg text-sm font-mono [color-scheme:dark]"
            >
              {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadLogsAndClosures}
              disabled={loading}
              className="p-2 border border-border rounded-lg hover:bg-border/30 text-muted hover:text-foreground disabled:opacity-50"
              title="Recarregar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <Link
              href="/dre/upload"
              className="px-4 py-1.5 bg-gold hover:bg-gold-hover text-black font-bold rounded-lg text-sm flex items-center gap-1.5 transition-colors"
            >
              <Upload className="w-4 h-4" /> Importar Excel
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <Loader2 className="w-8 h-8 text-gold animate-spin" />
            <span className="text-sm text-muted">Carregando logs e fechamentos...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Seção 1: Fechamento de Competências (1/3 width) */}
            <div className="lg:col-span-1 space-y-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4 text-gold" /> Fechamento Mensal
              </h3>
              <div className="bg-elevated border border-border rounded-xl divide-y divide-border">
                {closures.map((c) => (
                  <div key={c.mes} className="p-4 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-semibold block">{MONTHS[c.mes - 1]}</span>
                      {c.is_closed ? (
                        <div className="text-[10px] text-green-400 font-mono mt-0.5 flex flex-col">
                          <span>Checksum: {c.snapshot_checksum?.slice(0, 8)}...</span>
                          <span className="text-muted/80">Fechado em: {new Date(c.closed_at).toLocaleDateString()}</span>
                        </div>
                      ) : c.reopened_at ? (
                        <div className="text-[10px] text-yellow-400 font-mono mt-0.5 flex flex-col">
                          <span>Reaberto: {new Date(c.reopened_at).toLocaleDateString()}</span>
                          <span className="text-muted/80 truncate max-w-[180px]">Motivo: {c.reopen_reason}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted font-mono mt-0.5">Sem fechamento registrado</span>
                      )}
                    </div>
                    <div>
                      {c.is_closed ? (
                        <button
                          onClick={() => setReopenModal({ open: true, mes: c.mes, reason: "" })}
                          disabled={actionLoading === `reopen_${c.mes}`}
                          className="px-2.5 py-1 text-xs border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <Unlock className="w-3.5 h-3.5" /> Reabrir
                        </button>
                      ) : (
                        <button
                          onClick={() => setCloseModal({ open: true, mes: c.mes, notes: "" })}
                          disabled={actionLoading === `close_${c.mes}`}
                          className="px-2.5 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <Lock className="w-3.5 h-3.5" /> Fechar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seção 2: Histórico de Importações (2/3 width) */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <History className="w-4 h-4 text-gold" /> Log de Importações
              </h3>

              <div className="bg-elevated border border-border rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-background/80 text-muted border-b border-border">
                      <th className="p-3 font-semibold">Origem / Arquivo</th>
                      <th className="p-3 font-semibold">Data / Hora</th>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold">Linhas</th>
                      <th className="p-3 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted">
                          Nenhuma importação encontrada.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => {
                        const statusColors: any = {
                          success: "bg-green-500/10 text-green-400 border-green-500/30",
                          error: "bg-red-500/10 text-red-400 border-red-500/30",
                          rolled_back: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
                          uploaded: "bg-blue-500/10 text-blue-400 border-blue-500/30",
                          parsing: "bg-purple-500/10 text-purple-400 border-purple-500/30",
                          normalizing: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
                          syncing_bigquery: "bg-orange-500/10 text-orange-400 border-orange-500/30"
                        };

                        return (
                          <tr key={log.id} className="hover:bg-background/20 font-mono text-xs">
                            <td className="p-3">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] uppercase font-bold mr-2 ${
                                log.source === 'bigquery' ? 'bg-blue-600/20 text-blue-400' : 'bg-green-600/20 text-green-400'
                              }`}>
                                {log.source}
                              </span>
                              <span className="text-foreground font-sans font-medium">{log.filename}</span>
                            </td>
                            <td className="p-3 text-muted">
                              {new Date(log.started_at).toLocaleString()}
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusColors[log.status] || "border-border text-muted"}`}>
                                {log.status}
                              </span>
                            </td>
                            <td className="p-3 text-foreground font-semibold">
                              {log.rows_imported}
                            </td>
                            <td className="p-3 text-right">
                              {log.status === "success" && (
                                <button
                                  onClick={() => handleRollback(log.id)}
                                  disabled={actionLoading === `rollback_${log.id}`}
                                  className="text-xs text-yellow-500 hover:text-yellow-400 font-bold flex items-center gap-1 ml-auto border border-yellow-500/20 px-2 py-1 rounded hover:bg-yellow-500/5 disabled:opacity-50"
                                >
                                  {actionLoading === `rollback_${log.id}` ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Undo2 className="w-3.5 h-3.5" />
                                  )}
                                  Desfazer
                                </button>
                              )}
                              {log.status === "error" && log.error_log && (
                                <div className="text-[10px] text-red-400 text-left max-w-xs truncate" title={log.error_log}>
                                  {log.error_log}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* Modal Fechamento */}
      {closeModal?.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-elevated border border-border p-6 rounded-2xl max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Lock className="w-5 h-5 text-green-500" /> Fechar Mês {MONTHS[closeModal.mes - 1]} / {ano}
            </h3>
            <p className="text-sm text-muted">
              Ao fechar o mês, os dados serão congelados e o snapshot consolidado com checksum MD5 será gerado.
            </p>
            <div>
              <label className="text-xs text-muted block mb-1">Notas de Fechamento (Opcional)</label>
              <textarea
                value={closeModal.notes}
                onChange={(e) => setCloseModal({ ...closeModal, notes: e.target.value })}
                placeholder="Ex: Números consolidados após auditoria fiscal..."
                className="w-full bg-background border border-border p-2.5 rounded-xl text-sm min-h-[80px] [color-scheme:dark]"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCloseModal(null)}
                className="px-4 py-2 border border-border hover:bg-border/30 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleCloseMonth}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm"
              >
                Confirmar Fechamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reabertura */}
      {reopenModal?.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-elevated border border-border p-6 rounded-2xl max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Unlock className="w-5 h-5 text-yellow-500" /> Reabrir Mês {MONTHS[reopenModal.mes - 1]} / {ano}
            </h3>
            <p className="text-sm text-muted">
              A reabertura é um processo auditado. Você deve justificar a necessidade de reabrir este mês.
            </p>
            <div>
              <label className="text-xs text-muted block mb-1">Justificativa de Reabertura (Obrigatório)</label>
              <textarea
                value={reopenModal.reason}
                onChange={(e) => setReopenModal({ ...reopenModal, reason: e.target.value })}
                placeholder="Ex: Necessidade de ajustar o CMV lançado na planilha de custos do gerente..."
                className="w-full bg-background border border-border p-2.5 rounded-xl text-sm min-h-[80px] [color-scheme:dark]"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setReopenModal(null)}
                className="px-4 py-2 border border-border hover:bg-border/30 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleReopenMonth}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-xl text-sm"
              >
                Confirmar Reabertura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
