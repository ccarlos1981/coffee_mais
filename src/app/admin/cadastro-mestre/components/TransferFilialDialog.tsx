"use client";

import { useCadastroMestre, FilialData } from "../hooks";
import { useGovernanceRequests } from "../../qualidade/hooks";
import { X, Send, AlertTriangle } from "lucide-react";
import React, { useState } from "react";

interface TransferFilialDialogProps {
  filial: FilialData;
  onClose: () => void;
  onSuccess: () => void;
}

export function TransferFilialDialog({ filial, onClose, onSuccess }: TransferFilialDialogProps) {
  const { redes } = useCadastroMestre();
  const { createRequest, transitionRequest } = useGovernanceRequests();
  const [targetMatrixCode, setTargetMatrixCode] = useState("");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filter out the current network matrix code
  const alternativeRedes = redes.filter(r => r.codigo !== filial.codigo_matriz);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetMatrixCode || !justification.trim()) {
      alert("Selecione a nova Rede Comercial e preencha a Justificativa.");
      return;
    }

    const targetRede = redes.find(r => r.codigo === targetMatrixCode);
    if (!targetRede) {
      alert("Rede selecionada inválida.");
      return;
    }

    try {
      setSubmitting(true);

      // 1. Create a draft proposal (RASCUNHO)
      const payload = {
        cliente_codigo: filial.codigo,
        uf_proposta: filial.uf,
        codigo_matriz_proposto: targetRede.codigo,
        responsavel_proposto: targetRede.manager, // inherit manager from target network
        justificativa: justification.trim()
      };

      const request = await createRequest(payload);
      if (!request || !request.id) {
        throw new Error("Erro ao gerar rascunho de transferência cadastral.");
      }

      // 2. Submit it for approval immediately (PENDENTE_APROVACAO)
      const successTransition = await transitionRequest(
        request.id,
        "PENDENTE_APROVACAO",
        "Submissão automatizada de transferência via Cadastro Mestre Comercial"
      );

      if (successTransition) {
        alert("Solicitação de transferência enviada para aprovação do gerente de governança!");
        onSuccess();
      } else {
        alert("Rascunho criado, mas houve um erro ao enviar para aprovação. Acesse a fila de qualidade para submetê-lo.");
        onSuccess();
      }

    } catch (err: any) {
      alert(err.message || "Erro ao processar transferência comercial.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
        
        {/* Title */}
        <div className="flex items-start justify-between border-b border-border/50 pb-3">
          <div>
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-500">Fluxo de Governança Comercial</span>
            <h3 className="text-sm font-extrabold text-foreground mt-0.5">
              Propor Transferência de Rede
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Details */}
        <div className="bg-background/40 border border-border rounded-xl p-3 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Filial Comercial:</span>
            <span className="font-semibold text-foreground">{filial.nome_parceiro} (Cód. {filial.codigo})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">UF / Cidade:</span>
            <span className="font-semibold text-foreground">{filial.uf} / {filial.cidade || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gerente Atual:</span>
            <span className="font-semibold text-foreground">{filial.responsavel || "Não associado"}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-muted-foreground block">Nova Rede Comercial de Destino *</label>
            <select
              value={targetMatrixCode}
              onChange={(e) => setTargetMatrixCode(e.target.value)}
              className="w-full px-3 py-1.5 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="">Selecione a nova rede destino...</option>
              {alternativeRedes.map((r) => (
                <option key={r.codigo} value={r.codigo}>
                  {r.nome} (Gerente: {r.manager || "s/ gerente"})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-muted-foreground block">Justificativa Comercial *</label>
            <textarea
              rows={3}
              placeholder="Descreva detalhadamente o motivo comercial da transferência de rede..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          {/* Warning badge */}
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl p-3 flex gap-2 text-[10px] items-start">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              **Atenção:** Em conformidade com a Baseline v1.1.0, esta operação não altera a base de dados de imediato. Ela gerará uma proposta que aguardará a homologação comercial de governança.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-border hover:bg-muted/10 rounded-xl font-semibold text-muted-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 rounded-xl font-semibold text-white flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" /> {submitting ? "Enviando..." : "Enviar Proposta"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
