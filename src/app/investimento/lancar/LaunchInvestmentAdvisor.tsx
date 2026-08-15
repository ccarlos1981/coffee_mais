"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Compass, 
  Award,
  Minus,
  Trophy,
  Bookmark
} from "lucide-react";
import { obterHistoricoConsultorComercial, ResultadoConsultorComercial, HistoricoItemConsultor } from "./actions";

interface LaunchInvestmentAdvisorProps {
  rede: { codigo: string; nome: string; uf?: string | null; gerente?: string | null } | null;
  tipoPagamento: string;
  tipoAcaoDetalhe: string;
  abrangencia: "Família" | "SKU" | "Misto";
  selectedFamilias: string[];
  familiaDetails: Record<string, any>;
  selectedSkus: string[];
  skuDetails: Record<string, any>;
  mesReferencia?: string;
}

const formatMonthHeader = (ym?: string): string => {
  if (!ym || !ym.includes("-")) {
    const now = new Date();
    const months = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
    return `${months[now.getMonth()]} / ${now.getFullYear()}`;
  }
  const [yStr, mStr] = ym.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const months = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
  const monthName = months[m - 1] || "MÊS";
  return `${monthName} / ${y}`;
};

const getPreviousMonthKey = (ym?: string): string => {
  if (!ym || !ym.includes("-")) {
    const now = new Date();
    let prevY = now.getFullYear();
    let prevM = now.getMonth();
    if (prevM === 0) {
      prevM = 12;
      prevY = prevY - 1;
    }
    return `${prevY}-${String(prevM).padStart(2, "0")}`;
  }
  const [yStr, mStr] = ym.split("-");
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10) - 1;
  if (m === 0) {
    m = 12;
    y = y - 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
};

export function LaunchInvestmentAdvisor({
  rede,
  tipoPagamento,
  tipoAcaoDetalhe,
  abrangencia,
  selectedFamilias,
  familiaDetails,
  selectedSkus,
  skuDetails,
  mesReferencia
}: LaunchInvestmentAdvisorProps) {
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ResultadoConsultorComercial | null>(null);
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  // Helper parsing numbers
  const parseNum = (val: any): number => {
    if (!val) return 0;
    if (typeof val === "number") return val;
    let str = val.toString().replace(/[R\$\s]/g, "");
    if (str.includes(",")) str = str.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(str);
    return isNaN(n) ? 0 : n;
  };

  const formatCurrency = (n: number) => {
    return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatNumber = (n: number) => {
    return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  };

  // Deterministic previous month key (e.g. "2026-08" -> "2026-07")
  const previousMonthKey = useMemo(() => {
    return getPreviousMonthKey(mesReferencia);
  }, [mesReferencia]);

  // Current proposal month/year header derived exclusively from form input (e.g. AGOSTO / 2026)
  const currentMonthHeader = useMemo(() => {
    return formatMonthHeader(mesReferencia);
  }, [mesReferencia]);

  // Extract candidate items based on Abrangencia
  const candidateItems = useMemo(() => {
    const items: Array<{
      name: string;
      abrangencia: "Família" | "SKU";
      flat: number;
      acao: number;
      investimento: number;
      volume: number;
      isComplete: boolean;
    }> = [];

    if (abrangencia === "Família" || abrangencia === "Misto") {
      selectedFamilias.forEach(fam => {
        const d = familiaDetails[fam] || {};
        const flat = parseNum(d.preco_flat);
        const acao = parseNum(d.preco_acao);
        const inv = parseNum(d.investimento);
        const vol = parseNum(d.expectativa_volume);
        items.push({
          name: fam,
          abrangencia: "Família",
          flat,
          acao,
          investimento: inv,
          volume: vol,
          isComplete: !!rede?.nome && !!tipoPagamento && !!tipoAcaoDetalhe && flat > 0 && acao > 0 && inv > 0 && vol > 0
        });
      });
    }

    if (abrangencia === "SKU" || (abrangencia === "Misto" && items.length === 0)) {
      selectedSkus.forEach(sku => {
        const d = skuDetails[sku] || {};
        const flat = parseNum(d.preco_flat);
        const acao = parseNum(d.preco_acao);
        const inv = parseNum(d.investimento);
        const vol = parseNum(d.expectativa_volume);
        items.push({
          name: sku,
          abrangencia: "SKU",
          flat,
          acao,
          investimento: inv,
          volume: vol,
          isComplete: !!rede?.nome && !!tipoPagamento && !!tipoAcaoDetalhe && flat > 0 && acao > 0 && inv > 0 && vol > 0
        });
      });
    }

    return items;
  }, [rede, tipoPagamento, tipoAcaoDetalhe, abrangencia, selectedFamilias, familiaDetails, selectedSkus, skuDetails]);

  const activeItem = candidateItems[activeItemIndex] || candidateItems[0];

  // Fetch comparison history when activeItem is complete
  useEffect(() => {
    if (!activeItem || !activeItem.isComplete || !rede) {
      setData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    obterHistoricoConsultorComercial({
      codigo_matriz: rede.codigo,
      rede: rede.nome,
      uf: rede.uf || undefined,
      gerente: rede.gerente || undefined,
      abrangencia: activeItem.abrangencia,
      itemNome: activeItem.name,
      tipo_pagamento: tipoPagamento,
      tipo_acao_detalhe: tipoAcaoDetalhe,
      mes_referencia_anterior: previousMonthKey
    }).then(res => {
      if (isMounted) {
        setData(res);
        setLoading(false);
      }
    }).catch(err => {
      console.error("Erro ao buscar histórico do copiloto comercial:", err);
      if (isMounted) {
        setData(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [rede?.codigo, rede?.nome, rede?.uf, rede?.gerente, tipoPagamento, tipoAcaoDetalhe, activeItem?.name, activeItem?.abrangencia, activeItem?.isComplete, previousMonthKey]);

  // Identify Best Result Action among history actions (highest ROI or Efficiency)
  const bestResultAction = useMemo(() => {
    if (!data?.actions || data.actions.length === 0) return null;
    return data.actions.reduce((prev, curr) => {
      const prevScore = (prev.roi_estimado || 0) * 100 + (prev.eficiencia_comercial || 0);
      const currScore = (curr.roi_estimado || 0) * 100 + (curr.eficiencia_comercial || 0);
      return currScore > prevScore ? curr : prev;
    }, data.actions[0]);
  }, [data?.actions]);

  // If mandatory fields are not completely filled, advisor remains completely hidden
  if (!activeItem || !activeItem.isComplete) {
    return null;
  }

  // Calculate current proposal metrics
  const propInv = activeItem.investimento;
  const propVol = activeItem.volume;
  const propFlat = activeItem.flat;
  const propAcao = activeItem.acao;
  const propCustoUn = propVol > 0 ? propInv / propVol : 0;
  const propEfic = propInv > 0 ? propVol / propInv : 0;
  const propRoi = (propAcao > 0 && propInv > 0) ? (propAcao * propVol) / propInv : 0;
  const propDesconto = propFlat > 0 ? ((propFlat - propAcao) / propFlat) * 100 : 0;

  // Real Last Action metrics (Priority 1: Most Recent Real Launch in Previous Month)
  const last = data?.lastAction;
  const lastInv = last?.investimento || 0;
  const lastVol = last?.expectativa_volume || 0;
  const lastFlat = last?.preco_flat || 0;
  const lastAcao = last?.preco_acao || 0;
  const lastCustoUn = last?.custo_unidade || 0;
  const lastEfic = last?.eficiencia_comercial || 0;
  const lastRoi = last?.roi_estimado || 0;
  const lastDesconto = lastFlat > 0 ? ((lastFlat - lastAcao) / lastFlat) * 100 : 0;

  // Exact previous calendar month label (e.g. JULHO / 2026 for AGOSTO / 2026 proposal)
  const lastMonthHeader = formatMonthHeader(previousMonthKey);

  // Direct percentage variations vs Last Action
  const varInv = lastInv > 0 ? ((propInv - lastInv) / lastInv) * 100 : 0;
  const varVol = lastVol > 0 ? ((propVol - lastVol) / lastVol) * 100 : 0;
  const varAcao = lastAcao > 0 ? ((propAcao - lastAcao) / lastAcao) * 100 : 0;
  const varCustoUn = lastCustoUn > 0 ? ((propCustoUn - lastCustoUn) / lastCustoUn) * 100 : 0;
  const varEfic = lastEfic > 0 ? ((propEfic - lastEfic) / lastEfic) * 100 : 0;
  const varRoi = lastRoi > 0 ? ((propRoi - lastRoi) / lastRoi) * 100 : 0;
  const varDesconto = propDesconto - lastDesconto; // percentage points (pp)
  const varFlat = lastFlat > 0 ? ((propFlat - lastFlat) / lastFlat) * 100 : 0;

  // Render Variação Badges (🟢 Verde = melhoria, 🔴 Vermelho = piora, ⚪ Cinza = igual)
  const renderVariationBadge = (
    propVal: number,
    lastVal: number,
    variation: number,
    unit: "%" | "pp" | "=",
    lowerIsBetter = false
  ) => {
    if (Math.abs(variation) < 0.1 || propVal === lastVal) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
          <Minus className="w-3 h-3 text-slate-500" /> =
        </span>
      );
    }

    const isGood = lowerIsBetter ? variation < 0 : variation > 0;
    const isUp = variation > 0;
    const formattedVal = Math.abs(variation).toFixed(0);

    if (isGood) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40">
          {isUp ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
          {isUp ? `▲ +${formattedVal} ${unit}` : `▲ -${formattedVal} ${unit}`}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-500/40">
          {isUp ? <TrendingUp className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> : <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
          {isUp ? `▼ +${formattedVal} ${unit}` : `▼ -${formattedVal} ${unit}`}
        </span>
      );
    }
  };

  // Executive Rationale
  let recomendacaoDiretor = "";
  if (data?.hasHistory && last) {
    if (varInv <= 0 && varVol >= 0) {
      recomendacaoDiretor = `Proposta altamente eficiente: investimento reduzido em ${Math.abs(varInv).toFixed(0)}% com expectativa de vendas superior ao lançamento de ${lastMonthHeader}. Aprovado pela Diretoria.`;
    } else if (varVol >= varInv + 5) {
      recomendacaoDiretor = `Proposta recomendada: a expansão de volume compensa a verba solicitada, elevando o ROI comercial frente a ${lastMonthHeader}.`;
    } else if (varInv > 15 && varVol < 0) {
      recomendacaoDiretor = `Atenção: o investimento cresceu +${varInv.toFixed(0)}% sem ganho proporcional de volume. Recomenda-se ajustar a oferta.`;
    } else {
      recomendacaoDiretor = `Proposta alinhada: mantém os parâmetros comerciais padrão em relação ao lançamento de ${lastMonthHeader} na rede ${rede?.nome}.`;
    }
  }

  // Responsiveness styling helper based on historical actions count (1, 2 or 3)
  const historyCount = data?.actions?.length || 0;
  const timelinePadding = historyCount >= 3 ? "p-2" : historyCount === 2 ? "p-2.5" : "p-3.5";
  const timelineTextSize = historyCount >= 3 ? "text-[11px]" : "text-xs";

  return (
    <div className="mb-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-2xl relative overflow-hidden transition-all duration-300 text-slate-900 dark:text-slate-100">
      {/* Top Gold Ambient Line */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-gold to-amber-500" />

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 mb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-gold border border-amber-500/20">
            <Compass className="w-6 h-6 text-amber-600 dark:text-gold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-lg md:text-xl text-slate-900 dark:text-white tracking-tight">
                COMPARAÇÃO EXECUTIVA
              </h3>
              <span className="text-[10px] font-extrabold tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-gold border border-amber-500/30 uppercase">
                Copiloto Comercial V2
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
              Painel da Diretoria Comercial • <span className="text-slate-900 dark:text-white font-bold">{rede?.nome}</span> ({rede?.uf || "BR"}) • <span className="text-amber-600 dark:text-gold font-bold">{activeItem.name}</span>
            </p>
          </div>
        </div>

        {/* Multi-Item Selector */}
        {candidateItems.length > 1 && (
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
            {candidateItems.map((item, idx) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setActiveItemIndex(idx)}
                className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
                  idx === activeItemIndex
                    ? "bg-amber-500 text-black shadow-md"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-10 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500 animate-pulse">Buscando histórico comercial equivalente...</p>
        </div>
      ) : !data?.hasHistory || !last ? (
        /* PRIMEIRO LANÇAMENTO VIEW (PARTE 6) */
        <div className="p-6 md:p-8 rounded-2xl bg-amber-500/5 border border-amber-500/30 text-slate-900 dark:text-slate-100 text-center space-y-4 max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-600 dark:text-gold flex items-center gap-2 justify-center mx-auto border border-amber-500/40">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base md:text-lg font-black text-amber-700 dark:text-gold tracking-tight">
              Primeiro lançamento equivalente desta combinação.
            </h4>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-medium mt-1 leading-relaxed">
              Esta proposta iniciará o histórico comercial desta Rede para esta Família/SKU.
            </p>
          </div>
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-gold border border-amber-500/30">
              Proposta Atual ({currentMonthHeader}): {formatCurrency(propInv)} • {formatNumber(propVol)} un
            </span>
          </div>
        </div>
      ) : (
        /* COMPARAÇÃO EXECUTIVA LADO A LADO (PARTE 4) */
        <div className="space-y-6">
          {/* EXECUTIVE TABLE */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/90">
                  <th className="py-4 px-4 md:px-6 font-black text-xs md:text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wider w-2/5">
                    INDICADOR COMERCIAL
                  </th>
                  <th className="py-4 px-4 md:px-6 text-center font-black text-sm md:text-base text-slate-800 dark:text-slate-200 tracking-wide w-1/4">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">MÊS ANTERIOR</span>
                      <span className="text-slate-900 dark:text-white font-black text-sm md:text-base mt-0.5">{lastMonthHeader}</span>
                    </div>
                  </th>
                  <th className="py-4 px-4 md:px-6 text-center font-black text-sm md:text-base text-amber-600 dark:text-gold tracking-wide w-1/4">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">PROPOSTA ATUAL</span>
                      <span className="text-slate-900 dark:text-white font-black text-sm md:text-base mt-0.5">{currentMonthHeader}</span>
                    </div>
                  </th>
                  <th className="py-4 px-4 md:px-6 text-center font-black text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider w-1/6">
                    VARIAÇÃO
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm md:text-base">
                {/* 1. Preço Flat */}
                <tr className="hover:bg-white dark:hover:bg-slate-900/60 transition-colors">
                  <td className="py-3.5 px-4 md:px-6 font-bold text-slate-800 dark:text-slate-200">
                    Preço Flat
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                    {formatCurrency(lastFlat)}
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center font-mono font-black text-slate-900 dark:text-white">
                    {formatCurrency(propFlat)}
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center">
                    {renderVariationBadge(propFlat, lastFlat, varFlat, "%", false)}
                  </td>
                </tr>

                {/* 2. Preço Promo */}
                <tr className="hover:bg-white dark:hover:bg-slate-900/60 transition-colors">
                  <td className="py-3.5 px-4 md:px-6 font-bold text-slate-800 dark:text-slate-200">
                    Preço Promo
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                    {formatCurrency(lastAcao)}
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center font-mono font-black text-slate-900 dark:text-white">
                    {formatCurrency(propAcao)}
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center">
                    {renderVariationBadge(propAcao, lastAcao, varAcao, "%", true)}
                  </td>
                </tr>

                {/* 3. Desconto (%) */}
                <tr className="hover:bg-white dark:hover:bg-slate-900/60 transition-colors bg-amber-500/5">
                  <td className="py-3.5 px-4 md:px-6 font-black text-amber-700 dark:text-gold flex items-center gap-1.5">
                    Desconto (%)
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                    {lastDesconto.toFixed(0)}%
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center font-mono font-black text-amber-600 dark:text-gold text-base md:text-lg">
                    {propDesconto.toFixed(0)}%
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center">
                    {renderVariationBadge(propDesconto, lastDesconto, varDesconto, "pp", false)}
                  </td>
                </tr>

                {/* 4. Investimento */}
                <tr className="hover:bg-white dark:hover:bg-slate-900/60 transition-colors bg-amber-500/5">
                  <td className="py-3.5 px-4 md:px-6 font-black text-amber-700 dark:text-gold">
                    Investimento
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                    {formatCurrency(lastInv)}
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center font-mono font-black text-amber-600 dark:text-gold text-base md:text-lg">
                    {formatCurrency(propInv)}
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center">
                    {renderVariationBadge(propInv, lastInv, varInv, "%", true)}
                  </td>
                </tr>

                {/* 5. Exp. Volume */}
                <tr className="hover:bg-white dark:hover:bg-slate-900/60 transition-colors">
                  <td className="py-3.5 px-4 md:px-6 font-bold text-slate-800 dark:text-slate-200">
                    Exp. Volume
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                    {formatNumber(lastVol)} un
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center font-mono font-black text-slate-900 dark:text-white">
                    {formatNumber(propVol)} un
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center">
                    {renderVariationBadge(propVol, lastVol, varVol, "%", false)}
                  </td>
                </tr>

                {/* 6. ROI */}
                <tr className="hover:bg-white dark:hover:bg-slate-900/60 transition-colors">
                  <td className="py-3.5 px-4 md:px-6 font-bold text-slate-800 dark:text-slate-200">
                    ROI
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                    {lastRoi.toFixed(2)}x
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center font-mono font-black text-slate-900 dark:text-white">
                    {propRoi.toFixed(2)}x
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center">
                    {renderVariationBadge(propRoi, lastRoi, varRoi, "%", false)}
                  </td>
                </tr>

                {/* 7. Eficiência */}
                <tr className="hover:bg-white dark:hover:bg-slate-900/60 transition-colors">
                  <td className="py-3.5 px-4 md:px-6 font-bold text-slate-800 dark:text-slate-200">
                    Eficiência
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                    {lastEfic.toFixed(0)} un/R$
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center font-mono font-black text-amber-600 dark:text-gold">
                    {propEfic.toFixed(0)} un/R$
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center">
                    {renderVariationBadge(propEfic, lastEfic, varEfic, "%", false)}
                  </td>
                </tr>

                {/* 8. Custo Unidade */}
                <tr className="hover:bg-white dark:hover:bg-slate-900/60 transition-colors">
                  <td className="py-3.5 px-4 md:px-6 font-bold text-slate-800 dark:text-slate-200">
                    Custo Unidade
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                    {formatCurrency(lastCustoUn)}
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center font-mono font-black text-slate-900 dark:text-white">
                    {formatCurrency(propCustoUn)}
                  </td>
                  <td className="py-3.5 px-4 md:px-6 text-center">
                    {renderVariationBadge(propCustoUn, lastCustoUn, varCustoUn, "%", true)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* EVOLUÇÃO CRONOLÓGICA (TIMELINE INTELIGENTE COM BADGES & TOOLTIPS EXECUTIVOS) */}
          {data.actions.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                  TIMELINE CRONOLÓGICA INTELIGENTE DOS LANÇAMENTOS
                </h4>
                {data.actions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setTimelineExpanded(!timelineExpanded)}
                    className="text-xs font-bold text-amber-600 dark:text-gold hover:underline flex items-center gap-1"
                  >
                    {timelineExpanded ? "Recolher" : "Expandir Tabela"}
                    {timelineExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {/* Responsive Chronological sequence flow with BADGES & HOVER TOOLTIPS */}
              <div className={`flex flex-wrap md:flex-nowrap items-center justify-between gap-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-x-auto ${timelinePadding}`}>
                {data.actions.slice().reverse().map((act: HistoricoItemConsultor) => {
                  const isReference = act.id === last.id;
                  const isBestResult = bestResultAction?.id === act.id;
                  const actDesc = act.preco_flat > 0 ? ((act.preco_flat - act.preco_acao) / act.preco_flat) * 100 : 0;

                  return (
                    <div key={act.id} className="flex items-center gap-2 shrink-0 group relative">
                      {/* CARD DO LANÇAMENTO HISTÓRICO COM BADGES E HOVER TOOLTIP */}
                      <div className={`flex flex-col p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isReference 
                          ? "bg-blue-500/5 dark:bg-blue-950/30 border-blue-500/40 shadow-sm" 
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-amber-500/40"
                      }`}>
                        {/* BADGES HEADER (REFERÊNCIA + MELHOR RESULTADO) */}
                        <div className="flex items-center gap-1 mb-1">
                          {isReference && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-500/40">
                              <Bookmark className="w-2.5 h-2.5" /> Referência
                            </span>
                          )}
                          {isBestResult && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40">
                              <Trophy className="w-2.5 h-2.5 text-amber-500" /> Melhor Resultado
                            </span>
                          )}
                        </div>

                        <span className="font-sans font-extrabold text-slate-900 dark:text-slate-100 text-xs">{act.data}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {formatCurrency(act.investimento)} • {formatNumber(act.expectativa_volume)} un
                        </span>

                        {/* TOOLTIP EXECUTIVO (FLUTUANTE NO HOVER) */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 text-xs font-mono space-y-1">
                          <div className="font-sans font-extrabold text-amber-400 text-xs pb-1 mb-1 border-b border-slate-700 flex items-center justify-between">
                            <span>{act.data}</span>
                            {isReference && <span className="text-[9px] font-bold text-blue-400">REFERÊNCIA</span>}
                          </div>
                          <div className="flex justify-between"><span className="text-slate-400 font-sans">Investimento:</span><span className="font-bold">{formatCurrency(act.investimento)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400 font-sans">Preço Promo:</span><span className="font-bold">{formatCurrency(act.preco_acao)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400 font-sans">Desconto:</span><span className="font-bold text-amber-400">{actDesc.toFixed(0)}%</span></div>
                          <div className="flex justify-between"><span className="text-slate-400 font-sans">Volume:</span><span className="font-bold">{formatNumber(act.expectativa_volume)} un</span></div>
                          <div className="flex justify-between"><span className="text-slate-400 font-sans">ROI:</span><span className="font-bold">{act.roi_estimado.toFixed(2)}x</span></div>
                          <div className="flex justify-between"><span className="text-slate-400 font-sans">Eficiência:</span><span className="font-bold">{act.eficiencia_comercial.toFixed(0)} un/R$</span></div>
                          <div className="flex justify-between"><span className="text-slate-400 font-sans">Custo Unidade:</span><span className="font-bold">{formatCurrency(act.custo_unidade)}</span></div>
                        </div>
                      </div>

                      <span className="text-slate-400 font-sans font-bold text-base px-1">➔</span>
                    </div>
                  );
                })}

                {/* CARD DA PROPOSTA ATUAL COM TOOLTIP */}
                <div className="flex flex-col bg-amber-500/15 p-2.5 rounded-xl border border-amber-500/40 shrink-0 group relative cursor-pointer">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-amber-500 text-black">
                      <Sparkles className="w-2.5 h-2.5" /> Nova Proposta
                    </span>
                  </div>
                  <span className="font-sans font-black text-amber-700 dark:text-gold text-xs">PROPOSTA ({currentMonthHeader})</span>
                  <span className="text-[10px] font-bold text-slate-900 dark:text-white font-mono mt-0.5">{formatCurrency(propInv)} • {formatNumber(propVol)} un</span>

                  {/* TOOLTIP EXECUTIVO PROPOSTA ATUAL */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 text-xs font-mono space-y-1">
                    <div className="font-sans font-extrabold text-gold text-xs pb-1 mb-1 border-b border-slate-700">
                      PROPOSTA ATUAL ({currentMonthHeader})
                    </div>
                    <div className="flex justify-between"><span className="text-slate-400 font-sans">Investimento:</span><span className="font-bold text-gold">{formatCurrency(propInv)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-sans">Preço Promo:</span><span className="font-bold">{formatCurrency(propAcao)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-sans">Desconto:</span><span className="font-bold text-gold">{propDesconto.toFixed(0)}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-sans">Volume:</span><span className="font-bold">{formatNumber(propVol)} un</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-sans">ROI:</span><span className="font-bold">{propRoi.toFixed(2)}x</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-sans">Eficiência:</span><span className="font-bold">{propEfic.toFixed(0)} un/R$</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-sans">Custo Unidade:</span><span className="font-bold">{formatCurrency(propCustoUn)}</span></div>
                  </div>
                </div>
              </div>

              {timelineExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                        <th className="py-2 pr-2 font-sans font-bold">LANÇAMENTO</th>
                        <th className="py-2 px-2 text-right">INVESTIMENTO</th>
                        <th className="py-2 px-2 text-right">PREÇO FLAT</th>
                        <th className="py-2 px-2 text-right">PREÇO PROMO</th>
                        <th className="py-2 px-2 text-right">DESCONTO</th>
                        <th className="py-2 px-2 text-right">VOLUME</th>
                        <th className="py-2 pl-2 text-right font-sans">EFICIÊNCIA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-[11px]">
                      {data.actions.map((act: HistoricoItemConsultor) => {
                        const desc = act.preco_flat > 0 ? ((act.preco_flat - act.preco_acao) / act.preco_flat) * 100 : 0;
                        return (
                          <tr key={act.id} className="hover:bg-slate-100 dark:hover:bg-slate-900">
                            <td className="py-2 pr-2 font-sans font-bold text-slate-800 dark:text-slate-200">{act.data}</td>
                            <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">{formatCurrency(act.investimento)}</td>
                            <td className="py-2 px-2 text-right text-slate-500">{formatCurrency(act.preco_flat)}</td>
                            <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">{formatCurrency(act.preco_acao)}</td>
                            <td className="py-2 px-2 text-right text-amber-600 dark:text-gold font-bold">{desc.toFixed(0)}%</td>
                            <td className="py-2 px-2 text-right font-sans text-slate-800 dark:text-slate-200">{formatNumber(act.expectativa_volume)} un</td>
                            <td className="py-2 pl-2 text-right text-amber-600 dark:text-gold font-bold">{act.eficiencia_comercial.toFixed(0)} un/R$</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* PAINEL DE DECISÃO DA DIRETORIA COMERCIAL */}
          <div className="p-5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border border-amber-500/30">
            <div className="flex items-center gap-2 mb-1.5">
              <Award className="w-5 h-5 text-amber-600 dark:text-gold" />
              <h4 className="font-black text-xs md:text-sm text-amber-700 dark:text-gold tracking-wider uppercase">
                Recomendação da Diretoria Comercial
              </h4>
            </div>
            <p className="text-sm md:text-base font-semibold text-slate-800 dark:text-slate-100 leading-relaxed italic pl-7">
              "{recomendacaoDiretor}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
