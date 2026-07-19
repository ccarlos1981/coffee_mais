"use client";

import { useCadastroMestre, UnifiedSearchResult, FilialData } from "../hooks";
import { Search, ChevronDown, ChevronUp, FileText, ArrowRight, UserCheck, Calendar, ShieldAlert, Award } from "lucide-react";
import React, { useState } from "react";
import { TransferFilialDialog } from "./TransferFilialDialog";

export function UnifiedSearch() {
  const { searchQuery, setSearchQuery, triggerSearch, searchResults, loading, error } = useCadastroMestre();
  const [isFiliaisOpen, setIsFiliaisOpen] = useState(true);
  const [transferringFilial, setTransferringFilial] = useState<FilialData | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerSearch(searchQuery);
  };

  const getStatusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      RASCUNHO: "bg-slate-500/10 text-slate-500 border-slate-500/20",
      PENDENTE_APROVACAO: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      APROVADO: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      REJEITADO: "bg-red-500/10 text-red-600 border-red-500/20",
      CANCELADO: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    };
    return classes[status] || "bg-slate-100 text-slate-800";
  };

  return (
    <div className="space-y-6">
      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Digite o nome de uma Rede ou o código de um Cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-xs font-semibold text-white rounded-xl transition-colors"
        >
          {loading ? "Buscando..." : "Pesquisar"}
        </button>
      </form>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-xs">
          {error}
        </div>
      )}

      {!searchResults && !loading && (
        <div className="text-center py-16 text-muted-foreground text-xs bg-background/20 border border-dashed border-border rounded-2xl">
          Use a busca unificada acima para localizar redes, matrizes, filiais, históricos e pendências cadastrais.
        </div>
      )}

      {searchResults && (
        <div className="space-y-6 animate-fade-in">
          {searchResults.rede ? (
            <>
              {/* KPIs & Indicators Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card border border-border p-5 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Filiais Vinculadas</span>
                    <span className="text-2xl font-black text-foreground mt-1 block">
                      {searchResults.kpis.totalFiliais}
                    </span>
                  </div>
                  <FileText className="w-8 h-8 text-amber-500 opacity-20" />
                </div>
                <div className="bg-card border border-border p-5 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Solicitações Ativas</span>
                    <span className="text-2xl font-black text-foreground mt-1 block">
                      {searchResults.kpis.activeWorkflows}
                    </span>
                  </div>
                  <ShieldAlert className="w-8 h-8 text-amber-500 opacity-20" />
                </div>
                <div className="bg-card border border-border p-5 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Índice de Qualidade (IQC)</span>
                    <span className={`text-2xl font-black mt-1 block ${searchResults.kpis.iqcScore >= 95 ? "text-emerald-500" : "text-amber-500"}`}>
                      {searchResults.kpis.iqcScore}%
                    </span>
                  </div>
                  <Award className="w-8 h-8 text-amber-500 opacity-20" />
                </div>
              </div>

              {/* Rede details */}
              <div className="bg-card border border-border p-6 rounded-2xl space-y-4">
                <div className="flex items-start justify-between border-b border-border/50 pb-3">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-500">Perfil da Rede Comercial</span>
                    <h3 className="text-base font-extrabold text-foreground mt-0.5">{searchResults.rede.nome}</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full border border-border bg-muted/20 text-[10px] font-bold uppercase text-muted-foreground">
                    Cód. Matriz: {searchResults.rede.codigo}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[9px] uppercase font-bold">Canal de Vendas</span>
                    <span className="font-semibold text-foreground mt-0.5 block">{searchResults.rede.canal || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[9px] uppercase font-bold">Gerente Responsável</span>
                    <span className="font-semibold text-foreground mt-0.5 block">{searchResults.rede.manager || "Não associado"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[9px] uppercase font-bold">Atualizado em</span>
                    <span className="font-semibold text-foreground mt-0.5 block">
                      {new Date(searchResults.rede.updated_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Collapsible Filiais list */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setIsFiliaisOpen(!isFiliaisOpen)}
                  className="w-full flex items-center justify-between p-4 bg-muted/10 border-b border-border/50 text-left"
                >
                  <span className="text-xs uppercase tracking-wider font-extrabold text-foreground">
                    Filiais Cadastradas ({searchResults.filiais.length})
                  </span>
                  {isFiliaisOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isFiliaisOpen && (
                  <div className="overflow-x-auto">
                    {searchResults.filiais.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-xs">Nenhuma filial vinculada a esta rede.</div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-border/50 text-[10px] uppercase text-muted-foreground tracking-wider bg-background/20">
                            <th className="py-2.5 px-4 font-semibold">Código</th>
                            <th className="py-2.5 px-4 font-semibold">Nome do Parceiro</th>
                            <th className="py-2.5 px-4 font-semibold">Cidade / UF</th>
                            <th className="py-2.5 px-4 font-semibold">Gerente</th>
                            <th className="py-2.5 px-4 font-semibold">CNPJ</th>
                            <th className="py-2.5 px-4 font-semibold text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50 text-xs">
                          {searchResults.filiais.map((filial) => (
                            <tr key={filial.codigo} className="hover:bg-muted/5 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-foreground/80">{filial.codigo}</td>
                              <td className="py-3 px-4 font-semibold text-foreground">{filial.nome_parceiro}</td>
                              <td className="py-3 px-4 text-muted-foreground">
                                {filial.cidade || "-"} / {filial.uf || "-"}
                              </td>
                              <td className="py-3 px-4 font-medium text-foreground">{filial.responsavel || "-"}</td>
                              <td className="py-3 px-4 font-mono text-muted-foreground">{filial.cnpj || "-"}</td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => setTransferringFilial(filial)}
                                  className="px-2 py-1 bg-amber-500/10 border border-amber-500/25 text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition-all text-[10px] font-bold"
                                >
                                  Transferir
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>

              {/* Workflows Active */}
              <div className="bg-card border border-border p-6 rounded-2xl space-y-4">
                <h4 className="text-xs uppercase tracking-wider font-extrabold text-foreground border-b border-border/50 pb-2">
                  Solicitações de Workflow Cadastral
                </h4>
                {searchResults.workflows.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-xs bg-background/10 rounded-xl border border-dashed border-border/50">
                    Nenhuma proposta ou alteração cadastral aberta para estas filiais.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {searchResults.workflows.map((wf) => (
                      <div key={wf.id} className="border border-border bg-background/40 p-4 rounded-xl flex items-center justify-between text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-foreground">#{wf.id.substring(0, 8)}</span>
                            <span className="text-muted-foreground">Filial Cód: {wf.cliente_codigo}</span>
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${getStatusBadgeClass(wf.status)}`}>
                              {wf.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground italic">"{wf.justificativa}"</p>
                        </div>
                        <div className="text-right text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(wf.created_at).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Audit logs */}
              <div className="bg-card border border-border p-6 rounded-2xl space-y-4">
                <h4 className="text-xs uppercase tracking-wider font-extrabold text-foreground border-b border-border/50 pb-2">
                  Trilha de Auditoria Cadastral
                </h4>
                {searchResults.auditLogs.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-xs bg-background/10 rounded-xl border border-dashed border-border/50">
                    Sem registros de alterações cadastrais recentes nesta rede.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {searchResults.auditLogs.map((log) => (
                      <div key={log.id} className="border border-border bg-background/20 p-4 rounded-xl text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-500 uppercase text-[10px] tracking-wider">{log.action_type}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                        <p className="text-muted-foreground text-[11px] italic">"{log.justificativa}"</p>
                        <div className="grid grid-cols-2 gap-4 bg-card/50 p-2.5 rounded-lg border border-border/40 text-[10px]">
                          {log.old_value && (
                            <div>
                              <span className="text-muted-foreground block font-bold mb-1">Antes</span>
                              <pre className="font-mono text-[9px] text-foreground overflow-x-auto">{JSON.stringify(JSON.parse(log.old_value), null, 2)}</pre>
                            </div>
                          )}
                          {log.new_value && (
                            <div>
                              <span className="text-muted-foreground block font-bold mb-1">Proposto/Novo</span>
                              <pre className="font-mono text-[9px] text-foreground overflow-x-auto">{JSON.stringify(JSON.parse(log.new_value), null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-xs bg-background/30 border border-dashed border-border rounded-2xl">
              Nenhuma rede ou filial encontrada correspondente ao termo "{searchQuery}". Verifique os dados inseridos.
            </div>
          )}
        </div>
      )}
      {transferringFilial && (
        <TransferFilialDialog
          filial={transferringFilial}
          onClose={() => setTransferringFilial(null)}
          onSuccess={() => {
            setTransferringFilial(null);
            triggerSearch(searchQuery);
          }}
        />
      )}
    </div>
  );
}
