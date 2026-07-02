"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Calendar, Save, CheckCircle2, ChevronDown, DollarSign, Package, Lock, Unlock, AlertTriangle, Check } from "lucide-react";
import Link from "next/link";
import { criarAcaoInvestimento, atualizarAcaoInvestimento } from "./actions";
import { MultiSelect } from "@/components/MultiSelect";

interface InvestmentFormProps {
  redes: Array<{ codigo: string; nome: string; canal: string }>;
  familias: string[];
  skus?: string[];
  initialData?: any;
}

export function InvestmentForm({ redes, familias, skus, initialData }: InvestmentFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const isPlanejamento = initialData 
    ? !!initialData.is_planejamento 
    : searchParams.get("planejamento") === "true";
  
  const isLocked = initialData && (initialData.fase_atual || 1) >= 5 && !initialData.is_reopened;
  
  // Find initial network object if editing
  const initRedeObj = initialData?.codigo_matriz
    ? redes.find(r => r.codigo === initialData.codigo_matriz)
    : (initialData?.rede ? redes.find(r => r.nome.toLowerCase() === initialData.rede.toLowerCase()) : null);

  // Combobox state for Rede
  const [searchRede, setSearchRede] = useState("");
  const [isRedeOpen, setIsRedeOpen] = useState(false);
  const [selectedRede, setSelectedRede] = useState<{ codigo: string; nome: string; canal: string } | null>(initRedeObj || null);
  const [paymentDisabled, setPaymentDisabled] = useState(false);

  useEffect(() => {
    if (!selectedRede) {
      setPaymentDisabled(false);
      return;
    }

    const checkPaymentCondition = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        
        const { data: clients } = await supabase
          .from("cm_clientes")
          .select("condicao_pagamento")
          .or(`codigo_matriz.eq.${selectedRede.codigo},codigo.eq.${parseInt(selectedRede.codigo, 10) || 0}`)
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

  const filteredRedes = redes.filter(r => 
    r.nome.toLowerCase().includes(searchRede.toLowerCase()) ||
    r.codigo.toLowerCase().includes(searchRede.toLowerCase())
  );

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

  // Override confirmation dialog state
  const [overrideConfirm, setOverrideConfirm] = useState<{ key: string; field: string; value: string; type: 'familia' | 'sku' } | null>(null);

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
    if (flat > 0) {
      const desc = (flat - acao) / flat;
      if (desc > 0.40) return `Aviso: Desconto de ${(desc * 100).toFixed(0)}% está acima do limite de 40%`;
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
          investimento_justificativa: f.investimento_justificativa || ""
        };
      });
    } else if (initialData?.familia_produto) {
      init[initialData.familia_produto] = {
        preco_flat: initialData.preco_flat ? formatCurrencyValue(initialData.preco_flat) : "",
        preco_acao: initialData.preco_acao ? formatCurrencyValue(initialData.preco_acao) : "",
        investimento: initialData.valor_investimento ? formatCurrencyValue(initialData.valor_investimento) : "",
        expectativa_volume: initialData.expectativa_volume ? initialData.expectativa_volume.toString().replace(".", ",") : "",
        investimento_justificativa: ""
      };
    }
    return init;
  });

  const handleFamiliaChange = (familia: string, field: string, value: string, isNumericText = false) => {
    const lockKey = `fam_${familia}`;
    const isOverridden = overrideLocks[lockKey];

    // If flat or acao changes and there's an active override, show confirmation
    if ((field === "preco_flat" || field === "preco_acao") && isOverridden) {
      setOverrideConfirm({ key: lockKey, field, value, type: 'familia' });
      return;
    }

    let finalValue = value;
    if (isNumericText) {
      finalValue = value.replace(/[^0-9,]/g, "");
      const parts = finalValue.split(",");
      if (parts.length > 2) finalValue = parts[0] + "," + parts.slice(1).join("");
    } else if (field !== "investimento_justificativa") {
      const v = value.replace(/\D/g, "");
      if (!v) { finalValue = ""; } else {
        const numValue = (parseInt(v, 10) / 100).toFixed(2);
        finalValue = "R$ " + numValue.replace(".", ",").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
      }
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

  const applyFamiliaChangeAfterConfirm = (recalc: boolean) => {
    if (!overrideConfirm || overrideConfirm.type !== 'familia') return;
    const { key, field, value } = overrideConfirm;
    const familia = key.replace('fam_', '');

    const v = value.replace(/\D/g, "");
    const finalValue = v ? "R$ " + (parseInt(v, 10) / 100).toFixed(2).replace(".", ",").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.") : "";

    if (recalc) {
      setOverrideLocks(prev => ({ ...prev, [key]: false }));
      setFamiliaDetails(prev => {
        const updated = { ...prev, [familia]: { ...(prev[familia] || {}), [field]: finalValue, investimento_justificativa: "" } };
        const flat = field === "preco_flat" ? finalValue : (updated[familia]?.preco_flat || "");
        const acao = field === "preco_acao" ? finalValue : (updated[familia]?.preco_acao || "");
        updated[familia].investimento = computeInvestimento(flat, acao);
        return updated;
      });
    } else {
      setFamiliaDetails(prev => ({ ...prev, [familia]: { ...(prev[familia] || {}), [field]: finalValue } }));
    }
    setOverrideConfirm(null);
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
          investimento_justificativa: s.investimento_justificativa || ""
        };
      });
    }
    return init;
  });

  const handleSkuChange = (sku: string, field: string, value: string, isNumericText = false) => {
    const lockKey = `sku_${sku}`;
    const isOverridden = overrideLocks[lockKey];

    if ((field === "preco_flat" || field === "preco_acao") && isOverridden) {
      setOverrideConfirm({ key: lockKey, field, value, type: 'sku' });
      return;
    }

    let finalValue = value;
    if (isNumericText) {
      finalValue = value.replace(/[^0-9,]/g, "");
      const parts = finalValue.split(",");
      if (parts.length > 2) finalValue = parts[0] + "," + parts.slice(1).join("");
    } else if (field !== "investimento_justificativa") {
      const v = value.replace(/\D/g, "");
      if (!v) { finalValue = ""; } else {
        const numValue = (parseInt(v, 10) / 100).toFixed(2);
        finalValue = "R$ " + numValue.replace(".", ",").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
      }
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

  const applySkuChangeAfterConfirm = (recalc: boolean) => {
    if (!overrideConfirm || overrideConfirm.type !== 'sku') return;
    const { key, field, value } = overrideConfirm;
    const sku = key.replace('sku_', '');

    const v = value.replace(/\D/g, "");
    const finalValue = v ? "R$ " + (parseInt(v, 10) / 100).toFixed(2).replace(".", ",").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.") : "";

    if (recalc) {
      setOverrideLocks(prev => ({ ...prev, [key]: false }));
      setSkuDetails(prev => {
        const updated = { ...prev, [sku]: { ...(prev[sku] || {}), [field]: finalValue, investimento_justificativa: "" } };
        const flat = field === "preco_flat" ? finalValue : (updated[sku]?.preco_flat || "");
        const acao = field === "preco_acao" ? finalValue : (updated[sku]?.preco_acao || "");
        updated[sku].investimento = computeInvestimento(flat, acao);
        return updated;
      });
    } else {
      setSkuDetails(prev => ({ ...prev, [sku]: { ...(prev[sku] || {}), [field]: finalValue } }));
    }
    setOverrideConfirm(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    
    if (!selectedRede) {
      setError("Por favor, selecione uma rede.");
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
      if (overrideLocks[item.lockKey] && !(item.details?.investimento_justificativa?.trim())) {
        setError(`${item.name}: Justificativa obrigatória para override de investimento.`);
        return;
      }
    }

    const calculatedAbrangencia = (showFamilias && showSkus) ? "Misto" : showFamilias ? "Família" : "SKU";

    const formData = new FormData(e.currentTarget);
    formData.append("rede", selectedRede.nome);
    formData.append("codigo_matriz", selectedRede.codigo);
    formData.append("tipo_pagamento", tipoPagamento);
    formData.append("tipo_acao_detalhe", tipoAcaoDetalhe);
    formData.append("abrangencia", calculatedAbrangencia);

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
          if (result.is_planejamento) {
            router.push("/investimento/planejamento");
          } else {
            router.push("/investimento");
          }
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
          {/* Rede */}
          <div className="space-y-2 relative z-50">
            <label className="block text-sm font-medium text-muted">Rede</label>
            <div className="relative">
              <input 
                type="text"
                placeholder="Digite para buscar a rede..."
                className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-gold/50"
                value={isRedeOpen ? searchRede : (selectedRede ? `${selectedRede.codigo} - ${selectedRede.nome}` : "")}
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
                  filteredRedes.map(r => (
                    <button
                      key={r.codigo}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-gold/10 hover:text-gold transition-colors flex items-center justify-between"
                      onClick={() => {
                        setSelectedRede(r);
                        setSearchRede("");
                        setIsRedeOpen(false);
                      }}
                    >
                      <div>
                        <span className="font-semibold text-gold mr-2">{r.codigo}</span>
                        <span>{r.nome}</span>
                      </div>
                      <span className="text-xs text-muted">({r.canal})</span>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted text-sm">Nenhuma rede encontrada.</div>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Mês de Referência</label>
            <input 
              type="month"
              name="mes_referencia"
              required
              defaultValue={initialData?.mes_referencia || ""}
              onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
              className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 [color-scheme:dark] cursor-pointer"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Data Início da Ação</label>
            <input 
              type="date"
              name="data_inicio"
              required
              defaultValue={initialData?.data_inicio}
              onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
              className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 [color-scheme:dark] cursor-pointer"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Data Fim da Ação</label>
            <input 
              type="date"
              name="data_fim"
              required
              defaultValue={initialData?.data_fim}
              onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
              className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 [color-scheme:dark] cursor-pointer"
            />
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
                              <p className="text-[10px] text-amber-400 font-medium flex items-center gap-1 mt-1">
                                <AlertTriangle className="w-3 h-3" />
                                {getDescontoAlerta(familiaDetails[familia])}
                              </p>
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
                                title={isOverridden ? "Destravar (recalcular automático)" : "Destravar para edição manual"}
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
                                readOnly={!isOverridden}
                                className={`w-full border rounded-lg py-2 pl-9 pr-3 font-medium text-sm transition-all ${isOverridden ? 'bg-elevated border-amber-500/30 text-foreground focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50' : 'bg-elevated/50 border-border text-foreground/70 cursor-not-allowed'}`}
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
                          {isOverridden && (
                            <div className="col-span-1 sm:col-span-2 lg:col-span-4">
                              <label className="block text-xs font-medium text-amber-400 mb-1">Justificativa do override *</label>
                              <input
                                type="text"
                                value={familiaDetails[familia]?.investimento_justificativa || ""}
                                onChange={(e) => handleFamiliaChange(familia, "investimento_justificativa", e.target.value)}
                                placeholder="Ex: Negociação especial com a rede"
                                className="w-full bg-elevated border border-amber-500/30 rounded-lg py-2 px-3 text-foreground text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all"
                              />
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
                              <p className="text-[10px] text-amber-400 font-medium flex items-center gap-1 mt-1">
                                <AlertTriangle className="w-3 h-3" />
                                {getDescontoAlerta(skuDetails[sku])}
                              </p>
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
                                title={isOverridden ? "Destravar (recalcular automático)" : "Destravar para edição manual"}
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
                                readOnly={!isOverridden}
                                className={`w-full border rounded-lg py-2 pl-9 pr-3 font-medium text-sm transition-all ${isOverridden ? 'bg-elevated border-amber-500/30 text-foreground focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50' : 'bg-elevated/50 border-border text-foreground/70 cursor-not-allowed'}`}
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
                          {isOverridden && (
                            <div className="col-span-1 sm:col-span-2 lg:col-span-4">
                              <label className="block text-xs font-medium text-amber-400 mb-1">Justificativa do override *</label>
                              <input
                                type="text"
                                value={skuDetails[sku]?.investimento_justificativa || ""}
                                onChange={(e) => handleSkuChange(sku, "investimento_justificativa", e.target.value)}
                                placeholder="Ex: Preço negociado diretamente"
                                className="w-full bg-elevated border border-amber-500/30 rounded-lg py-2 px-3 text-foreground text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all"
                              />
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

        {/* Override Confirmation Dialog */}
        {overrideConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-elevated border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Override Manual Ativo</h3>
                  <p className="text-xs text-muted">O investimento foi definido manualmente</p>
                </div>
              </div>
              <p className="text-sm text-foreground/80">
                Você alterou um preço que impacta o cálculo de investimento. Deseja:
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => overrideConfirm.type === 'familia' ? applyFamiliaChangeAfterConfirm(true) : applySkuChangeAfterConfirm(true)}
                  className="w-full px-4 py-2.5 bg-gold text-black font-bold rounded-xl hover:opacity-90 transition-all text-sm"
                >
                  Recalcular investimento automaticamente
                </button>
                <button
                  type="button"
                  onClick={() => overrideConfirm.type === 'familia' ? applyFamiliaChangeAfterConfirm(false) : applySkuChangeAfterConfirm(false)}
                  className="w-full px-4 py-2.5 bg-elevated border border-border text-foreground font-medium rounded-xl hover:bg-border transition-all text-sm"
                >
                  Manter override manual anterior
                </button>
                <button
                  type="button"
                  onClick={() => setOverrideConfirm(null)}
                  className="w-full px-4 py-2.5 text-muted text-sm hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        </fieldset>

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
