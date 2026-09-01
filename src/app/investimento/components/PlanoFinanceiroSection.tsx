"use client";

import React, { useState, useEffect } from "react";
import { DollarSign, Calendar, CreditCard, AlertCircle, CheckCircle2, RefreshCw, Layers } from "lucide-react";
import { ParcelaFinanceira, gerarGradeParcelasIguais } from "@/lib/investimento/plano-financeiro-service";

interface PlanoFinanceiroSectionProps {
  totalAcoes: number;
  dataInicioGlobal: string;
  tipoPagamentoGlobal: string;
  parcelas: ParcelaFinanceira[];
  onChangeParcelas: (parcelas: ParcelaFinanceira[]) => void;
  disabled?: boolean;
}

export function PlanoFinanceiroSection({
  totalAcoes,
  dataInicioGlobal,
  tipoPagamentoGlobal,
  parcelas,
  onChangeParcelas,
  disabled = false
}: PlanoFinanceiroSectionProps) {
  const [tipoPlano, setTipoPlano] = useState<"A_VISTA" | "PARCELADO">(() => {
    return parcelas.length > 1 ? "PARCELADO" : "A_VISTA";
  });
  const [qtdParcelas, setQtdParcelas] = useState<number>(() => {
    return parcelas.length > 1 ? parcelas.length : 2;
  });

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const parseCurrencyInput = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/[R\$\s\.]/g, "").replace(",", ".");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  // Soma total das parcelas atuais
  const totalParcelas = Math.round(
    parcelas.reduce((acc, p) => acc + (Number(p.valor_previsto) || 0), 0) * 100
  ) / 100;

  const diferenca = Math.round((totalAcoes - totalParcelas) * 100) / 100;
  const isEquilibrado = Math.abs(diferenca) < 0.01;

  // Inicialização / Troca de modalidade
  const handleTrocarModalidade = (novaModalidade: "A_VISTA" | "PARCELADO") => {
    setTipoPlano(novaModalidade);
    if (novaModalidade === "A_VISTA") {
      onChangeParcelas([{
        numero_parcela: 1,
        total_parcelas: 1,
        valor_previsto_original: totalAcoes,
        valor_previsto: totalAcoes,
        valor_pago_acumulado: 0,
        saldo_remanescente: totalAcoes,
        data_vencimento: dataInicioGlobal || new Date().toISOString().slice(0, 10),
        tipo_pagamento: tipoPagamentoGlobal || "Transf. Bancária",
        status_parcela: "PENDENTE"
      }]);
    } else {
      const grade = gerarGradeParcelasIguais(
        totalAcoes,
        qtdParcelas,
        dataInicioGlobal || new Date().toISOString().slice(0, 10),
        tipoPagamentoGlobal
      );
      onChangeParcelas(grade);
    }
  };

  // Recalcular grade com a quantidade selecionada
  const handleRecalcularGrade = (novaQtd: number) => {
    setQtdParcelas(novaQtd);
    const grade = gerarGradeParcelasIguais(
      totalAcoes,
      novaQtd,
      dataInicioGlobal || new Date().toISOString().slice(0, 10),
      tipoPagamentoGlobal
    );
    onChangeParcelas(grade);
  };

  // Atualização individual de campo da parcela
  const handleUpdateParcela = (idx: number, campo: keyof ParcelaFinanceira, valor: any) => {
    const updated = [...parcelas];
    const item = { ...updated[idx] };

    if (campo === "valor_previsto") {
      const numVal = typeof valor === "number" ? valor : parseCurrencyInput(valor);
      item.valor_previsto = numVal;
      item.valor_previsto_original = numVal;
      item.saldo_remanescente = Math.max(0, numVal - (item.valor_pago_acumulado || 0));
    } else {
      (item as any)[campo] = valor;
    }

    updated[idx] = item;
    onChangeParcelas(updated);
  };

  // Ajustar centavos automaticamente na última parcela
  const handleAutoAjusteCentavos = () => {
    if (parcelas.length === 0 || isEquilibrado) return;
    const updated = [...parcelas];
    const ultimaIdx = updated.length - 1;
    const somaExcetoUltima = updated.slice(0, ultimaIdx).reduce((acc, p) => acc + p.valor_previsto, 0);
    const valorAjustado = Math.max(0, Math.round((totalAcoes - somaExcetoUltima) * 100) / 100);

    updated[ultimaIdx] = {
      ...updated[ultimaIdx],
      valor_previsto: valorAjustado,
      valor_previsto_original: valorAjustado,
      saldo_remanescente: valorAjustado
    };
    onChangeParcelas(updated);
  };

  return (
    <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Plano Financeiro & Pagamento</h3>
            <p className="text-xs text-muted">
              Defina como a negociação comercial será liquidada financeiramente
            </p>
          </div>
        </div>

        {/* Toggle À Vista / Parcelado */}
        {!disabled && (
          <div className="flex items-center bg-elevated border border-border p-1 rounded-xl">
            <button
              type="button"
              onClick={() => handleTrocarModalidade("A_VISTA")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tipoPlano === "A_VISTA"
                  ? "bg-gold text-black shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              À Vista (1x)
            </button>
            <button
              type="button"
              onClick={() => handleTrocarModalidade("PARCELADO")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tipoPlano === "PARCELADO"
                  ? "bg-gold text-black shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Parcelado (2x - 12x)
            </button>
          </div>
        )}
      </div>

      {/* Seletor de Parcelas */}
      {tipoPlano === "PARCELADO" && !disabled && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-elevated/50 border border-border/60 rounded-xl">
          <span className="text-xs font-medium text-muted flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-gold" />
            Número de Prestações:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleRecalcularGrade(n)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  qtdParcelas === n
                    ? "bg-gold/20 border border-gold text-gold"
                    : "bg-elevated border border-border text-muted hover:text-foreground"
                }`}
              >
                {n}x
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleRecalcularGrade(qtdParcelas)}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 text-xs text-muted hover:text-gold transition-colors"
            title="Redistribuir parcelas igualmente"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Redistribuir
          </button>
        </div>
      )}

      {/* Tabela de Grade de Parcelas */}
      <div className="overflow-x-auto border border-border/60 rounded-xl bg-elevated/30">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/60 bg-elevated text-muted">
              <th className="py-2.5 px-3 font-semibold w-16 text-center">#</th>
              <th className="py-2.5 px-3 font-semibold min-w-[130px]">Vencimento</th>
              <th className="py-2.5 px-3 font-semibold min-w-[140px]">Valor Previsto</th>
              <th className="py-2.5 px-3 font-semibold min-w-[150px]">Forma de Pagamento</th>
              <th className="py-2.5 px-3 font-semibold">Observações / Referência</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {parcelas.map((parc, idx) => (
              <tr key={idx} className="hover:bg-elevated/60 transition-colors">
                <td className="py-2.5 px-3 text-center font-bold text-muted">
                  {parc.numero_parcela}/{parc.total_parcelas}
                </td>
                <td className="py-2.5 px-3">
                  {disabled ? (
                    <span className="font-medium text-foreground">{parc.data_vencimento}</span>
                  ) : (
                    <input
                      type="date"
                      value={parc.data_vencimento}
                      onChange={(e) => handleUpdateParcela(idx, "data_vencimento", e.target.value)}
                      className="w-full bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold [color-scheme:dark]"
                    />
                  )}
                </td>
                <td className="py-2.5 px-3">
                  {disabled ? (
                    <span className="font-bold text-gold">{formatCurrency(parc.valor_previsto)}</span>
                  ) : (
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-2 w-3.5 h-3.5 text-gold" />
                      <input
                        type="text"
                        value={parc.valor_previsto ? formatCurrency(parc.valor_previsto).replace("R$", "").trim() : ""}
                        onChange={(e) => handleUpdateParcela(idx, "valor_previsto", e.target.value)}
                        placeholder="0,00"
                        className="w-full bg-elevated border border-border rounded-lg pl-7 pr-2.5 py-1.5 text-xs font-bold text-gold focus:outline-none focus:border-gold"
                      />
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  {disabled ? (
                    <span className="text-foreground">{parc.tipo_pagamento}</span>
                  ) : (
                    <select
                      value={parc.tipo_pagamento}
                      onChange={(e) => handleUpdateParcela(idx, "tipo_pagamento", e.target.value)}
                      className="w-full bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold"
                    >
                      <option value="Transf. Bancária">Transf. Bancária</option>
                      <option value="Abatimento em Duplicata">Abatimento em Duplicata</option>
                      <option value="Bonificação em Mercadoria">Bonificação em Mercadoria</option>
                      <option value="Outros">Outros</option>
                    </select>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  {disabled ? (
                    <span className="text-muted text-[11px]">{parc.observacoes || "—"}</span>
                  ) : (
                    <input
                      type="text"
                      value={parc.observacoes || ""}
                      onChange={(e) => handleUpdateParcela(idx, "observacoes", e.target.value)}
                      placeholder="Ex: Parcela 1 após apuração do sell-out"
                      className="w-full bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted/50 focus:outline-none focus:border-gold"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Barra de Reconciliação e Validação */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
        isEquilibrado
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          : "bg-red-500/10 border-red-500/30 text-red-400"
      }`}>
        <div className="flex items-center gap-2.5">
          {isEquilibrado ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
          )}
          <div>
            <div className="text-xs font-bold">
              {isEquilibrado
                ? "Plano Financeiro 100% Equilibrado"
                : `Divergência Financeira: ${formatCurrency(diferenca)}`}
            </div>
            <div className="text-[11px] opacity-80">
              {isEquilibrado
                ? "A soma das parcelas coincide perfeitamente com o total das ações comerciais."
                : "A soma das parcelas deve ser exatamente igual ao total investido nas ações."}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <span className="text-muted text-[10px] block font-sans">Total Ações:</span>
            <span className="font-bold text-foreground">{formatCurrency(totalAcoes)}</span>
          </div>
          <div className="text-right">
            <span className="text-muted text-[10px] block font-sans">Total Parcelas:</span>
            <span className={`font-bold ${isEquilibrado ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(totalParcelas)}
            </span>
          </div>

          {!isEquilibrado && !disabled && (
            <button
              type="button"
              onClick={handleAutoAjusteCentavos}
              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 rounded-lg text-xs font-bold transition-colors"
            >
              Ajustar Diferença
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
