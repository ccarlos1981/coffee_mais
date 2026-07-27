"use client";

import React, { useState, useEffect } from "react";
import { X, Edit, Building2, Calendar, AlertCircle, Check, Loader2, Lock, Sparkles, FilePlus } from "lucide-react";
import { toast } from "sonner";
import { obterRedesMatrizes } from "@/app/investimento/lancar/actions";
import { CartaAnuenciaItem, editarCartaAnuencia, obterCompetencias, CompetenciaItem, obterLogoOficialRede, processarEUploadLogoRede } from "./actions";
import { LogoUpload } from "./components/LogoUpload";

interface EditarCartaModalProps {
  carta: CartaAnuenciaItem | null;
  onClose: () => void;
  onSuccess: () => void;
  onEmitirNovaVersao?: (redeCode: string, competencia: string) => void;
}

export function EditarCartaModal({ carta, onClose, onSuccess, onEmitirNovaVersao }: EditarCartaModalProps) {
  const [redes, setRedes] = useState<Array<{ codigo: string; nome: string; canal?: string; uf?: string }>>([]);
  const [competencias, setCompetencias] = useState<CompetenciaItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedRedeCode, setSelectedRedeCode] = useState("");
  const [selectedCompetencia, setSelectedCompetencia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [validaAte, setValidaAte] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Logo State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentStoragePath, setCurrentStoragePath] = useState<string | null>(null);

  const isBloqueada = carta ? (carta.status === "ASSINADA" || carta.status === "CANCELADA") : false;

  useEffect(() => {
    if (!carta) return;

    async function loadData() {
      const c = carta;
      if (!c) return;

      try {
        setLoadingInitial(true);
        const [redesData, compData] = await Promise.all([
          obterRedesMatrizes(),
          obterCompetencias(),
        ]);

        const uniqueMap = new Map<string, { codigo: string; nome: string; canal?: string; uf?: string }>();
        (redesData || []).forEach((r) => {
          const key = r.codigo || r.nome;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, {
              codigo: r.codigo || r.nome,
              nome: r.nome,
              canal: r.canal,
              uf: r.uf,
            });
          }
        });

        const redesList = Array.from(uniqueMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
        setRedes(redesList);
        setCompetencias(compData);

        // Preencher estado inicial
        setSelectedRedeCode(c.rede_id);
        setSelectedCompetencia(c.competencia);
        setCnpj(c.cnpj || "");
        setValidaAte(c.valida_ate ? c.valida_ate.substring(0, 10) : "");
        setObservacoes(c.observacoes || "");
        setCurrentStoragePath(c.logo_snapshot_path || c.logo_rede_url || null);
      } catch (err) {
        console.error("Erro ao carregar dados para edição:", err);
        toast.error("Erro ao carregar dados da carta.");
      } finally {
        setLoadingInitial(false);
      }
    }

    loadData();
  }, [carta]);

  if (!carta) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isBloqueada) {
      toast.error(`Documentos com status ${carta.status} não podem ser editados. Emita uma nova versão.`);
      return;
    }

    if (!selectedRedeCode || !selectedCompetencia) {
      toast.error("Por favor, selecione a Rede e a Competência.");
      return;
    }

    const redeObj = redes.find((r) => r.codigo === selectedRedeCode || r.nome === selectedRedeCode);
    const redeNome = redeObj ? redeObj.nome : carta.rede_nome;
    const competenciaObj = competencias.find((c) => c.competencia === selectedCompetencia);

    setSubmitting(true);
    try {
      let finalStoragePath = currentStoragePath || "";

      // Se o usuário selecionou uma nova logo, ela é processada 100% no servidor
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("rede_id", selectedRedeCode);

        const resUpload = await processarEUploadLogoRede(formData);
        finalStoragePath = resUpload.storage_path;
      }

      await editarCartaAnuencia({
        carta_id: carta.id,
        rede_id: selectedRedeCode,
        rede_nome: redeNome,
        cnpj,
        competencia_id: competenciaObj?.id || carta.competencia_id || undefined,
        competencia: selectedCompetencia,
        valida_ate: validaAte || undefined,
        storage_path: finalStoragePath,
        observacoes,
      });

      toast.success(`Carta N° ${carta.numero_carta} atualizada com sucesso! Registro salvo na auditoria.`);
      onSuccess();
    } catch (err: any) {
      console.error("Erro ao editar carta:", err);
      toast.error(err.message || "Falha ao atualizar Carta de Anuência.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Edit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                Editar Carta N° {carta.numero_carta}
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-primary/10 text-primary border border-primary/20">
                  v{carta.versao}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {carta.rede_nome} — Competência: {carta.competencia}
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

        {/* Informational Banner if Blocked */}
        {isBloqueada && (
          <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
            <Lock className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-2 flex-1">
              <p className="font-bold">
                Documento Oficial {carta.status}. Edição Física Bloqueada.
              </p>
              <p className="text-[11px] leading-relaxed">
                Cartas com status <strong>{carta.status}</strong> não podem ter seus dados alterados para garantir a integridade e auditoria legal. Caso necessite de alterações, emita uma nova versão do documento.
              </p>

              {onEmitirNovaVersao && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEmitirNovaVersao(carta.rede_id, carta.competencia);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] inline-flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <FilePlus className="w-3.5 h-3.5" />
                  Emitir Nova Versão (v{carta.versao + 1})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Form Body */}
        {loadingInitial ? (
          <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">
              Carregando dados da Carta de Anuência...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            
            {/* Rede Selector */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Rede / Cliente <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedRedeCode}
                onChange={(e) => setSelectedRedeCode(e.target.value)}
                disabled={isBloqueada}
                required
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">-- Escolha uma Rede Cadastrada --</option>
                {redes.map((r, idx) => (
                  <option key={`${r.codigo}-${r.nome}-${idx}`} value={r.codigo}>
                    {r.nome} {r.uf ? `(${r.uf})` : ""} {r.canal ? `— ${r.canal}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Competência & Validade */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Competência <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedCompetencia}
                  onChange={(e) => setSelectedCompetencia(e.target.value)}
                  disabled={isBloqueada}
                  required
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">-- Selecione --</option>
                  {competencias.map((c, idx) => (
                    <option key={`${c.id}-${c.competencia}-${idx}`} value={c.competencia}>
                      {c.competencia}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Válida Até (Opcional)
                </label>
                <input
                  type="date"
                  value={validaAte}
                  onChange={(e) => setValidaAte(e.target.value)}
                  disabled={isBloqueada}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* CNPJ */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                CNPJ da Rede (Opcional)
              </label>
              <input
                type="text"
                placeholder="ex: 00.000.000/0001-00"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                disabled={isBloqueada}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {/* Componente de Upload de Logo (Sem URL textual) */}
            <LogoUpload
              currentStoragePath={currentStoragePath}
              selectedFile={selectedFile}
              onFileSelect={(file) => setSelectedFile(file)}
              disabled={isBloqueada || submitting}
            />

            {/* Observações */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Observações Adicionais
              </label>
              <textarea
                rows={2}
                placeholder="Texto ou ressalvas contratuais opcionais..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                disabled={isBloqueada}
                className="w-full p-3 rounded-xl border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                {isBloqueada ? "Fechar" : "Cancelar"}
              </button>

              {!isBloqueada && (
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Salvar Alterações
                    </>
                  )}
                </button>
              )}
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
