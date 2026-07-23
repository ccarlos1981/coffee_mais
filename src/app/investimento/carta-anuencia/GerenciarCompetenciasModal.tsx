"use client";

import React, { useState } from "react";
import { X, Calendar, Plus, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CompetenciaItem, criarCompetencia } from "./actions";

interface GerenciarCompetenciasModalProps {
  competencias: CompetenciaItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export function GerenciarCompetenciasModal({ competencias, onClose, onSuccess }: GerenciarCompetenciasModalProps) {
  const [nome, setNome] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !dataInicio || !dataFim) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setSubmitting(true);
    try {
      await criarCompetencia({
        competencia: nome,
        data_inicio: dataInicio,
        data_fim: dataFim,
      });
      toast.success(`Competência "${nome}" cadastrada com sucesso!`);
      setNome("");
      setDataInicio("");
      setDataFim("");
      onSuccess();
    } catch (err: any) {
      console.error("Erro ao criar competência:", err);
      toast.error(err.message || "Erro ao cadastrar competência.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Competências Parametrizadas
              </h2>
              <p className="text-xs text-muted-foreground">
                Cadastrar novos períodos de vigência para Cartas de Anuência
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* New Competency Form */}
          <form onSubmit={handleSubmit} className="p-4 bg-card border border-border rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Nova Competência
            </h3>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Nome da Competência (ex: "Dezembro/2026", "Junho/2027")
              </label>
              <input
                type="text"
                placeholder="ex: Junho/2027"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Data de Início
                </label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Data de Fim
                </label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Salvar Competência
              </button>
            </div>
          </form>

          {/* List of existing competencies */}
          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">
              Competências Cadastradas ({competencias.length})
            </h3>
            <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border bg-card">
              {competencias.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground text-center">Nenhuma competência cadastrada.</p>
              ) : (
                competencias.map((c) => (
                  <div key={c.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <strong className="text-foreground">{c.competencia}</strong>
                      <p className="text-[10px] text-muted-foreground">
                        Início: {c.data_inicio} | Fim: {c.data_fim}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.encerrada ? "bg-muted text-muted-foreground" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
                      {c.encerrada ? "Encerrada" : "Ativa"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-border bg-card/40">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-xl border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
