"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Search, Loader2, Plus, Calendar, AlertTriangle, Building2, Check } from "lucide-react";
import type { FollowUpOrigem, FollowUpPrioridade, FollowUpTipo } from "@/lib/services/follow-up-service";

interface NewFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface ClientOption {
  id: string;
  nome: string;
  rede: string | null;
  codigo: string;
  responsavel: string | null;
}

const TIPO_OPTIONS: { value: FollowUpTipo; label: string }[] = [
  { value: "REATIVACAO_CLIENTE", label: "Reativação de Cliente" },
  { value: "EXPANSAO_MIX", label: "Expansão de Mix" },
  { value: "RECUPERACAO_VOLUME", label: "Recuperação de Volume" },
  { value: "NEGOCIACAO_REDE", label: "Negociação em Rede" },
  { value: "VISITA_COMERCIAL", label: "Visita Comercial" },
  { value: "ENVIO_PROPOSTA", label: "Envio de Proposta" },
  { value: "OUTRO", label: "Outra Ação" },
];

const PRIORIDADE_OPTIONS: { value: FollowUpPrioridade; label: string }[] = [
  { value: "MEDIA", label: "Média" },
  { value: "ALTA", label: "Alta" },
  { value: "CRITICA", label: "Crítica" },
  { value: "BAIXA", label: "Baixa" },
];

const ORIGEM_OPTIONS: { value: FollowUpOrigem; label: string }[] = [
  { value: "MANUAL", label: "Manual" },
  { value: "COCKPIT_PRESCRITIVO", label: "Cockpit Prescritivo" },
  { value: "RANKING_PERFORMANCE", label: "Ranking Performance" },
  { value: "ALERTA_QUEDA", label: "Alerta de Queda" },
  { value: "RPS_COMPROMISSO", label: "RPS Compromisso" },
];

export function NewFollowUpModal({ isOpen, onClose, onCreated }: NewFollowUpModalProps) {
  // Form State
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [tipoAcao, setTipoAcao] = useState<FollowUpTipo>("REATIVACAO_CLIENTE");
  const [motivo, setMotivo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [prioridade, setPrioridade] = useState<FollowUpPrioridade>("MEDIA");
  const [origem, setOrigem] = useState<FollowUpOrigem>("MANUAL");

  // Client Search State
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client Autocomplete fetch
  const fetchClients = useCallback(async (query: string) => {
    try {
      setSearchingClients(true);
      const res = await fetch(`/api/clientes/search?q=${encodeURIComponent(query)}&limit=15`, { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setClientOptions(json.data);
      }
    } catch (err) {
      console.error("Erro ao buscar clientes:", err);
    } finally {
      setSearchingClients(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchClients("");
    }
  }, [isOpen, fetchClients]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setClientSearchQuery(val);
    fetchClients(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedClient) {
      setError("Selecione um cliente.");
      return;
    }
    if (!motivo.trim()) {
      setError("Informe o motivo ou diagnóstico da ação.");
      return;
    }
    if (!prazo) {
      setError("Informe a data-limite (prazo).");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: selectedClient.id,
          tipo_acao: tipoAcao,
          motivo: motivo.trim(),
          descricao: descricao.trim() || undefined,
          prazo,
          prioridade,
          origem,
        }),
      });

      const json = await res.json();
      if (json.success) {
        // Reset form
        setSelectedClient(null);
        setMotivo("");
        setDescricao("");
        onCreated();
        onClose();
      } else {
        setError(json.error || "Erro ao registrar ação.");
      }
    } catch (err: any) {
      console.error("Erro ao enviar formulário:", err);
      setError("Falha na comunicação com o servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-xl p-6 w-full max-w-lg space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-foreground">Nova Ação de Follow-up</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted/20 text-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Client Autocomplete Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Cliente *</label>

            {selectedClient ? (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
                <div>
                  <span className="font-bold text-foreground">{selectedClient.nome}</span>
                  {selectedClient.rede && (
                    <span className="text-muted text-[11px] block">Rede: {selectedClient.rede}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedClient(null)}
                  className="text-xs text-muted hover:text-rose-400 font-semibold px-2 py-1"
                >
                  Trocar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
                  <input
                    type="text"
                    value={clientSearchQuery}
                    onChange={handleSearchChange}
                    placeholder="Buscar cliente por nome ou código..."
                    className="w-full pl-9 pr-3 py-2 bg-muted/10 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-amber-500"
                  />
                  {searchingClients && (
                    <Loader2 className="w-4 h-4 absolute right-3 top-2.5 text-amber-500 animate-spin" />
                  )}
                </div>

                <div className="max-h-36 overflow-y-auto border border-border/50 rounded-lg divide-y divide-border/30 bg-muted/5">
                  {clientOptions.length === 0 ? (
                    <p className="p-3 text-xs text-muted text-center">Nenhum cliente encontrado.</p>
                  ) : (
                    clientOptions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedClient(c);
                          setClientSearchQuery("");
                        }}
                        className="w-full p-2 text-left hover:bg-amber-500/10 transition-colors flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-foreground">{c.nome}</div>
                          {c.rede && <div className="text-[10px] text-muted">{c.rede}</div>}
                        </div>
                        {c.codigo && <span className="text-[10px] text-muted font-mono">{c.codigo}</span>}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Type & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">Tipo de Ação *</label>
              <select
                value={tipoAcao}
                onChange={(e) => setTipoAcao(e.target.value as FollowUpTipo)}
                className="w-full bg-muted/10 border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
              >
                {TIPO_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">Prioridade *</label>
              <select
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as FollowUpPrioridade)}
                className="w-full bg-muted/10 border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
              >
                {PRIORIDADE_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Deadline & Origin */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">Prazo (Data Limite) *</label>
              <input
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                className="w-full bg-muted/10 border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">Origem</label>
              <select
                value={origem}
                onChange={(e) => setOrigem(e.target.value as FollowUpOrigem)}
                className="w-full bg-muted/10 border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
              >
                {ORIGEM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">Motivo / Diagnóstico *</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva a razão do contato ou diagnóstico..."
              rows={2}
              className="w-full bg-muted/10 border border-border rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Descrição (optional) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted">Descrição detalhada (opcional)</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes adicionais sobre a estratégia..."
              rows={2}
              className="w-full bg-muted/10 border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Form Controls */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-muted/20 hover:bg-muted/30 text-xs font-semibold text-foreground rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-lg shadow transition-colors flex items-center gap-1.5"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Registrar Ação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
