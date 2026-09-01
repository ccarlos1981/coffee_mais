"use client";

import React from "react";
import { Plus, Trash2, Calendar, Tag, DollarSign, BarChart2, Copy, Sparkles } from "lucide-react";
import { AcaoComercialItem } from "@/lib/investimento/plano-financeiro-service";

interface MultiplasAcoesSectionProps {
  acoes: AcaoComercialItem[];
  onChangeAcoes: (acoes: AcaoComercialItem[]) => void;
  familiasDisponiveis: Array<{ id: string; nome: string }>;
  redeNome: string;
  disabled?: boolean;
}

export function MultiplasAcoesSection({
  acoes,
  onChangeAcoes,
  familiasDisponiveis,
  redeNome,
  disabled = false
}: MultiplasAcoesSectionProps) {
  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const parseNum = (str: any) => {
    if (typeof str === "number") return str;
    if (!str) return 0;
    const clean = String(str).replace(/[R\$\s\.]/g, "").replace(",", ".");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  // Adicionar nova ação em branco
  const handleAddAcao = () => {
    const defaultFam = familiasDisponiveis[0] || { id: "linhas_especiais", nome: "Linhas Especiais" };
    const hoje = new Date();
    const dataInicio = hoje.toISOString().slice(0, 10);
    const dataFim = new Date(hoje.setDate(hoje.getDate() + 30)).toISOString().slice(0, 10);

    const nova: AcaoComercialItem = {
      familia_id: defaultFam.id,
      familia_nome: defaultFam.nome,
      data_inicio: dataInicio,
      data_fim: dataFim,
      preco_flat: 0,
      preco_acao: 0,
      valor_investimento: 0,
      expectativa_volume: 1,
      abrangencia: "Família",
      tipo_pagamento: "Transf. Bancária",
      tipo_acao: "Vendas",
      tipo_acao_detalhe: "Ação de Vendas",
      is_materializada_futura: false
    };

    onChangeAcoes([...acoes, nova]);
  };

  // Replicar ação para meses futuros (Materialização Futura)
  const handleReplicarFuturo = (idxOrigem: number) => {
    const acaoOrig = acoes[idxOrigem];
    if (!acaoOrig) return;

    // Calcular próximo mês a partir da data de início da ação original
    const dInicio = new Date(acaoOrig.data_inicio || new Date());
    dInicio.setMonth(dInicio.getMonth() + 1);
    const proxInicio = dInicio.toISOString().slice(0, 10);

    const dFim = new Date(acaoOrig.data_fim || new Date());
    dFim.setMonth(dFim.getMonth() + 1);
    const proxFim = dFim.toISOString().slice(0, 10);

    const mesRef = `${dInicio.getFullYear()}-${String(dInicio.getMonth() + 1).padStart(2, "0")}`;

    const replicada: AcaoComercialItem = {
      ...acaoOrig,
      id: undefined,
      data_inicio: proxInicio,
      data_fim: proxFim,
      mes_referencia: mesRef,
      is_materializada_futura: true,
      acao_origem_recorrencia_id: acaoOrig.id || null
    };

    onChangeAcoes([...acoes, replicada]);
  };

  // Remover ação
  const handleRemoveAcao = (idx: number) => {
    if (acoes.length <= 1) return;
    onChangeAcoes(acoes.filter((_, i) => i !== idx));
  };

  // Atualizar campo de uma ação
  const handleUpdateAcao = (idx: number, campo: keyof AcaoComercialItem, valor: any) => {
    const updated = [...acoes];
    const item = { ...updated[idx] };

    if (campo === "familia_nome") {
      item.familia_nome = valor;
      item.familia_id = valor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
    } else if (campo === "preco_flat" || campo === "preco_acao" || campo === "expectativa_volume") {
      const num = parseNum(valor);
      (item as any)[campo] = num;
      // Auto-calcular valor_investimento = (preco_flat - preco_acao) * volume
      if (item.preco_flat && item.preco_acao && item.preco_flat > item.preco_acao) {
        const unitInv = item.preco_flat - item.preco_acao;
        item.valor_investimento = Math.round(unitInv * (item.expectativa_volume || 1) * 100) / 100;
      }
    } else if (campo === "valor_investimento") {
      item.valor_investimento = parseNum(valor);
    } else {
      (item as any)[campo] = valor;
    }

    updated[idx] = item;
    onChangeAcoes(updated);
  };

  return (
    <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Ações Comerciais da Negociação ({acoes.length})
            </h3>
            <p className="text-xs text-muted">
              Configure múltiplos períodos ou famílias para a rede <strong className="text-foreground">{redeNome || "selecionada"}</strong>
            </p>
          </div>
        </div>

        {!disabled && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddAcao}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gold text-black rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Adicionar Ação / Período
            </button>
          </div>
        )}
      </div>

      {/* Grid de Cards de Ações */}
      <div className="space-y-3">
        {acoes.map((acao, idx) => {
          const custoTotal = Number(acao.valor_investimento) || 0;

          return (
            <div
              key={idx}
              className={`p-4 rounded-xl border transition-all ${
                acao.is_materializada_futura
                  ? "bg-purple-950/20 border-purple-500/40"
                  : "bg-elevated/40 border-border hover:border-gold/40"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-elevated border border-border flex items-center justify-center text-xs font-black text-gold">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-foreground">
                    Ação #{idx + 1} — {acao.familia_nome || "Família Geral"}
                  </span>
                  {acao.is_materializada_futura && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Materializada Futura
                    </span>
                  )}
                </div>

                {!disabled && (
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => handleReplicarFuturo(idx)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-elevated border border-border text-[11px] text-muted hover:text-purple-300 hover:border-purple-500/50 transition-colors"
                      title="Replicar esta ação para o próximo mês"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Replicar p/ Mês Futuro
                    </button>
                    {acoes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAcao(idx)}
                        className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remover esta ação"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Form Fields da Ação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {/* Família */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted">Família de Produto</label>
                  {disabled ? (
                    <div className="text-xs font-semibold text-foreground py-1.5">{acao.familia_nome}</div>
                  ) : (
                    <select
                      value={acao.familia_nome}
                      onChange={(e) => handleUpdateAcao(idx, "familia_nome", e.target.value)}
                      className="w-full bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold"
                    >
                      {familiasDisponiveis.map((f) => (
                        <option key={f.id} value={f.nome}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Período Início */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted">Data Início</label>
                  {disabled ? (
                    <div className="text-xs text-foreground py-1.5">{acao.data_inicio}</div>
                  ) : (
                    <input
                      type="date"
                      value={acao.data_inicio}
                      onChange={(e) => handleUpdateAcao(idx, "data_inicio", e.target.value)}
                      className="w-full bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold [color-scheme:dark]"
                    />
                  )}
                </div>

                {/* Período Fim */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted">Data Fim</label>
                  {disabled ? (
                    <div className="text-xs text-foreground py-1.5">{acao.data_fim}</div>
                  ) : (
                    <input
                      type="date"
                      value={acao.data_fim}
                      onChange={(e) => handleUpdateAcao(idx, "data_fim", e.target.value)}
                      className="w-full bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold [color-scheme:dark]"
                    />
                  )}
                </div>

                {/* Expectativa Volume */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted">Volume Previsto</label>
                  {disabled ? (
                    <div className="text-xs text-foreground py-1.5">{acao.expectativa_volume} un</div>
                  ) : (
                    <input
                      type="number"
                      value={acao.expectativa_volume || ""}
                      onChange={(e) => handleUpdateAcao(idx, "expectativa_volume", e.target.value)}
                      placeholder="1"
                      className="w-full bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold"
                    />
                  )}
                </div>

                {/* Investimento Total desta Ação */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-gold">Investimento da Ação</label>
                  {disabled ? (
                    <div className="text-xs font-bold text-gold py-1.5">{formatCurrency(custoTotal)}</div>
                  ) : (
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-2 w-3.5 h-3.5 text-gold" />
                      <input
                        type="number"
                        step="0.01"
                        value={acao.valor_investimento || ""}
                        onChange={(e) => handleUpdateAcao(idx, "valor_investimento", e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-elevated border border-border rounded-lg pl-7 pr-2.5 py-1.5 text-xs font-bold text-gold focus:outline-none focus:border-gold"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
