"use client";

import { useGovernanceRequests, RequestData } from "../hooks";
import { Check, X, ShieldAlert, ArrowRight, Filter, Search, Calendar, ChevronLeft, ChevronRight, Info } from "lucide-react";
import React, { useState } from "react";

export function QualityApprovalQueue() {
  const {
    loading,
    error,
    data: requests,
    pagination,
    page,
    search,
    status,
    setPage,
    setSearch,
    setStatus,
    transitionRequest,
  } = useGovernanceRequests();

  const [inputSearch, setInputSearch] = useState(search);
  const [selectedReq, setSelectedReq] = useState<RequestData | null>(null);
  const [justificationNotes, setJustificationNotes] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(inputSearch);
    setPage(1);
  };

  const handleTransition = async (reqId: string, nextStatus: "APROVADO" | "REJEITADO") => {
    const actionLabel = nextStatus === "APROVADO" ? "aprovar" : "rejeitar";
    if (confirm(`Deseja realmente ${actionLabel} esta solicitação?`)) {
      const success = await transitionRequest(reqId, nextStatus, justificationNotes || `Homologado via painel: ${nextStatus}`);
      if (success) {
        setSelectedReq(null);
        setJustificationNotes("");
      }
    }
  };

  const getDiffStyle = (current: any, proposed: any) => {
    if (proposed === null || proposed === undefined || proposed === "") return "text-foreground";
    return current !== proposed ? "text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/25 animate-pulse" : "text-foreground/80";
  };

  const getStatusBadge = (stat: string) => {
    const badges: Record<string, string> = {
      RASCUNHO: "bg-slate-500/10 text-slate-500 border-slate-500/20",
      PENDENTE_APROVACAO: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      APROVADO: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      REJEITADO: "bg-red-500/10 text-red-600 border-red-500/20",
      CANCELADO: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    };
    return <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${badges[stat] || "bg-slate-100"}`}>{stat}</span>;
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Fila de Homologação Comercial
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aprovação ou rejeição controlada de alterações cadastrais de ownership e UFs.
          </p>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar solicitação..."
              value={inputSearch}
              onChange={(e) => setInputSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </form>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-48 px-3 py-1.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            <option value="">Todos Estados</option>
            <option value="PENDENTE_APROVACAO">Pendentes</option>
            <option value="APROVADO">Aprovados</option>
            <option value="REJEITADO">Rejeitados</option>
            <option value="CANCELADO">Cancelados</option>
            <option value="RASCUNHO">Rascunhos</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-xl w-full"></div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-xs">{error}</div>
      ) : !requests || requests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-xs bg-background/30 border border-dashed border-border rounded-2xl">
          Nenhuma solicitação pendente ou filtrada na fila.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-[10px] uppercase text-muted-foreground tracking-wider">
                  <th className="pb-3 px-4 font-semibold">Cód. Solicitação</th>
                  <th className="pb-3 px-4 font-semibold">Parceiro</th>
                  <th className="pb-3 px-4 font-semibold">Valores (Atual → Proposto)</th>
                  <th className="pb-3 px-4 font-semibold">Status</th>
                  <th className="pb-3 px-4 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-xs">
                {requests.map((req) => {
                  const client = req.cm_clientes;
                  const isPending = req.status === "PENDENTE_APROVACAO";

                  return (
                    <tr key={req.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="py-4 px-4 font-mono font-bold text-foreground/80">
                        #{req.id.substring(0, 8)}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-foreground">{client?.nome_parceiro || "Indeterminado"}</div>
                        <div className="text-[10px] text-muted-foreground">Código Filial: {req.cliente_codigo}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1 text-[10px]">
                          {req.uf_proposta && (
                            <span className="flex items-center gap-1">
                              <span className="text-muted-foreground font-semibold uppercase">UF:</span> {client?.uf || "-"}
                              <ArrowRight className="w-3 h-3 text-muted-foreground" />
                              <span className={getDiffStyle(client?.uf, req.uf_proposta)}>{req.uf_proposta}</span>
                            </span>
                          )}
                          {req.codigo_matriz_proposto && (
                            <span className="flex items-center gap-1">
                              <span className="text-muted-foreground font-semibold uppercase">Matriz:</span> {client?.codigo_matriz || "s/ matriz"}
                              <ArrowRight className="w-3 h-3 text-muted-foreground" />
                              <span className={getDiffStyle(client?.codigo_matriz, req.codigo_matriz_proposto)}>{req.codigo_matriz_proposto}</span>
                            </span>
                          )}
                          {req.responsavel_proposto && (
                            <span className="flex items-center gap-1">
                              <span className="text-muted-foreground font-semibold uppercase">Gerente:</span> {client?.responsavel || "s/ gerente"}
                              <ArrowRight className="w-3 h-3 text-muted-foreground" />
                              <span className={getDiffStyle(client?.responsavel, req.responsavel_proposto)}>{req.responsavel_proposto}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {getStatusBadge(req.status)}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => setSelectedReq(req)}
                          className="px-2.5 py-1 bg-card hover:bg-muted border border-border text-[10px] font-bold rounded-lg text-foreground transition-colors"
                        >
                          Analisar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between border-t border-border/50 pt-4 text-xs">
              <span className="text-muted-foreground">
                Exibindo {requests.length} de {pagination.total_records} solicitações
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-1.5 bg-card border border-border rounded-lg hover:bg-muted/10 transition-colors disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold">
                  Página {page} de {pagination.total_pages}
                </span>
                <button
                  onClick={() => setPage(Math.min(pagination.total_pages, page + 1))}
                  disabled={page === pagination.total_pages}
                  className="p-1.5 bg-card border border-border rounded-lg hover:bg-muted/10 transition-colors disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Modal de Análise Detalhada */}
          {selectedReq && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
                <div className="flex items-start justify-between border-b border-border/50 pb-3">
                  <div>
                    <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest font-bold">Análise de Governança comercial</span>
                    <h3 className="text-base font-bold text-foreground mt-0.5">
                      Solicitação #{selectedReq.id.substring(0, 8)} (v{selectedReq.versao})
                    </h3>
                  </div>
                  <button onClick={() => setSelectedReq(null)} className="p-1 hover:bg-muted rounded-lg text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase font-semibold">Parceiro</span>
                      <p className="font-bold text-foreground mt-0.5">{selectedReq.cm_clientes?.nome_parceiro || "Cliente"}</p>
                      <p className="text-[10px] text-muted-foreground">Cód. {selectedReq.cliente_codigo}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase font-semibold">Data da Proposta</span>
                      <p className="font-bold text-foreground mt-0.5">
                        {new Date(selectedReq.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>

                  <div className="bg-background/40 border border-border rounded-xl p-4 space-y-3">
                    <h4 className="font-bold text-[10px] uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" /> Comparativo de Valores
                    </h4>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <span className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">Campo</span>
                        <div className="py-1 text-muted-foreground">UF</div>
                        <div className="py-1 text-muted-foreground">Matriz</div>
                        <div className="py-1 text-muted-foreground">Gerente</div>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">Atual</span>
                        <div className="py-1 font-mono">{selectedReq.cm_clientes?.uf || "-"}</div>
                        <div className="py-1 font-mono truncate max-w-[80px]">{selectedReq.cm_clientes?.codigo_matriz || "s/ matriz"}</div>
                        <div className="py-1 truncate max-w-[80px]">{selectedReq.cm_clientes?.responsavel || "s/ gerente"}</div>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">Proposto</span>
                        <div className="py-1 font-mono"><span className={getDiffStyle(selectedReq.cm_clientes?.uf, selectedReq.uf_proposta)}>{selectedReq.uf_proposta || "-"}</span></div>
                        <div className="py-1 font-mono truncate max-w-[80px]"><span className={getDiffStyle(selectedReq.cm_clientes?.codigo_matriz, selectedReq.codigo_matriz_proposto)}>{selectedReq.codigo_matriz_proposto || "-"}</span></div>
                        <div className="py-1 truncate max-w-[80px]"><span className={getDiffStyle(selectedReq.cm_clientes?.responsavel, selectedReq.responsavel_proposto)}>{selectedReq.responsavel_proposto || "-"}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-muted-foreground text-[10px] uppercase font-semibold">Justificativa do Solicitante</span>
                    <p className="bg-background/20 p-3 rounded-lg border border-border italic text-foreground/90">
                      "{selectedReq.justificativa}"
                    </p>
                  </div>

                  {selectedReq.status === "PENDENTE_APROVACAO" && (
                    <div className="space-y-2 pt-2">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">Parecer do Homologador (Opcional)</label>
                      <textarea
                        rows={2}
                        placeholder="Adicione observações ou motivos de rejeição..."
                        value={justificationNotes}
                        onChange={(e) => setJustificationNotes(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-4">
                  <button
                    onClick={() => setSelectedReq(null)}
                    className="px-3 py-1.5 border border-border hover:bg-muted/10 rounded-xl text-xs font-semibold text-muted-foreground"
                  >
                    Fechar
                  </button>
                  {selectedReq.status === "PENDENTE_APROVACAO" && (
                    <>
                      <button
                        onClick={() => handleTransition(selectedReq.id, "REJEITADO")}
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-xl text-xs font-semibold text-white flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Rejeitar
                      </button>
                      <button
                        onClick={() => handleTransition(selectedReq.id, "APROVADO")}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-xs font-semibold text-white flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Aprovar e Aplicar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
