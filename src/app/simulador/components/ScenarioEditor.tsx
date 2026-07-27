"use client";

import React from "react";
import { Sliders, Zap, Play } from "lucide-react";
import { SimulationParams } from "@/lib/governance/analytics/simulation";

interface ScenarioEditorProps {
  params: SimulationParams;
  onChange: (newParams: SimulationParams) => void;
  onSimulate: () => void;
  loading?: boolean;
}

export const ScenarioEditor: React.FC<ScenarioEditorProps> = ({
  params,
  onChange,
  onSimulate,
  loading = false,
}) => {
  return (
    <div className="bg-card border border-gold/30 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Editor do Cenário Comercial (Em Memória)</h3>
            <p className="text-[11px] text-muted-foreground">Ajuste os parâmetros da simulação sem gravar dados</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSimulate}
          disabled={loading}
          className="px-4 py-2 bg-gold hover:bg-gold-hover text-stone-900 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Recalcular Simulação
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Nome do Cenário</label>
          <input
            type="text"
            value={params.nomeCenario}
            onChange={(e) => onChange({ ...params, nomeCenario: e.target.value })}
            className="w-full h-9 px-3 bg-background border border-input rounded-xl text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Tipo de Ação</label>
          <select
            value={params.tipoAcao}
            onChange={(e) => onChange({ ...params, tipoAcao: e.target.value as any })}
            className="w-full h-9 px-3 bg-background border border-input rounded-xl text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="RECUPERAR_REDE">Recuperar Rede / Cliente</option>
            <option value="PERDER_REDE">Perda de Conta Estratégica</option>
            <option value="NOVO_CLIENTE">Novo Cliente / Distribuidor</option>
            <option value="ALTERAR_PRECO">Alteração de Tabela de Preço</option>
            <option value="ALTERAR_INVESTIMENTO">Aporte de Investimento Comercial</option>
            <option value="ALTERAR_MIX">Revisão de Mix de Produtos</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase">
            Variação de Faturamento (%)
          </label>
          <input
            type="number"
            step="0.5"
            value={params.variacaoFaturamentoPct}
            onChange={(e) => onChange({ ...params, variacaoFaturamentoPct: Number(e.target.value) })}
            className="w-full h-9 px-3 bg-background border border-input rounded-xl font-mono font-bold text-emerald-500 focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase">
            Investimento Comercial (R$)
          </label>
          <input
            type="number"
            step="10000"
            value={params.investimentoAdicionalR$}
            onChange={(e) => onChange({ ...params, investimentoAdicionalR$: Number(e.target.value) })}
            className="w-full h-9 px-3 bg-background border border-input rounded-xl font-mono font-bold text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};
