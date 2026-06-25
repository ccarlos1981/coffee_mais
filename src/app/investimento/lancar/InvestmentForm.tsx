"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Calendar, Save, CheckCircle2, ChevronDown, DollarSign, Package } from "lucide-react";
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
  
  // Find initial network object if editing
  const initRedeObj = initialData?.codigo_matriz
    ? redes.find(r => r.codigo === initialData.codigo_matriz)
    : (initialData?.rede ? redes.find(r => r.nome.toLowerCase() === initialData.rede.toLowerCase()) : null);

  // Combobox state for Rede
  const [searchRede, setSearchRede] = useState("");
  const [isRedeOpen, setIsRedeOpen] = useState(false);
  const [selectedRede, setSelectedRede] = useState<{ codigo: string; nome: string; canal: string } | null>(initRedeObj || null);

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

  // Família fields (same 4 as SKU)
  const [famPrecoFlat, setFamPrecoFlat] = useState(initialData?.preco_flat ? formatCurrencyValue(initialData.preco_flat) : "");
  const [famPrecoAcao, setFamPrecoAcao] = useState(initialData?.preco_acao ? formatCurrencyValue(initialData.preco_acao) : "");
  const [famInvestimento, setFamInvestimento] = useState(initialData?.valor_investimento ? formatCurrencyValue(initialData.valor_investimento) : "");
  const [famVolume, setFamVolume] = useState(initialData?.expectativa_volume ? initialData.expectativa_volume.toString().replace(".", ",") : "");

  // Toggles and SKU states
  const [tipoPagamento, setTipoPagamento] = useState<string>(initialData?.tipo_pagamento || "Transf. Bancária");
  const [tipoAcaoDetalhe, setTipoAcaoDetalhe] = useState<string>(initialData?.tipo_acao_detalhe || "Ação de Vendas");
  const [abrangencia, setAbrangencia] = useState<"Família" | "SKU">(initialData?.abrangencia || "Família");
  
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
          expectativa_volume: s.expectativa_volume ? s.expectativa_volume.toString().replace(".", ",") : ""
        };
      });
    }
    return init;
  });

  const handleSkuChange = (sku: string, field: string, value: string, isNumericText = false) => {
    let finalValue = value;
    if (isNumericText) {
      finalValue = value.replace(/[^0-9,]/g, "");
      const parts = finalValue.split(",");
      if (parts.length > 2) {
        finalValue = parts[0] + "," + parts.slice(1).join("");
      }
    } else {
      let v = value.replace(/\D/g, "");
      if (!v) {
        finalValue = "";
      } else {
        const numValue = (parseInt(v, 10) / 100).toFixed(2);
        const formatted = numValue.replace(".", ",").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
        finalValue = "R$ " + formatted;
      }
    }
    
    setSkuDetails(prev => ({
      ...prev,
      [sku]: {
        ...(prev[sku] || {}),
        [field]: finalValue
      }
    }));
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

    if (abrangencia === "SKU" && selectedSkus.length === 0) {
      setError("Por favor, selecione ao menos um SKU.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.append("rede", selectedRede.nome);
    formData.append("codigo_matriz", selectedRede.codigo);
    formData.append("tipo_pagamento", tipoPagamento);
    formData.append("tipo_acao_detalhe", tipoAcaoDetalhe);
    formData.append("abrangencia", abrangencia);

    // Appended dynamically by standard HTML form names

    if (abrangencia === "SKU") {
      const packedSkus = selectedSkus.map(sku => {
        const d = skuDetails[sku] || {};
        const parseVal = (str: string) => {
          if (!str) return null;
          let v = str.replace(/[R\$\s]/g, "");
          if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
          return parseFloat(v);
        };
        return {
          sku,
          preco_flat: parseVal(d.preco_flat),
          preco_acao: parseVal(d.preco_acao),
          investimento: parseVal(d.investimento),
          expectativa_volume: parseVal(d.expectativa_volume)
        };
      });
      formData.append("skus_detalhes", JSON.stringify(packedSkus));
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

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-4 shadow-xl space-y-5">
        
        {/* BLOCK 1: Rede & Tipo de Ação & Desconto */}
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
                <label key={opcao} className="relative flex items-center gap-3 cursor-pointer rounded-lg border border-border bg-elevated p-2.5 focus-within:ring-2 focus-within:ring-gold/50 hover:bg-border transition-colors">
                  <input 
                    type="radio" 
                    name="tipo_pagamento_ui" 
                    className="sr-only peer" 
                    checked={tipoPagamento === opcao}
                    onChange={() => setTipoPagamento(opcao)}
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
            <div className="grid grid-cols-2 gap-3">
              <label className="relative flex items-center gap-3 cursor-pointer rounded-lg border border-border bg-elevated p-2.5 focus-within:ring-2 focus-within:ring-gold/50 hover:bg-border transition-colors">
                <input 
                  type="radio" 
                  name="abrangencia_ui" 
                  className="sr-only peer" 
                  checked={abrangencia === "Família"}
                  onChange={() => setAbrangencia("Família")}
                />
                <div className="w-4 h-4 rounded-full border-2 border-foreground-muted peer-checked:border-[#C4A25D] peer-checked:bg-[#C4A25D] flex items-center justify-center transition-colors">
                  <div className="w-2 h-2 rounded-full bg-black opacity-0 peer-checked:opacity-100" />
                </div>
                <span className="font-medium text-foreground">Família</span>
              </label>

              <label className="relative flex items-center gap-3 cursor-pointer rounded-lg border border-border bg-elevated p-2.5 focus-within:ring-2 focus-within:ring-gold/50 hover:bg-border transition-colors">
                <input 
                  type="radio" 
                  name="abrangencia_ui" 
                  className="sr-only peer" 
                  checked={abrangencia === "SKU"}
                  onChange={() => setAbrangencia("SKU")}
                />
                <div className="w-4 h-4 rounded-full border-2 border-foreground-muted peer-checked:border-[#C4A25D] peer-checked:bg-[#C4A25D] flex items-center justify-center transition-colors">
                  <div className="w-2 h-2 rounded-full bg-black opacity-0 peer-checked:opacity-100" />
                </div>
                <span className="font-medium text-foreground">SKU</span>
              </label>
            </div>
          </div>

          {/* Render based on Abrangência */}
          {abrangencia === "Família" ? (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-muted">Família de Produto</label>
                <div className="relative">
                  <select 
                    name="familia_produto"
                    required={abrangencia === "Família"}
                    defaultValue={initialData?.familia_produto || ""}
                    className="w-full appearance-none bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50"
                  >
                    <option value="" disabled>Selecione uma família...</option>
                    {familias.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-muted pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted">Preço Flat</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                    <input 
                      type="text"
                      name="preco_flat"
                      value={famPrecoFlat}
                      onChange={(e) => setFamPrecoFlat(maskCurrency(e.target.value))}
                      placeholder="R$ 0,00"
                      className="w-full bg-elevated border border-border rounded-lg py-2 pl-9 pr-3 text-foreground font-medium text-sm placeholder-foreground-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted">Preço da Ação</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                    <input 
                      type="text"
                      name="preco_acao"
                      value={famPrecoAcao}
                      onChange={(e) => setFamPrecoAcao(maskCurrency(e.target.value))}
                      placeholder="R$ 0,00"
                      className="w-full bg-elevated border border-border rounded-lg py-2 pl-9 pr-3 text-foreground font-medium text-sm placeholder-foreground-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted">Investimento</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                    <input 
                      type="text"
                      name="valor_investimento"
                      value={famInvestimento}
                      onChange={(e) => setFamInvestimento(maskCurrency(e.target.value))}
                      placeholder="R$ 0,00"
                      className="w-full bg-elevated border border-border rounded-lg py-2 pl-9 pr-3 text-foreground font-medium text-sm placeholder-foreground-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted">Exp. Volume</label>
                  <div className="relative">
                    <Package className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                    <input 
                      type="text"
                      name="expectativa_volume"
                      value={famVolume}
                      onChange={(e) => setFamVolume(maskVolume(e.target.value))}
                      placeholder="0"
                      className="w-full bg-elevated border border-border rounded-lg py-2 pl-9 pr-3 text-foreground font-medium text-sm placeholder-foreground-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                    />
                  </div>
                </div>
              </div>
              
              <div className="bg-gold/10 border border-gold/20 p-4 rounded-xl flex items-center justify-between">
                <span className="text-sm font-bold text-gold">Investimento Total Estimado</span>
                <span className="text-xl font-black text-gold">
                  {formatCurrencyValue(parseNumericValue(famInvestimento) * parseNumericValue(famVolume))}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in relative z-40">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-muted">Seleção de SKUs</label>
                <div className="relative">
                  <MultiSelect
                    value={selectedSkus}
                    onChange={setSelectedSkus}
                    options={skus || []}
                    placeholder="Selecione os SKUs"
                    className="w-full bg-elevated border border-border rounded-xl px-4 py-3 text-foreground"
                  />
                </div>
              </div>

              {selectedSkus.length > 0 && (
                <div className="space-y-4 pt-4">
                  <h3 className="text-sm font-bold text-foreground">Detalhes por SKU</h3>
                  {selectedSkus.map(sku => (
                    <div key={sku} className="bg-background border border-border p-4 rounded-xl space-y-4">
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
                              className="w-full bg-elevated border border-border rounded-lg py-2 pl-9 pr-3 text-foreground font-medium text-sm focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-muted">Investimento</label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                            <input
                              type="text"
                              value={skuDetails[sku]?.investimento || ""}
                              onChange={(e) => handleSkuChange(sku, "investimento", e.target.value)}
                              placeholder="R$ 0,00"
                              className="w-full bg-elevated border border-border rounded-lg py-2 pl-9 pr-3 text-foreground font-medium text-sm focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                            />
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
                        <div className="col-span-1 sm:col-span-2 lg:col-span-4 bg-gold/5 border border-gold/10 p-3 rounded-lg flex items-center justify-between mt-1">
                          <span className="text-xs font-bold text-gold">Custo Estimado ({sku})</span>
                          <span className="text-sm font-black text-gold">
                            {formatCurrencyValue(parseNumericValue(skuDetails[sku]?.investimento || "") * parseNumericValue(skuDetails[sku]?.expectativa_volume || ""))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {selectedSkus.length > 0 && (
                    <div className="bg-gold/10 border border-gold/20 p-4 rounded-xl flex items-center justify-between mt-4">
                      <span className="text-sm font-bold text-gold">Investimento Total Estimado</span>
                      <span className="text-xl font-black text-gold">
                        {formatCurrencyValue(
                          selectedSkus.reduce((total, sku) => {
                            const inv = parseNumericValue(skuDetails[sku]?.investimento || "");
                            const vol = parseNumericValue(skuDetails[sku]?.expectativa_volume || "");
                            return total + (inv * vol);
                          }, 0)
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit */}
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

      </form>
    </div>
  );
}
