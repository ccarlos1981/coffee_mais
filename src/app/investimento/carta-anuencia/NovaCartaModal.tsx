"use client";

import React, { useState, useEffect } from "react";
import { X, FilePlus, Building2, Calendar, AlertCircle, Upload, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { obterRedesMatrizes } from "@/app/investimento/lancar/actions";
import { gerarCartaAnuencia, obterCompetencias, CompetenciaItem, obterOuUploadLogoRede } from "./actions";

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
  const [logoUrl, setLogoUrl] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [searchingLogo, setSearchingLogo] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoadingInitial(true);
        const [redesData, compData] = await Promise.all([
          obterRedesMatrizes(),
          obterCompetencias(),
        ]);

        // Dedup redes por codigo/nome
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

  // Ao selecionar uma rede, buscar logo cadastrada automaticamente
  useEffect(() => {
    if (!selectedRedeCode) return;

    async function checkLogo() {
      setSearchingLogo(true);
      try {
        const logo = await obterOuUploadLogoRede(selectedRedeCode);
        if (logo?.logo_url) {
          setLogoUrl(logo.logo_url);
        }
      } catch (e) {
        console.error("Erro ao obter logo da rede:", e);
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

    const redeObj = redes.find((r) => r.codigo === selectedRedeCode || r.nome === selectedRedeCode);
    const redeNome = redeObj ? redeObj.nome : selectedRedeCode;
    const competenciaObj = competencias.find((c) => c.competencia === selectedCompetencia);

    setSubmitting(true);
    try {
      const novaCarta = await gerarCartaAnuencia({
        rede_id: selectedRedeCode,
        rede_nome: redeNome,
        cnpj,
        competencia_id: competenciaObj?.id,
        competencia: selectedCompetencia,
        valida_ate: validaAte || undefined,
        logo_url: logoUrl || undefined,
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
                  onChange={(e) => setSelectedRedeCode(e.target.value)}
                  required
                  className="w-full h-10 px-3 pr-8 rounded-xl border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="">-- Escolha uma Rede Cadastrada --</option>
                  {redes.map((r) => (
                    <option key={r.codigo} value={r.codigo}>
                      {r.nome} {r.uf ? `(${r.uf})` : ""} {r.canal ? `— ${r.canal}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Competência Selector */}
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
                  {competencias.map((c) => (
                    <option key={c.id} value={c.competencia}>
                      {c.competencia}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data Limite de Validade */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Válida Até (Opcional)
                </label>
                <input
                  type="date"
                  value={validaAte}
                  onChange={(e) => setValidaAte(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
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
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            {/* URL da Logo com busca automática */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-foreground">
                  URL da Logo da Rede
                </label>
                {searchingLogo && (
                  <span className="text-[10px] text-primary flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Buscando logo...
                  </span>
                )}
              </div>
              <input
                type="url"
                placeholder="https://exemplo.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                A logo será salva no cadastro mestre para reutilização em futuras cartas.
              </p>
            </div>

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

            {/* Informação sobre Unicidade & Versões */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Controle de Versão Automático:</strong> Caso a rede já possua uma carta ativa para a competência selecionada, o sistema incria automaticamente a versão (<code className="font-mono font-bold">versao++</code>) vinculando o histórico anterior.
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
