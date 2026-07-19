"use client";

import { useGovernanceRequests, RequestData } from "../hooks";
import { Plus, Edit3, Send, Trash2, Calendar, FileText, CheckCircle, HelpCircle, Loader2 } from "lucide-react";
import React, { useState } from "react";

export function QualityRequestsList() {
  const {
    loading,
    error,
    data: requests,
    createRequest,
    updateRequest,
    transitionRequest,
  } = useGovernanceRequests();

  const [isCreating, setIsCreating] = useState(false);
  const [editingRequest, setEditingRequest] = useState<RequestData | null>(null);

  // Form states
  const [clientCode, setClientCode] = useState("");
  const [proposedUf, setProposedUf] = useState("");
  const [proposedMatrix, setProposedMatrix] = useState("");
  const [proposedManager, setProposedManager] = useState("");
  const [justification, setJustification] = useState("");

  const resetForm = () => {
    setClientCode("");
    setProposedUf("");
    setProposedMatrix("");
    setProposedManager("");
    setJustification("");
    setEditingRequest(null);
    setIsCreating(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientCode || !justification) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    const payload = {
      cliente_codigo: parseInt(clientCode),
      uf_proposta: proposedUf || null,
      codigo_matriz_proposto: proposedMatrix || null,
      responsavel_proposto: proposedManager || null,
      justificativa: justification,
    };

    const success = await createRequest(payload);
    if (success) resetForm();
  };

  const handleEditInit = (req: RequestData) => {
    setEditingRequest(req);
    setClientCode(req.cliente_codigo.toString());
    setProposedUf(req.uf_proposta || "");
    setProposedMatrix(req.codigo_matriz_proposto || "");
    setProposedManager(req.responsavel_proposto || "");
    setJustification(req.justificativa);
    setIsCreating(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequest) return;

    const payload = {
      uf_proposta: proposedUf || null,
      codigo_matriz_proposto: proposedMatrix || null,
      responsavel_proposto: proposedManager || null,
      justificativa: justification,
    };

    const success = await updateRequest(editingRequest.id, payload);
    if (success) resetForm();
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
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            Minhas Solicitações Cadastrais
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Crie, edite rascunhos e envie propostas de governança para avaliação.
          </p>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 rounded-xl text-xs font-semibold text-white transition-colors"
          >
            <Plus className="w-4 h-4" /> Nova Solicitação
          </button>
        )}
      </div>

      {isCreating ? (
        <form onSubmit={editingRequest ? handleUpdate : handleCreate} className="space-y-4 max-w-xl bg-background/30 border border-border p-5 rounded-2xl">
          <h4 className="text-sm font-bold text-foreground border-b border-border/50 pb-2">
            {editingRequest ? `Editar Solicitação #${editingRequest.id.substring(0, 8)}` : "Nova Solicitação de Ownership/UF"}
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Código do Cliente *</label>
              <input
                type="number"
                disabled={!!editingRequest}
                placeholder="Ex: 76191"
                value={clientCode}
                onChange={(e) => setClientCode(e.target.value)}
                className="w-full px-3 py-1.5 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-60"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Nova UF Proposta</label>
              <input
                type="text"
                placeholder="Ex: MG"
                maxLength={2}
                value={proposedUf}
                onChange={(e) => setProposedUf(e.target.value.toUpperCase())}
                className="w-full px-3 py-1.5 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Cód. Matriz Proposto</label>
              <input
                type="text"
                placeholder="Ex: 76191.2"
                value={proposedMatrix}
                onChange={(e) => setProposedMatrix(e.target.value)}
                className="w-full px-3 py-1.5 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Gerente/Responsável Proposto</label>
              <input
                type="text"
                placeholder="Ex: Julliano"
                value={proposedManager}
                onChange={(e) => setProposedManager(e.target.value)}
                className="w-full px-3 py-1.5 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Justificativa da Alteração *</label>
            <textarea
              rows={3}
              placeholder="Descreva o motivo desta solicitação de forma clara e detalhada..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 border border-border hover:bg-muted/10 rounded-xl text-xs font-semibold text-muted-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 rounded-xl text-xs font-semibold text-white"
            >
              {editingRequest ? "Atualizar Rascunho" : "Criar Rascunho"}
            </button>
          </div>
        </form>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-xs">{error}</div>
      ) : !requests || requests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-xs">
          Nenhuma solicitação cadastrada por você. Clique em "Nova Solicitação" para criar o primeiro rascunho.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {requests.map((req) => (
            <div key={req.id} className="border border-border bg-background/40 hover:bg-muted/5 p-5 rounded-2xl flex flex-col justify-between gap-4 transition-all">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground">ID: #{req.id.substring(0, 8)}</span>
                    <h4 className="font-semibold text-foreground text-sm">
                      {req.cm_clientes?.nome_parceiro || `Parceiro #${req.cliente_codigo}`}
                    </h4>
                  </div>
                  <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${getStatusBadgeClass(req.status)}`}>
                    {req.status}
                  </span>
                </div>

                <div className="bg-card/50 border border-border/30 rounded-xl p-3 grid grid-cols-2 gap-3 text-[10px]">
                  <div>
                    <span className="text-muted-foreground block">Proposto UF</span>
                    <span className="font-semibold text-foreground">{req.uf_proposta || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Proposto Matriz</span>
                    <span className="font-semibold text-foreground">{req.codigo_matriz_proposto || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Proposto Gerente</span>
                    <span className="font-semibold text-foreground">{req.responsavel_proposto || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Revisão Versão</span>
                    <span className="font-semibold text-foreground">v{req.versao}</span>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground line-clamp-2 italic">
                  "{req.justificativa}"
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-border/50 pt-3">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(req.created_at).toLocaleDateString("pt-BR")}
                </div>

                <div className="flex items-center gap-2">
                  {req.status === "RASCUNHO" && (
                    <>
                      <button
                        onClick={() => handleEditInit(req)}
                        className="p-1.5 bg-card border border-border rounded-lg text-muted-foreground hover:text-amber-500 transition-colors"
                        title="Editar Rascunho"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Deseja enviar esta solicitação para homologação comercial?")) {
                            transitionRequest(req.id, "PENDENTE_APROVACAO", "Submissão manual pelo criador");
                          }
                        }}
                        className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition-all"
                        title="Enviar para Aprovação"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Deseja cancelar esta solicitação?")) {
                            transitionRequest(req.id, "CANCELADO", "Cancelamento manual pelo rascunho");
                          }
                        }}
                        className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                        title="Cancelar Solicitação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  {req.status === "PENDENTE_APROVACAO" && (
                    <button
                      onClick={() => {
                        if (confirm("Deseja cancelar a solicitação pendente?")) {
                          transitionRequest(req.id, "CANCELADO", "Cancelamento da solicitação pendente");
                        }
                      }}
                      className="text-[10px] text-red-500 hover:underline"
                    >
                      Cancelar Envio
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
