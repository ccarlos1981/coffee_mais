"use client";

import React, { useState } from "react";
import { MessageSquare, HelpCircle, Sparkles } from "lucide-react";

interface AssistantSuggestedQueriesProps {
  onSelectQuery: (query: string) => void;
  loading?: boolean;
}

export const CATEGORIZED_QUERIES: Record<string, string[]> = {
  FORECAST: [
    "Quanto vamos fechar este mês?",
    "Qual o PACE atualizado de vendas?",
    "Qual a necessidade média diária até o último dia útil?",
    "Qual o faturamento projetado até o último dia do mês?"
  ],
  METAS: [
    "Quanto falta para bater a meta?",
    "Quem está acima da meta?",
    "Quem está abaixo da meta?",
    "Todas as metas por rede estão conciliadas?"
  ],
  DISTRIBUIDORES: [
    "Quais distribuidores precisam de atenção hoje?",
    "Qual distribuidor tem a maior oportunidade de faturamento?",
    "Qual a receita acumulada do canal Distribuição?",
    "Qual o distribuidor de maior volume no trimestre?"
  ],
  MARGEM: [
    "Quais clientes estão perdendo margem?",
    "Onde estamos perdendo margem este mês?",
    "Qual a margem MACO % média atual?",
    "Qual regional apresenta a menor margem de contribuição?"
  ],
  MACO: [
    "Qual o MACO total gerado no mês?",
    "Qual gerente entregou o maior MACO em R$?",
    "Qual a diferença de MACO entre Key Account e Distribuição?",
    "Qual a família de produtos com maior MACO %?"
  ],
  CLIENTES: [
    "Quais clientes reduziram compra este mês?",
    "Quem cresceu mais no comparativo mensal?",
    "Quais redes Top 10 não compraram este mês?",
    "Qual o número de clientes ativos na carteira?"
  ],
  GERENTES: [
    "Quem está pior entre os gerentes?",
    "Qual gerente está abaixo do PACE?",
    "Quanto o Gerente Luiz precisa vender por dia para bater a meta?",
    "Qual o ranking de gerentes por faturamento acumulado?"
  ],
  REGIONAIS: [
    "Qual regional está mais saudável?",
    "Qual a receita acumulada da Regional Sul vs Sudeste?",
    "Qual estado (UF) apresenta o maior crescimento no mês?",
    "Onde devemos aumentar a cobertura comercial?"
  ],
  TRADE: [
    "Quais ações de trade têm o maior ROI?",
    "Vale mais investir em Trade ou dar desconto comercial?",
    "Qual a verba de investimento comercial alocada no mês?",
    "Qual a taxa de retorno sobre investimento em encartes?"
  ],
  RENTABILIDADE: [
    "Qual o preço médio (R$/Kg) praticado no mês?",
    "Qual canal possui o maior preço médio por quilo?",
    "Qual o impacto do aumento de 3% no preço sobre o volume?",
    "Qual a família de SKU com maior rentabilidade por embalagem?"
  ],
  RISCOS: [
    "Quais são os 5 maiores riscos da carteira hoje?",
    "Qual a perda potencial de faturamento se a Rede X não comprar?",
    "Quais distribuidores estão com risco de ruptura de estoque?",
    "Qual o score geral de saúde comercial da empresa?"
  ],
  SIMULAÇÕES: [
    "Qual o impacto de adicionar um novo distribuidor no Sul?",
    "Qual o ROI simulado para um investimento de R$ 50k em Trade?",
    "O que acontece com o faturamento se a margem subir 2%?",
    "Qual a melhor estratégia para recuperar a meta do mês?"
  ]
};

export const AssistantSuggestedQueries: React.FC<AssistantSuggestedQueriesProps> = ({
  onSelectQuery,
  loading = false,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>("FORECAST");
  const categories = Object.keys(CATEGORIZED_QUERIES);

  return (
    <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gold" />
          <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">
            Biblioteca por Categoria (~80 Perguntas Estruturadas)
          </h3>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">12 Categorias Comercial</span>
      </div>

      {/* Categorias Deslizantes */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap border ${
              activeCategory === cat
                ? "bg-gold text-stone-900 border-gold shadow-sm"
                : "bg-secondary/40 text-muted-foreground border-border hover:border-border/80 hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Perguntas da Categoria Ativa */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {CATEGORIZED_QUERIES[activeCategory]?.map((query, idx) => (
          <button
            key={idx}
            onClick={() => onSelectQuery(query)}
            disabled={loading}
            className="p-2.5 rounded-xl bg-secondary/30 border border-border hover:border-gold hover:bg-secondary/60 text-left transition-all disabled:opacity-50 text-xs font-medium text-foreground flex items-center justify-between group"
          >
            <span className="leading-snug">{query}</span>
            <Sparkles className="w-3.5 h-3.5 text-gold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
    </div>
  );
};
