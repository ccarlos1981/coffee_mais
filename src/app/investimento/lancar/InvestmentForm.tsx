"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Calendar, Save, CheckCircle2, ChevronDown, DollarSign, Package, Lock, Unlock, AlertTriangle, Check } from "lucide-react";
import Link from "next/link";
import { criarAcaoInvestimento, atualizarAcaoInvestimento } from "./actions";
import { MultiSelect } from "@/components/MultiSelect";
import { LaunchInvestmentAdvisor } from "./LaunchInvestmentAdvisor";
import { cleanMatrixCode } from "@/lib/utils/excel-import";

interface InvestmentFormProps {
  redes: Array<{ codigo: string; nome: string; canal: string; uf?: string | null; regional?: string | null; gerente?: string | null }>;
  familias: string[];
  skus?: string[];
  initialData?: any;
}

export function InvestmentForm({ redes: rawRedes, familias, skus, initialData }: InvestmentFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const isPlanejamento = initialData 
    ? !!initialData.is_planejamento 
    : searchParams.get("planejamento") === "true";
  
  const isLocked = initialData && (initialData.fase_atual || 1) >= 5 && !initialData.is_reopened;
  
  const redes = useMemo<Array<{ codigo: string; nome: string; canal: string; uf?: string | null; regional?: string | null; gerente?: string | null; displayCode: string }>>(() => {
    const baseCounts: Record<string, number> = {};
    rawRedes.forEach(r => {
      const base = cleanMatrixCode(r.codigo).split(".")[0];
      baseCounts[base] = (baseCounts[base] || 0) + 1;
    });

    const runningIndices: Record<string, number> = {};
    return rawRedes.map(r => {
      const base = cleanMatrixCode(r.codigo).split(".")[0];
      const total = baseCounts[base] || 0;
      const displayCode = total > 1
        ? `${base}.${runningIndices[base] = (runningIndices[base] || 0) + 1}`
        : cleanMatrixCode(r.codigo);
      return {
        ...r,
        displayCode
      };
    });
  }, [rawRedes]);

  // Find initial network object if editing
  const initRedeObj = useMemo(() => {
    if (!initialData) return null;
    const initialCodigo = initialData.codigo_matriz ? cleanMatrixCode(initialData.codigo_matriz) : null;
    const initialRedeName = initialData.rede ? initialData.rede.trim().toLowerCase() : null;

    if (initialCodigo && initialRedeName) {
      const exactMatch = redes.find(r => 
        (cleanMatrixCode(r.codigo) === initialCodigo || r.codigo === initialData.codigo_matriz) &&
        r.nome.trim().toLowerCase() === initialRedeName
      );
      if (exactMatch) return exactMatch;
    }

    if (initialCodigo) {
      const codeMatch = redes.find(r => cleanMatrixCode(r.codigo) === initialCodigo || r.codigo === initialData.codigo_matriz);
      if (codeMatch) return codeMatch;
    }

    if (initialRedeName) {
      const nameMatch = redes.find(r => r.nome.trim().toLowerCase() === initialRedeName);
      if (nameMatch) return nameMatch;
    }

    return null;
  }, [initialData, redes]);

  // Combobox state for Matriz
  const [searchRede, setSearchRede] = useState("");
  const [isRedeOpen, setIsRedeOpen] = useState(false);
  const [selectedRede, setSelectedRede] = useState<{ codigo: string; nome: string; canal: string; displayCode?: string; gerente?: string | null; uf?: string | null } | null>(
    initRedeObj || (initialData?.rede ? { codigo: initialData.codigo_matriz || "", nome: initialData.rede, canal: "Outros" } : null)
  );
  const [paymentDisabled, setPaymentDisabled] = useState(false);
  const [globalStart, setGlobalStart] = useState<string>(initialData?.data_inicio || "");
  const [globalEnd, setGlobalEnd] = useState<string>(initialData?.data_fim || "");
  const [dateMode, setDateMode] = useState<"single" | "multiple">(initialData?.date_mode || "single");
  const [mesReferencia, setMesReferencia] = useState<string>(
    initialData?.mes_referencia || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
  );

  useEffect(() => {
    if (!selectedRede) {
      setPaymentDisabled(false);
      return;
    }

    const checkPaymentCondition = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        
        const cleanCode = cleanMatrixCode(selectedRede.codigo);
        const { data: clients } = await supabase
          .from("cm_clientes")
          .select("condicao_pagamento")
          .or(`codigo_matriz.eq.${cleanCode},codigo_matriz.eq.${cleanCode}.0,codigo_matriz.eq.${selectedRede.codigo},codigo.eq.${parseInt(cleanCode, 10) || 0}`)
          .not("condicao_pagamento", "is", null)
          .limit(1);

        if (clients && clients.length > 0 && clients[0].condicao_pagamento) {
          const cond = clients[0].condicao_pagamento.trim().toLowerCase();
          if (cond.includes("boleto")) {
            setTipoPagamento("Boleto");
            setPaymentDisabled(true);
          } else if (cond.includes("transf") || cond.includes("ted") || cond.includes("banc")) {
            setTipoPagamento("Transf. Bancária");
            setPaymentDisabled(true);
          } else if (cond.includes("bonif")) {
            setTipoPagamento("Bonificação");
            setPaymentDisabled(true);
          } else {
            setPaymentDisabled(false);
          }
        } else {
          setPaymentDisabled(false);
        }
      } catch (err) {
        console.error("Erro ao buscar condição de pagamento do cliente:", err);
      }
    };

    checkPaymentCondition();
  }, [selectedRede]);

  const filteredRedes = useMemo(() => {
    if (!searchRede.trim()) return redes;
    const s = searchRede.toLowerCase().trim();
    return redes.filter(r => 
      r.nome.toLowerCase().includes(s) ||
      r.codigo.toLowerCase().includes(s) ||
      r.displayCode.toLowerCase().includes(s) ||
      (r.uf && r.uf.toLowerCase().includes(s)) ||
      (r.gerente && r.gerente.toLowerCase().includes(s)) ||
      (r.regional && r.regional.toLowerCase().includes(s))
    );
  }, [redes, searchRede]);

  // Helpers
  const formatCurrencyValue = (num: number) => {
    const formatted = num.toFixed(2).replace(".", ",").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    return "R$ " + formatted;
  };

  // Currency masking helper
  const maskCurrency = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    const numValue = (parseInt(digits, 10) / 100).toFixed(2);
    const formatted = numValue.replace(".", ",").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    return "R$ " + formatted;
  };

  const maskVolume = (raw: string) => {
    let value = raw.replace(/[^0-9,]/g, "");
    const parts = value.split(",");
    if (parts.length > 2) value = parts[0] + "," + parts.slice(1).join("");
    return value;
  };

  const parseNumericValue = (str: string) => {
    if (!str) return 0;
    let v = str.replace(/[R\$\s]/g, "");
    if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(v);
    return isNaN(num) ? 0 : num;
  };

  // Helper to generate familia_id from name
  const toFamiliaId = (nome: string) => nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');

  // Override lock state: tracks which items have manual investimento overrides
  const [overrideLocks, setOverrideLocks] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    if (initialData?.familias_detalhes) {
      initialData.familias_detalhes.forEach((f: any) => {
        if (f.investimento_manual) init[`fam_${f.familia_nome}`] = true;
      });
    }
    if (initialData?.skus_detalhes) {
      initialData.skus_detalhes.forEach((s: any) => {
        if (s.investimento_manual) init[`sku_${s.sku}`] = true;
      });
    }
    return init;
  });



  // Auto-compute investimento = preco_flat - preco_acao when locked
  const computeInvestimento = (flat: string, acao: string) => {
    const flatVal = parseNumericValue(flat);
    const acaoVal = parseNumericValue(acao);
    if (flatVal > 0 && acaoVal > 0) {
      const inv = flatVal - acaoVal;
      return inv >= 0 ? formatCurrencyValue(inv) : "";
    }
    return "";
  };

  // Check preco_acao <= preco_flat validation
  const getPrecoError = (details: any) => {
    if (!details?.preco_flat || !details?.preco_acao) return null;
    const flat = parseNumericValue(details.preco_flat);
    const acao = parseNumericValue(details.preco_acao);
    if (flat > 0 && acao > 0 && acao > flat) return "Preço Ação não pode ser maior que Preço Flat";
    return null;
  };

  const getDescontoAlerta = (details: any) => {
    if (!details?.preco_flat || !details?.preco_acao) return null;
    const flat = parseNumericValue(details.preco_flat);
    const acao = parseNumericValue(details.preco_acao);
    if (flat > 0 && acao < flat) {
      const desc = (flat - acao) / flat;
      if (desc > 0.10) {
        return `Atenção: Desconto de ${(desc * 100).toFixed(0)}% ultrapassa o limite institucional de 10%.`;
      }
    }
    return null;
  };

  // Multi-Família state (always cards, like SKUs)
  const [selectedFamilias, setSelectedFamilias] = useState<string[]>(
    initialData?.familias_detalhes && initialData.familias_detalhes.length > 0
      ? initialData.familias_detalhes.map((f: any) => f.familia_nome)
      : initialData?.familia_produto ? [initialData.familia_produto] : []
  );
  const [familiaDetails, setFamiliaDetails] = useState<Record<string, any>>(() => {
    const init: any = {};
    if (initialData?.familias_detalhes && initialData.familias_detalhes.length > 0) {
      initialData.familias_detalhes.forEach((f: any) => {
        init[f.familia_nome] = {
          preco_flat: f.preco_flat ? formatCurrencyValue(f.preco_flat) : "",
          preco_acao: f.preco_acao ? formatCurrencyValue(f.preco_acao) : "",
          investimento: f.investimento ? formatCurrencyValue(f.investimento) : "",
          expectativa_volume: f.expectativa_volume ? f.expectativa_volume.toString().replace(".", ",") : "",
          investimento_justificativa: f.investimento_justificativa || "",
          start_date: f.start_date || "",
          end_date: f.end_date || ""
        };
      });
    } else if (initialData?.familia_produto) {
      init[initialData.familia_produto] = {
        preco_flat: initialData.preco_flat ? formatCurrencyValue(initialData.preco_flat) : "",
        preco_acao: initialData.preco_acao ? formatCurrencyValue(initialData.preco_acao) : "",
        investimento: initialData.valor_investimento ? formatCurrencyValue(initialData.valor_investimento) : "",
        expectativa_volume: initialData.expectativa_volume ? initialData.expectativa_volume.toString().replace(".", ",") : "",
        investimento_justificativa: "",
        start_date: initialData.data_inicio || "",
        end_date: initialData.data_fim || ""
      };
    }
    return init;
  });

  const handleFamiliaChange = (familia: string, field: string, value: string, isNumericText = false) => {
    const lockKey = `fam_${familia}`;
    const isOverridden = overrideLocks[lockKey];

    let finalValue = value;
    if (isNumericText) {
      finalValue = value.replace(/[^0-9,]/g, "");
      const parts = finalValue.split(",");
      if (parts.length > 2) finalValue = parts[0] + "," + parts.slice(1).join("");
    } else if (field !== "investimento_justificativa" && field !== "start_date" && field !== "end_date") {
      const v = value.replace(/\D/g, "");
      if (!v) { finalValue = ""; } else {
        const numValue = (parseInt(v, 10) / 100).toFixed(2);
        finalValue = "R$ " + numValue.replace(".", ",").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
      }
    }

    if (field === "investimento") {
      setOverrideLocks(prev => ({ ...prev, [lockKey]: true }));
    }

    setFamiliaDetails(prev => {
      const updated = { ...prev, [familia]: { ...(prev[familia] || {}), [field]: finalValue } };
      // Auto-calc investimento when locked (not overridden)
      if (!isOverridden && (field === "preco_flat" || field === "preco_acao")) {
        const flat = field === "preco_flat" ? finalValue : (updated[familia]?.preco_flat || "");
        const acao = field === "preco_acao" ? finalValue : (updated[familia]?.preco_acao || "");
        updated[familia].investimento = computeInvestimento(flat, acao);
      }
      return updated;
    });
  };

  // Toggles and SKU states
  const [tipoPagamento, setTipoPagamento] = useState<string>(initialData?.tipo_pagamento || "Transf. Bancária");
  const [tipoAcaoDetalhe, setTipoAcaoDetalhe] = useState<string>(initialData?.tipo_acao_detalhe || "Ação de Vendas");
  const [abrangenciaUi, setAbrangenciaUi] = useState<"Família" | "SKU" | "Misto">(() => {
    if (initialData?.abrangencia) {
      return initialData.abrangencia as any;
    }
    if (initialData?.familias_detalhes && initialData.familias_detalhes.length > 0 && initialData?.skus_detalhes && initialData.skus_detalhes.length > 0) {
      return "Misto";
    }
    if (initialData?.skus_detalhes && initialData.skus_detalhes.length > 0) {
      return "SKU";
    }
    return "Família";
  });
  const showFamilias = abrangenciaUi === "Família" || abrangenciaUi === "Misto";
  const showSkus = abrangenciaUi === "SKU" || abrangenciaUi === "Misto";
  
  const [selectedSkus, setSelectedSkus] = useState<string[]>(
    initialData?.skus_detalhes ? initialData.skus_detalhes.map((s:any) => s.sku) : []
  );
  
  const [skuDetails, setSkuDetails] = useState<Record<string, any>>(() => {
    const init: any = {};
    if (initialData?.skus_detalhes) {
      initialData.skus_detalhes.forEach((s: any) => {
        init[s.sku] = {
          preco_flat: s.preco_flat ? formatCurrencyValue(s.preco_flat) : "",
          preco_acao: s.preco_acao ? formatCurrencyValue(s.preco_acao) : "",
          investimento: s.investimento ? formatCurrencyValue(s.investimento) : "",
          expectativa_volume: s.expectativa_volume ? s.expectativa_volume.toString().replace(".", ",") : "",
          investimento_justificativa: s.investimento_justificativa || "",
          start_date: s.start_date || "",
          end_date: s.end_date || ""
        };
      });
    }
    return init;
  });

  const handleSkuChange = (sku: string, field: string, value: string, isNumericText = false) => {
    const lockKey = `sku_${sku}`;
    const isOverridden = overrideLocks[lockKey];

    let finalValue = value;
    if (isNumericText) {
      finalValue = value.replace(/[^0-9,]/g, "");
      const parts = finalValue.split(",");
      if (parts.length > 2) finalValue = parts[0] + "," + parts.slice(1).join("");
    } else if (field !== "investimento_justificativa" && field !== "start_date" && field !== "end_date") {
      const v = value.replace(/\D/g, "");
      if (!v) { finalValue = ""; } else {
        const numValue = (parseInt(v, 10) / 100).toFixed(2);
        finalValue = "R$ " + numValue.replace(".", ",").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
      }
    }

    if (field === "investimento") {
      setOverrideLocks(prev => ({ ...prev, [lockKey]: true }));
    }

    setSkuDetails(prev => {
      const updated = { ...prev, [sku]: { ...(prev[sku] || {}), [field]: finalValue } };
      if (!isOverridden && (field === "preco_flat" || field === "preco_acao")) {
        const flat = field === "preco_flat" ? finalValue : (updated[sku]?.preco_flat || "");
        const acao = field === "preco_acao" ? finalValue : (updated[sku]?.preco_acao || "");
        updated[sku].investimento = computeInvestimento(flat, acao);
      }
      return updated;
    });
  };

  const handleDateModeChange = (newMode: "single" | "multiple") => {
    if (newMode === "multiple") {
      // Replicate global dates to all selected families and SKUs
      setFamiliaDetails(prev => {
        const updated = { ...prev };
        selectedFamilias.forEach(fam => {
          if (!updated[fam]) updated[fam] = {};
          updated[fam] = {
            ...updated[fam],
            start_date: updated[fam].start_date || globalStart,
            end_date: updated[fam].end_date || globalEnd
          };
        });
        return updated;
      });
      setSkuDetails(prev => {
        const updated = { ...prev };
        selectedSkus.forEach(sku => {
          if (!updated[sku]) updated[sku] = {};
          updated[sku] = {
            ...updated[sku],
            start_date: updated[sku].start_date || globalStart,
            end_date: updated[sku].end_date || globalEnd
          };
        });
        return updated;
      });
      setDateMode("multiple");
    } else {
      const confirmTransition = window.confirm(
        "Alterar para Data Única irá sobrescrever as datas individuais de todos os itens pelas datas globais da ação. Deseja continuar?"
      );
      if (confirmTransition) {
        setDateMode("single");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    
    if (!selectedRede) {
      setError("Por favor, selecione uma matriz.");
      return;
    }

    const mes_referencia = new FormData(e.currentTarget).get("mes_referencia") as string;
    if (!mes_referencia) {
      setError("Por favor, selecione o mês de referência.");
      return;
    }

    if (!showFamilias && !showSkus) {
      setError("Por favor, selecione ao menos uma abrangência (Família ou SKU).");
      return;
    }

    if (showFamilias && selectedFamilias.length === 0) {
      setError("Por favor, selecione ao menos uma família.");
      return;
    }

    if (showSkus && selectedSkus.length === 0) {
      setError("Por favor, selecione ao menos um SKU.");
      return;
    }

    // Validate preco_acao <= preco_flat and override justificativa
    const items: Array<{ name: string; details: any; lockKey: string }> = [];
    if (showFamilias) {
      selectedFamilias.forEach(f => {
        items.push({ name: `Família ${f}`, details: familiaDetails[f], lockKey: `fam_${f}` });
      });
    }
    if (showSkus) {
      selectedSkus.forEach(s => {
        items.push({ name: `SKU ${s}`, details: skuDetails[s], lockKey: `sku_${s}` });
      });
    }

    for (const item of items) {
      const err = getPrecoError(item.details);
      if (err) {
        setError(`${item.name}: ${err}`);
        return;
      }

    }

    let calculatedStart = globalStart;
    let calculatedEnd = globalEnd;

    if (dateMode === "multiple") {
      const dates: string[] = [];
      if (showFamilias) {
        selectedFamilias.forEach(fam => {
          const d = familiaDetails[fam] || {};
          if (d.start_date) dates.push(d.start_date);
          if (d.end_date) dates.push(d.end_date);
        });
      }
      if (showSkus) {
        selectedSkus.forEach(sku => {
          const d = skuDetails[sku] || {};
          if (d.start_date) dates.push(d.start_date);
          if (d.end_date) dates.push(d.end_date);
        });
      }
      if (dates.length > 0) {
        const sorted = [...dates].sort();
        calculatedStart = sorted[0];
        calculatedEnd = sorted[sorted.length - 1];
      }
    }

    const calculatedAbrangencia = (showFamilias && showSkus) ? "Misto" : showFamilias ? "Família" : "SKU";

    const formData = new FormData(e.currentTarget);
    formData.append("rede", selectedRede.nome);
    formData.append("codigo_matriz", selectedRede.codigo);
    if (selectedRede.gerente) formData.append("gerente", selectedRede.gerente);
    if (selectedRede.uf) formData.append("uf", selectedRede.uf);
    formData.append("tipo_pagamento", tipoPagamento);
    formData.append("tipo_acao_detalhe", tipoAcaoDetalhe);
    formData.append("abrangencia", calculatedAbrangencia);
    formData.set("data_inicio", calculatedStart);
    formData.set("data_fim", calculatedEnd);
    formData.append("date_mode", dateMode);

    const parseVal = (str: string) => {
      if (!str) return null;
      let v = str.replace(/[R\$\s]/g, "");
      if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
      return parseFloat(v);
    };

    const now = new Date().toISOString();

    if (showFamilias) {
      const packedFamilias = selectedFamilias.map(fam => {
        const d = familiaDetails[fam] || {};
        const lockKey = `fam_${fam}`;
        const isManual = overrideLocks[lockKey] || false;
        return {
          familia_id: toFamiliaId(fam),
          familia_nome: fam,
          preco_flat: parseVal(d.preco_flat),
          preco_acao: parseVal(d.preco_acao),
          investimento: parseVal(d.investimento),
          expectativa_volume: parseVal(d.expectativa_volume),
          start_date: dateMode === 'multiple' ? (d.start_date || null) : globalStart,
          end_date: dateMode === 'multiple' ? (d.end_date || null) : globalEnd,
          ...(isManual ? {
            investimento_manual: true,
            investimento_justificativa: d.investimento_justificativa || "",
            investimento_override_by: null, // will be set server-side
            investimento_override_at: now
          } : {})
        };
      });
      formData.append("familias_detalhes", JSON.stringify(packedFamilias));
      formData.append("familia_produto", selectedFamilias.join(", "));
    } else {
      formData.append("familias_detalhes", "[]");
      formData.append("familia_produto", "");
    }

    if (showSkus) {
      const packedSkus = selectedSkus.map(sku => {
        const d = skuDetails[sku] || {};
        const lockKey = `sku_${sku}`;
        const isManual = overrideLocks[lockKey] || false;
        return {
          sku,
          preco_flat: parseVal(d.preco_flat),
          preco_acao: parseVal(d.preco_acao),
          investimento: parseVal(d.investimento),
          expectativa_volume: parseVal(d.expectativa_volume),
          start_date: dateMode === 'multiple' ? (d.start_date || null) : globalStart,
          end_date: dateMode === 'multiple' ? (d.end_date || null) : globalEnd,
          ...(isManual ? {
            investimento_manual: true,
            investimento_justificativa: d.investimento_justificativa || "",
            investimento_override_by: null,
            investimento_override_at: now
          } : {})
        };
      });
      formData.append("skus_detalhes", JSON.stringify(packedSkus));
    } else {
      formData.append("skus_detalhes", "[]");
    }

    formData.append("is_planejamento", isPlanejamento ? "true" : "false");

    startTransition(async () => {
      try {
        let result;
        if (initialData?.id) {
          result = await atualizarAcaoInvestimento(initialData.id, formData);
        } else {
          result = await criarAcaoInvestimento(formData);
        }
        
        if (result?.success) {
          router.refresh();
          if (result.data?.is_planejamento || (result as any).is_planejamento) {
            router.push("/investimento/planejamento");
          } else {
            const targetFase = initialData?.fase_atual || 1;
            router.push(`/investimento?fase=${targetFase}`);
          }
        } else if (result) {
          setError(result.message || "Ocorreu um erro ao salvar.");
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        setError(errMsg || "Ocorreu um erro ao salvar.");
      }
    });
  };

  const todayStr = new Date().toLocaleDateString('pt-BR');

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href={isPlanejamento ? "/investimento/planejamento" : "/investimento"} 
          className="p-2 rounded-xl bg-elevated border border-border text-muted hover:text-foreground hover:bg-border transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {initialData 
              ? (isPlanejamento ? "Editar Planejamento" : "Editar Investimento") 
              : (isPlanejamento ? "Lançar Planejamento" : "Lançar Investimento")}
          </h1>
          <p className="text-sm text-muted flex items-center gap-2 mt-1">
            <Calendar className="w-4 h-4" />
            Data do Registro: <span className="font-medium text-foreground">{todayStr}</span>
          </p>
        </div>
      </div>

      {isLocked && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-sm flex items-center gap-2">
          <Lock className="w-5 h-5 flex-shrink-0" />
          <span>Esta ação de investimento foi <strong>aprovada</strong> e está bloqueada para edições. Somente Diretores, CEO ou Admin podem reabrir a ação para alterações.</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-4 shadow-xl space-y-5">
        <fieldset disabled={isLocked} className="space-y-5 w-full">
        <div className="space-y-4">
          {/* Matriz */}
          <div className="space-y-2 relative z-50">
            <label className="block text-sm font-medium text-muted">Matriz</label>
            <div className="relative">
              <input 
                type="text"
                placeholder="Digite para buscar uma matriz..."
                className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-gold/50"
                value={isRedeOpen ? searchRede : (selectedRede ? `${selectedRede.displayCode || selectedRede.codigo} - ${selectedRede.nome}` : "")}
                onChange={(e) => {
                  setSearchRede(e.target.value);
                  if (!isRedeOpen) setIsRedeOpen(true);
                }}
                onFocus={() => setIsRedeOpen(true)}
                onBlur={() => setTimeout(() => setIsRedeOpen(false), 200)}
              />
              <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-muted pointer-events-none" />
            </div>

            {isRedeOpen && (
              <div className="absolute z-[999] w-full mt-1 max-h-60 overflow-auto bg-[var(--background-elevated)] border border-border rounded-xl shadow-2xl divide-y divide-border" style={{ backgroundColor: 'var(--background-elevated)' }}>
                {filteredRedes.length > 0 ? (
                  filteredRedes.map((r, idx) => (
                    <button
                      key={`${r.codigo}-${r.nome}-${r.gerente || ''}-${idx}`}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-gold/10 hover:text-gold transition-colors flex items-center justify-between"
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={() => {
                        setSelectedRede(r);
                        setSearchRede("");
                        setIsRedeOpen(false);
                      }}
                    >
                      <div>
                        <span className="font-semibold text-gold mr-2">{r.displayCode || r.codigo}</span>
                        <span>{r.nome}</span>
                        {(r.uf || r.regional || r.gerente) && (
                          <span className="text-[11px] text-muted ml-2">
                            ({[r.uf, r.regional, r.gerente].filter(Boolean).join(" - ")})
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted">({r.canal})</span>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted text-sm">Nenhuma matriz encontrada.</div>
                )}
              </div>
            )}
          </div>

          {/* Tipo da Ação */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Tipo da Ação</label>
            <div className="grid grid-cols-2 gap-3">
              <label className="relative flex items-center gap-3 cursor-pointer rounded-lg border border-border bg-elevated p-2.5 focus-within:ring-2 focus-within:ring-gold/50 hover:bg-border transition-colors">
                <input type="radio" name="tipo_acao" value="Sell Out" className="sr-only peer" required defaultChecked={initialData ? initialData.tipo_acao === "Sell Out" : true} />
                <div className="w-4 h-4 rounded-full border-2 border-foreground-muted peer-checked:border-[#C4A25D] peer-checked:bg-[#C4A25D] flex items-center justify-center transition-colors">
                  <div className="w-2 h-2 rounded-full bg-black opacity-0 peer-checked:opacity-100" />
                </div>
                <span className="font-medium text-foreground">Sell Out</span>
              </label>

              <label className="relative flex items-center gap-3 cursor-pointer rounded-lg border border-border bg-elevated p-2.5 focus-within:ring-2 focus-within:ring-gold/50 hover:bg-border transition-colors">
                <input type="radio" name="tipo_acao" value="Sell In" className="sr-only peer" required defaultChecked={initialData ? initialData.tipo_acao === "Sell In" : false} />
                <div className="w-4 h-4 rounded-full border-2 border-foreground-muted peer-checked:border-[#C4A25D] peer-checked:bg-[#C4A25D] flex items-center justify-center transition-colors">
                  <div className="w-2 h-2 rounded-full bg-black opacity-0 peer-checked:opacity-100" />
                </div>
                <span className="font-medium text-foreground">Sell In</span>
              </label>
            </div>
          </div>

          {/* Ação */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Ação</label>
            <div className="grid grid-cols-2 gap-3">
              {["Ação de Vendas", "Encarte", "Aniversário", "Ponto Extra"].map((opcao) => (
                <label key={opcao} className="relative flex items-center gap-3 cursor-pointer rounded-lg border border-border bg-elevated p-2.5 focus-within:ring-2 focus-within:ring-gold/50 hover:bg-border transition-colors">
                  <input
                    type="radio"
                    name="tipo_acao_detalhe_ui"
                    className="sr-only peer"
                    checked={tipoAcaoDetalhe === opcao}
                    onChange={() => setTipoAcaoDetalhe(opcao)}
                  />
                  <div className="w-4 h-4 rounded-full border-2 border-foreground-muted peer-checked:border-[#C4A25D] peer-checked:bg-[#C4A25D] flex items-center justify-center transition-colors">
                    <div className="w-2 h-2 rounded-full bg-black opacity-0 peer-checked:opacity-100" />
                  </div>
                  <span className="font-medium text-foreground text-sm">{opcao}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Pagamento */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Pagamento</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {["Transf. Bancária", "Boleto", "Bonificação"].map((opcao) => (
                <label 
                  key={opcao} 
                  className={`relative flex items-center gap-3 rounded-lg border border-border bg-elevated p-2.5 transition-colors ${
                    paymentDisabled 
                      ? 'opacity-60 cursor-not-allowed' 
                      : 'cursor-pointer focus-within:ring-2 focus-within:ring-gold/50 hover:bg-border'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="tipo_pagamento_ui" 
                    className="sr-only peer" 
                    checked={tipoPagamento === opcao}
                    onChange={() => !paymentDisabled && setTipoPagamento(opcao)}
                    disabled={paymentDisabled}
                  />
                  <div className="w-4 h-4 rounded-full border-2 border-foreground-muted peer-checked:border-[#C4A25D] peer-checked:bg-[#C4A25D] flex items-center justify-center transition-colors">
                    <div className="w-2 h-2 rounded-full bg-black opacity-0 peer-checked:opacity-100" />
                  </div>
                  <span className="font-medium text-foreground text-sm">{opcao}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* BLOCK 2: Datas e Mês de Referência */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Modo de Datas</label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`relative flex items-center gap-3 cursor-pointer rounded-lg border p-2.5 transition-colors focus-within:ring-2 focus-within:ring-gold/50 hover:bg-border/30 ${
                dateMode === "single" ? 'border-gold bg-gold/5 text-gold font-bold' : 'border-border bg-elevated text-foreground'
              } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input 
                  type="radio" 
                  name="date_mode_select" 
                  disabled={isLocked}
                  className="sr-only" 
                  checked={dateMode === "single"}
                  onChange={() => handleDateModeChange("single")}
                />
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  dateMode === "single" ? 'border-gold bg-gold' : 'border-foreground-muted'
                }`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-black" style={{ opacity: dateMode === "single" ? 1 : 0 }} />
                </div>
                <span className="text-sm font-medium">Data Única</span>
              </label>

              <label className={`relative flex items-center gap-3 cursor-pointer rounded-lg border p-2.5 transition-colors focus-within:ring-2 focus-within:ring-gold/50 hover:bg-border/30 ${
                dateMode === "multiple" ? 'border-gold bg-gold/5 text-gold font-bold' : 'border-border bg-elevated text-foreground'
              } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input 
                  type="radio" 
                  name="date_mode_select" 
                  disabled={isLocked}
                  className="sr-only" 
                  checked={dateMode === "multiple"}
                  onChange={() => handleDateModeChange("multiple")}
                />
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  dateMode === "multiple" ? 'border-gold bg-gold' : 'border-foreground-muted'
                }`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-black" style={{ opacity: dateMode === "multiple" ? 1 : 0 }} />
                </div>
                <span className="text-sm font-medium">Múltiplas Datas</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted">Mês de Referência</label>
              <input 
                type="month"
                name="mes_referencia"
                required
                value={mesReferencia}
                onChange={(e) => setMesReferencia(e.target.value)}
                onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 [color-scheme:dark] cursor-pointer"
              />
            </div>
            {dateMode === "single" && (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted">Data Início da Ação</label>
                  <input 
                    type="date"
                    name="data_inicio"
                    required={dateMode === "single"}
                    value={globalStart}
                    onChange={(e) => setGlobalStart(e.target.value)}
                    onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                    className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 [color-scheme:dark] cursor-pointer"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted">Data Fim da Ação</label>
                  <input 
                    type="date"
                    name="data_fim"
                    required={dateMode === "single"}
                    value={globalEnd}
                    onChange={(e) => setGlobalEnd(e.target.value)}
                    onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                    className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 [color-scheme:dark] cursor-pointer"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* BLOCK 3: Abrangência */}
        <div className="pt-4 border-t border-border space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Abrangência</label>
            <div className="grid grid-cols-3 gap-3">
              <label className={`relative flex items-center gap-3 cursor-pointer rounded-lg border p-2.5 transition-colors focus-within:ring-2 focus-within:ring-gold/50 hover:bg-border/30 ${
                abrangenciaUi === "Família" ? 'border-gold bg-gold/5 text-gold font-bold' : 'border-border bg-elevated text-foreground'
              } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input 
                  type="radio" 
                  name="abrangencia_ui" 
                  disabled={isLocked}
                  className="sr-only" 
                  checked={abrangenciaUi === "Família"}
                  onChange={() => setAbrangenciaUi("Família")}
                />
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  abrangenciaUi === "Família" ? 'border-gold bg-gold' : 'border-foreground-muted'
                }`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-black" style={{ opacity: abrangenciaUi === "Família" ? 1 : 0 }} />
                </div>
                <span className="text-sm">Família</span>
              </label>

              <label className={`relative flex items-center gap-3 cursor-pointer rounded-lg border p-2.5 transition-colors focus-within:ring-2 focus-within:ring-gold/50 hover:bg-border/30 ${
                abrangenciaUi === "SKU" ? 'border-gold bg-gold/5 text-gold font-bold' : 'border-border bg-elevated text-foreground'
              } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input 
                  type="radio" 
                  name="abrangencia_ui" 
                  disabled={isLocked}
                  className="sr-only" 
                  checked={abrangenciaUi === "SKU"}
                  onChange={() => setAbrangenciaUi("SKU")}
                />
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  abrangenciaUi === "SKU" ? 'border-gold bg-gold' : 'border-foreground-muted'
                }`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-black" style={{ opacity: abrangenciaUi === "SKU" ? 1 : 0 }} />
                </div>
                <span className="text-sm">SKU</span>
              </label>

              <label className={`relative flex items-center gap-3 cursor-pointer rounded-lg border p-2.5 transition-colors focus-within:ring-2 focus-within:ring-gold/50 hover:bg-border/30 ${
                abrangenciaUi === "Misto" ? 'border-gold bg-gold/5 text-gold font-bold' : 'border-border bg-elevated text-foreground'
              } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input 
                  type="radio" 
                  name="abrangencia_ui" 
                  disabled={isLocked}
                  className="sr-only" 
                  checked={abrangenciaUi === "Misto"}
                  onChange={() => setAbrangenciaUi("Misto")}
                />
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  abrangenciaUi === "Misto" ? 'border-gold bg-gold' : 'border-foreground-muted'
                }`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-black" style={{ opacity: abrangenciaUi === "Misto" ? 1 : 0 }} />
                </div>
                <span className="text-sm">Ambos</span>
              </label>
            </div>
          </div>

          {/* Seção Famílias */}
          {showFamilias && (
            <div className="space-y-6 animate-in fade-in relative z-40">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-muted">Seleção de Famílias</label>
                <div className="relative">
                  {isLocked ? (
                    <div className="flex flex-wrap gap-2 p-3 bg-elevated border border-border rounded-xl">
                      {selectedFamilias.map(f => (
                        <span key={f} className="px-2.5 py-1 bg-gold/15 text-gold font-semibold text-xs rounded-lg border border-gold/20">{f}</span>
                      ))}
                    </div>
                  ) : (
                    <MultiSelect
                      value={selectedFamilias}
                      onChange={setSelectedFamilias}
                      options={familias}
                      placeholder="Selecione as famílias"
                      className="w-full bg-elevated border border-border rounded-xl px-4 py-3 text-foreground"
                    />
                  )}
                </div>
              </div>

              {selectedFamilias.length > 0 && (
                <div className="space-y-4 pt-4">
                  <h3 className="text-sm font-bold text-foreground">Detalhes por Família</h3>
                  {selectedFamilias.map(familia => {
                    const lockKey = `fam_${familia}`;
                    const isOverridden = overrideLocks[lockKey];
                    const precoError = getPrecoError(familiaDetails[familia]);
                    return (
                      <div key={familia} className={`bg-background border ${precoError ? 'border-red-500/50' : 'border-border'} p-4 rounded-xl space-y-4`}>
                        <h4 className="font-bold text-gold">{familia}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <label className="block text-xs font-medium text-muted">Preço Flat</label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                              <input
                                type="text"
                                value={familiaDetails[familia]?.preco_flat || ""}
                                onChange={(e) => handleFamiliaChange(familia, "preco_flat", e.target.value)}
                                placeholder="R$ 0,00"
                                className="w-full bg-elevated border border-border rounded-lg py-2 pl-9 pr-3 text-foreground font-medium text-sm focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-xs font-medium text-muted">Preço Ação</label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                              <input
                                type="text"
                                value={familiaDetails[familia]?.preco_acao || ""}
                                onChange={(e) => handleFamiliaChange(familia, "preco_acao", e.target.value)}
                                placeholder="R$ 0,00"
                                className={`w-full bg-elevated border rounded-lg py-2 pl-9 pr-3 text-foreground font-medium text-sm focus:ring-1 transition-all ${precoError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50' : 'border-border focus:border-gold focus:ring-gold'}`}
                              />
                            </div>
                            {precoError && <p className="text-[10px] text-red-400 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{precoError}</p>}
                            {getDescontoAlerta(familiaDetails[familia]) && (
                              <div className="text-[11px] text-red-500 font-bold flex items-center gap-1.5 mt-1.5 p-2 rounded-lg bg-red-950/40 border border-red-500/40 text-[#DC2626]">
                                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                                <span>🔴 {getDescontoAlerta(familiaDetails[familia])}</span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="block text-xs font-medium text-muted">Investimento</label>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!isOverridden) {
                                    setOverrideLocks(prev => ({ ...prev, [lockKey]: true }));
                                  } else {
                                    setOverrideLocks(prev => ({ ...prev, [lockKey]: false }));
                                    setFamiliaDetails(prev => {
                                      const updated = { ...prev, [familia]: { ...(prev[familia] || {}), investimento_justificativa: "" } };
                                      updated[familia].investimento = computeInvestimento(updated[familia]?.preco_flat || "", updated[familia]?.preco_acao || "");
                                      return updated;
                                    });
                                  }
                                }}
                                className={`p-0.5 rounded transition-colors ${isOverridden ? 'text-amber-400 hover:text-amber-300' : 'text-muted hover:text-foreground'}`}
                                title={isOverridden ? "Voltar para cálculo automático (Preço Flat - Preço Ação)" : "Definido como automático (clique para fixar valor manual)"}
                              >
                                {isOverridden ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                              <input
                                type="text"
                                value={familiaDetails[familia]?.investimento || ""}
                                onChange={(e) => handleFamiliaChange(familia, "investimento", e.target.value)}
                                placeholder="R$ 0,00"
                                className="w-full bg-elevated border border-border rounded-lg py-2 pl-9 pr-3 font-medium text-sm transition-all focus:border-gold focus:ring-1 focus:ring-gold"
                              />
                              {!isOverridden && <span className="absolute right-2 top-2 text-[9px] text-muted font-medium bg-background px-1 rounded">AUTO</span>}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-xs font-medium text-muted">Exp. Vol.</label>
                            <div className="relative">
                              <Package className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                              <input
                                type="text"
                                value={familiaDetails[familia]?.expectativa_volume || ""}
                                onChange={(e) => handleFamiliaChange(familia, "expectativa_volume", e.target.value, true)}
                                placeholder="0"
                                className="w-full bg-elevated border border-border rounded-lg py-2 pl-9 pr-3 text-foreground font-medium text-sm focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                              />
                            </div>
                          </div>
                          {dateMode === "multiple" && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 col-span-1 sm:col-span-2 lg:col-span-4 border-t border-border/50 pt-3 mt-1">
                              <div className="space-y-2">
                                <label className="block text-xs font-medium text-muted">Data Início</label>
                                <input
                                  type="date"
                                  required={dateMode === "multiple"}
                                  value={familiaDetails[familia]?.start_date || ""}
                                  onChange={(e) => handleFamiliaChange(familia, "start_date", e.target.value)}
                                  onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-gold/50 [color-scheme:dark] cursor-pointer"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-xs font-medium text-muted">Data Fim</label>
                                <input
                                  type="date"
                                  required={dateMode === "multiple"}
                                  value={familiaDetails[familia]?.end_date || ""}
                                  onChange={(e) => handleFamiliaChange(familia, "end_date", e.target.value)}
                                  onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-gold/50 [color-scheme:dark] cursor-pointer"
                                />
                              </div>
                            </div>
                          )}
                          <div className="col-span-1 sm:col-span-2 lg:col-span-4 bg-gold/5 border border-gold/10 p-3 rounded-lg flex items-center justify-between mt-1">
                            <span className="text-xs font-bold text-gold">Custo Estimado ({familia})</span>
                            <span className="text-sm font-black text-gold">
                              {formatCurrencyValue(parseNumericValue(familiaDetails[familia]?.investimento || "") * parseNumericValue(familiaDetails[familia]?.expectativa_volume || ""))}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Seção SKUs */}
          {showSkus && (
            <div className="space-y-6 animate-in fade-in relative z-40 pt-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-muted">Seleção de SKUs</label>
                <div className="relative">
                  {isLocked ? (
                    <div className="flex flex-wrap gap-2 p-3 bg-elevated border border-border rounded-xl">
                      {selectedSkus.map(s => (
                        <span key={s} className="px-2.5 py-1 bg-gold/15 text-gold font-semibold text-xs rounded-lg border border-gold/20">{s}</span>
                      ))}
                    </div>
                  ) : (
                    <MultiSelect
                      value={selectedSkus}
                      onChange={setSelectedSkus}
                      options={skus || []}
                      placeholder="Selecione os SKUs"
                      className="w-full bg-elevated border border-border rounded-xl px-4 py-3 text-foreground"
                    />
                  )}
                </div>
              </div>

              {selectedSkus.length > 0 && (
                <div className="space-y-4 pt-4">
                  <h3 className="text-sm font-bold text-foreground">Detalhes por SKU</h3>
                  {selectedSkus.map(sku => {
                    const lockKey = `sku_${sku}`;
                    const isOverridden = overrideLocks[lockKey];
                    const precoError = getPrecoError(skuDetails[sku]);
                    return (
                      <div key={sku} className={`bg-background border ${precoError ? 'border-red-500/50' : 'border-border'} p-4 rounded-xl space-y-4`}>
                        <h4 className="font-bold text-gold">{sku}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <label className="block text-xs font-medium text-muted">Preço Flat</label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                              <input
                                type="text"
                                value={skuDetails[sku]?.preco_flat || ""}
                                onChange={(e) => handleSkuChange(sku, "preco_flat", e.target.value)}
                                placeholder="R$ 0,00"
                                className="w-full bg-elevated border border-border rounded-lg py-2 pl-9 pr-3 text-foreground font-medium text-sm focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-xs font-medium text-muted">Preço Ação</label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                              <input
                                type="text"
                                value={skuDetails[sku]?.preco_acao || ""}
                                onChange={(e) => handleSkuChange(sku, "preco_acao", e.target.value)}
                                placeholder="R$ 0,00"
                                className={`w-full bg-elevated border rounded-lg py-2 pl-9 pr-3 text-foreground font-medium text-sm focus:ring-1 transition-all ${precoError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50' : 'border-border focus:border-gold focus:ring-gold'}`}
                              />
                            </div>
                            {precoError && <p className="text-[10px] text-red-400 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{precoError}</p>}
                            {getDescontoAlerta(skuDetails[sku]) && (
                              <div className="text-[11px] text-red-500 font-bold flex items-center gap-1.5 mt-1.5 p-2 rounded-lg bg-red-950/40 border border-red-500/40 text-[#DC2626]">
                                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                                <span>🔴 {getDescontoAlerta(skuDetails[sku])}</span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="block text-xs font-medium text-muted">Investimento</label>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!isOverridden) {
                                    setOverrideLocks(prev => ({ ...prev, [lockKey]: true }));
                                  } else {
                                    setOverrideLocks(prev => ({ ...prev, [lockKey]: false }));
                                    setSkuDetails(prev => {
                                      const updated = { ...prev, [sku]: { ...(prev[sku] || {}), investimento_justificativa: "" } };
                                      updated[sku].investimento = computeInvestimento(updated[sku]?.preco_flat || "", updated[sku]?.preco_acao || "");
                                      return updated;
                                    });
                                  }
                                }}
                                className={`p-0.5 rounded transition-colors ${isOverridden ? 'text-amber-400 hover:text-amber-300' : 'text-muted hover:text-foreground'}`}
                                title={isOverridden ? "Voltar para cálculo automático (Preço Flat - Preço Ação)" : "Definido como automático (clique para fixar valor manual)"}
                              >
                                {isOverridden ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                              <input
                                type="text"
                                value={skuDetails[sku]?.investimento || ""}
                                onChange={(e) => handleSkuChange(sku, "investimento", e.target.value)}
                                placeholder="R$ 0,00"
                                className="w-full bg-elevated border border-border rounded-lg py-2 pl-9 pr-3 font-medium text-sm transition-all focus:border-gold focus:ring-1 focus:ring-gold"
                              />
                              {!isOverridden && <span className="absolute right-2 top-2 text-[9px] text-muted font-medium bg-background px-1 rounded">AUTO</span>}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-xs font-medium text-muted">Exp. Vol.</label>
                            <div className="relative">
                              <Package className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                              <input
                                type="text"
                                value={skuDetails[sku]?.expectativa_volume || ""}
                                onChange={(e) => handleSkuChange(sku, "expectativa_volume", e.target.value, true)}
                                placeholder="0"
                                className="w-full bg-elevated border border-border rounded-lg py-2 pl-9 pr-3 text-foreground font-medium text-sm focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                              />
                            </div>
                          </div>
                          {dateMode === "multiple" && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 col-span-1 sm:col-span-2 lg:col-span-4 border-t border-border/50 pt-3 mt-1">
                              <div className="space-y-2">
                                <label className="block text-xs font-medium text-muted">Data Início</label>
                                <input
                                  type="date"
                                  required={dateMode === "multiple"}
                                  value={skuDetails[sku]?.start_date || ""}
                                  onChange={(e) => handleSkuChange(sku, "start_date", e.target.value)}
                                  onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-gold/50 [color-scheme:dark] cursor-pointer"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-xs font-medium text-muted">Data Fim</label>
                                <input
                                  type="date"
                                  required={dateMode === "multiple"}
                                  value={skuDetails[sku]?.end_date || ""}
                                  onChange={(e) => handleSkuChange(sku, "end_date", e.target.value)}
                                  onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-gold/50 [color-scheme:dark] cursor-pointer"
                                />
                              </div>
                            </div>
                          )}
                          <div className="col-span-1 sm:col-span-2 lg:col-span-4 bg-gold/5 border border-gold/10 p-3 rounded-lg flex items-center justify-between mt-1">
                            <span className="text-xs font-bold text-gold">Custo Estimado ({sku})</span>
                            <span className="text-sm font-black text-gold">
                              {formatCurrencyValue(parseNumericValue(skuDetails[sku]?.investimento || "") * parseNumericValue(skuDetails[sku]?.expectativa_volume || ""))}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* COMBINED Investimento Total Estimado */}
          {((showFamilias && selectedFamilias.length > 0) || (showSkus && selectedSkus.length > 0)) && (
            <div className="bg-gold/10 border border-gold/20 p-4 rounded-xl flex items-center justify-between mt-4">
              <span className="text-sm font-bold text-gold">Investimento Total Estimado</span>
              <span className="text-xl font-black text-gold">
                {formatCurrencyValue(
                  (showFamilias ? selectedFamilias.reduce((total, fam) => {
                    const inv = parseNumericValue(familiaDetails[fam]?.investimento || "");
                    const vol = parseNumericValue(familiaDetails[fam]?.expectativa_volume || "");
                    return total + (inv * vol);
                  }, 0) : 0) +
                  (showSkus ? selectedSkus.reduce((total, sku) => {
                    const inv = parseNumericValue(skuDetails[sku]?.investimento || "");
                    const vol = parseNumericValue(skuDetails[sku]?.expectativa_volume || "");
                    return total + (inv * vol);
                  }, 0) : 0)
                )}
              </span>
            </div>
          )}
        </div>



        </fieldset>

        {/* Consultor Comercial Inteligente de Lançamento */}
        <LaunchInvestmentAdvisor
          rede={selectedRede}
          tipoPagamento={tipoPagamento}
          tipoAcaoDetalhe={tipoAcaoDetalhe}
          abrangencia={abrangenciaUi}
          selectedFamilias={selectedFamilias}
          familiaDetails={familiaDetails}
          selectedSkus={selectedSkus}
          skuDetails={skuDetails}
          mesReferencia={mesReferencia}
        />

        {/* Submit */}
        {!isLocked && (
          <div className="pt-3 border-t border-border">
            <button 
              type="submit"
              disabled={isPending}
              className="w-full bg-gold text-black font-bold text-base rounded-xl py-3 flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isPending ? (
                <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  {initialData ? "Salvar Alterações" : "Confirmar Lançamento"}
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
