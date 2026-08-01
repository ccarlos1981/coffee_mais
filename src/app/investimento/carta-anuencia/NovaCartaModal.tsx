"use client";

import React, { useState, useEffect } from "react";
import { X, FilePlus, Building2, Calendar, AlertCircle, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { obterRedesMatrizes } from "@/app/investimento/lancar/actions";
import { gerarCartaAnuencia, obterCompetencias, CompetenciaItem, obterLogoOficialRede, processarEUploadLogoRede } from "./actions";
import { LogoUpload } from "./components/LogoUpload";
import { calcularValidadeCartaAnuencia, formatarDataValidade } from "./validade-helper";

interface NovaCartaModalProps {
  onClose: () => void;
  onSuccess: () => void;
  preselectedRede?: string;
  preselectedCompetencia?: string;
}

export function NovaCartaModal({ onClose, onSuccess, preselectedRede, preselectedCompetencia }: NovaCartaModalProps) {
  const [redes, setRedes] = useState<Array<{ codigo: string; nome: string; canal?: string; uf?: string }>>([]);
  const [competencias, setCompetencias] = useState<CompetenciaItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedRedeCode, setSelectedRedeCode] = useState(preselectedRede || "");
  const [selectedCompetencia, setSelectedCompetencia] = useState(preselectedCompetencia || "");
  const [cnpj, setCnpj] = useState("");
  const [validaAte, setValidaAte] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Logo State (Upload & Storage)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentStoragePath, setCurrentStoragePath] = useState<string | null>(null);
  const [searchingLogo, setSearchingLogo] = useState(false);

  // Auto-calcular a validade quando a competência muda
  useEffect(() => {
    if (selectedCompetencia) {
      const v = calcularValidadeCartaAnuencia(selectedCompetencia);
      setValidaAte(v || "");
    } else {
      setValidaAte("");
    }
  }, [selectedCompetencia]);

  useEffect(() => {
    async function loadData() {
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

        if (compData.length > 0 && !preselectedCompetencia) {
          setSelectedCompetencia(compData[0].competencia);
        }

        if (preselectedRede) {
          setSelectedRedeCode(preselectedRede);
        }
      } catch (err) {
        console.error("Erro ao carregar dados iniciais para Nova Carta:", err);
        toast.error("Erro ao carregar redes ou competências.");
      } finally {
        setLoadingInitial(false);
      }
    }

    loadData();
  }, [preselectedRede, preselectedCompetencia]);

  // Ao selecionar uma rede, buscar a logo oficial cadastrada em cm_logos_redes
  useEffect(() => {
    if (!selectedRedeCode) {
      setCurrentStoragePath(null);
      return;
    }

    async function checkLogo() {
      setSearchingLogo(true);
      try {
        const logoRecord = await obterLogoOficialRede(selectedRedeCode);
        if (logoRecord?.storage_path) {
          setCurrentStoragePath(logoRecord.storage_path);
        } else {
          setCurrentStoragePath(null);
        }
      } catch (e) {
        console.error("Erro ao obter logo oficial da rede:", e);
      } finally {
        setSearchingLogo(false);
      }
    }

    checkLogo();
  }, [selectedRedeCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRedeCode) {
      toast.error("Por favor, selecione a Rede.");
      return;
    }
    if (!selectedCompetencia) {
      toast.error("Por favor, selecione a Competência.");
      return;
    }

    // A rede precisa de uma logo (arquivo novo selecionado ou logo mestre existente)
    if (!selectedFile && !currentStoragePath) {
      toast.error("A logo da rede é obrigatória. Por favor, faça o upload de uma imagem.");
      return;
    }

    const redeObj = redes.find((r) => r.codigo === selectedRedeCode || r.nome === selectedRedeCode);
    const redeNome = redeObj ? redeObj.nome : selectedRedeCode;
    const competenciaObj = competencias.find((c) => c.competencia === selectedCompetencia);

    setSubmitting(true);
    try {
      let finalStoragePath = currentStoragePath || "";

      // Se houver arquivo novo selecionado, o envio, hashing, validação e storage são processados no Server Action
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("rede_id", selectedRedeCode);

        const resUpload = await processarEUploadLogoRede(formData);
        finalStoragePath = resUpload.storage_path;
      }

      const novaCarta = await gerarCartaAnuencia({
        rede_id: selectedRedeCode,
        rede_nome: redeNome,
        cnpj,
        competencia_id: competenciaObj?.id,
        competencia: selectedCompetencia,
        validade_ate: validaAte || undefined,
        storage_path: finalStoragePath,
        observacoes,
      });

      if (novaCarta.versao > 1) {
        toast.success(`Carta de Anuência N° ${novaCarta.numero_carta} gerada com sucesso! (Nova via Versão v${novaCarta.versao})`);
      } else {
        toast.success(`Carta de Anuência N° ${novaCarta.numero_carta} emitida com sucesso!`);
      }

      onSuccess();
    } catch (err: any) {
      console.error("Erro ao gerar carta:", err);
      toast.error(err.message || "Erro ao emitir Carta de Anuência.");
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
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Emitir Nova Carta de Anuência
              </h2>
              <p className="text-xs text-muted-foreground">
                Termo de Quitação Financeira Corporativa Coffee++
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

        {/* Form Body */}
        {loadingInitial ? (
          <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">
              Carregando Cadastro Mestre de Redes e Competências...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            
            {/* Rede Selector */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Selecione a Rede / Cliente <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedRedeCode}
                  onChange={(e) => {
                    setSelectedRedeCode(e.target.value);
                    setSelectedFile(null);
                  }}
                  required
                  className="w-full h-10 px-3 pr-8 rounded-xl border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="">-- Escolha uma Rede Cadastrada --</option>
                  {redes.map((r, idx) => (
                    <option key={`${r.codigo}-${r.nome}-${idx}`} value={r.codigo}>
                      {r.nome} {r.uf ? `(${r.uf})` : ""} {r.canal ? `— ${r.canal}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Competência Selector & Validade Automática */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Competência <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedCompetencia}
                  onChange={(e) => setSelectedCompetencia(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="">-- Selecione --</option>
                  {competencias.map((c, idx) => (
                    <option key={`${c.id}-${c.competencia}-${idx}`} value={c.competencia}>
                      {c.competencia}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data Limite de Validade (Cálculo Automático) */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Validade da Quitação (Automática)
                </label>
                <div className="h-10 px-3 rounded-xl border border-input bg-muted/40 text-sm text-foreground flex items-center font-mono font-semibold">
                  {validaAte ? formatarDataValidade(validaAte) : "— Selecione a Competência —"}
                </div>
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
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            {/* Componente de Upload de Logo (Sem URL textual) */}
            <LogoUpload
              currentStoragePath={currentStoragePath}
              selectedFile={selectedFile}
              onFileSelect={(file) => setSelectedFile(file)}
              disabled={submitting || searchingLogo}
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
                className="w-full p-3 rounded-xl border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            {/* Informação sobre Processamento Seguro no Backend & Snapshot */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Processamento Seguro Server-Side:</strong> A validação definitiva, o cálculo de hash SHA-256 e a gravação de metadados ocorrem 100% no backend. A carta gerada vincula um snapshot imutável da logo.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando Carta...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Emitir Carta de Anuência
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
