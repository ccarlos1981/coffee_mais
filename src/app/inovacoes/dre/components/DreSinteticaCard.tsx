"use client";

import React from "react";
import { Calculator, ShieldCheck } from "lucide-react";
import { DreComercialData } from "@/lib/governance/analytics/engine";

/**
 * Estrutura de dados para despesas operacionais auditadas das planilhas da Cia.
 * NOTA DE GOVERNANÇA: Estes valores são provenientes da fonte primária 'dre gerencial 06-08-26 julho_oficial.xlsx'
 * e NÃO fazem parte das fórmulas do DRE Core (MACO Core).
 */
export const AUDITED_EXTERNAL_OPERATIONAL_EXPENSES: Record<
  string,
  { despesaPessoal: number; marketing: number }
> = {
  "2026-07": {
    despesaPessoal: 733385.18,
    marketing: 298216.94,
  },
  "2026-06": {
    despesaPessoal: 763342.58,
    marketing: 285497.92,
  },
};

interface DreSinteticaCardProps {
  sintetica?: DreComercialData["sintetica"];
  totais?: DreComercialData["totais"];
  dimensionais?: DreComercialData["dimensionais"];
  period?: string;
  loading?: boolean;
}

export const DreSinteticaCard: React.FC<DreSinteticaCardProps> = ({
  totais,
  dimensionais = [],
  period = "2026-07",
  loading = false,
}) => {
  const formatCur = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  const formatUnit = (val: number | null | undefined, unit: string) => {
    if (val === null || val === undefined) return "—";
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(val)} ${unit}`;
  };

  const formatPct = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "—";
    return `${val.toFixed(2)}%`;
  };

  // Valores oficiais do DRE Core
  const faturamentoBruto = totais?.faturamentoBruto ?? 0;
  const faturamentoLiquido = totais?.faturamentoLiquido ?? 0;
  const impostos = totais?.impostos ?? 0;
  const cpv = totais?.cpv ?? 0;
  const margemBruta = totais?.margemBruta ?? 0;
  const frete = totais?.frete ?? 0;
  const investimentoComercial = totais?.investimentoComercial ?? 0;
  const macoTotal = totais?.macoTotal ?? 0;

  // Obter despesas externas auditadas para o período selecionado
  const activeExpenses = period ? AUDITED_EXTERNAL_OPERATIONAL_EXPENSES[period] : AUDITED_EXTERNAL_OPERATIONAL_EXPENSES["2026-07"];
  const despesaPessoal = activeExpenses?.despesaPessoal ?? null;
  const marketing = activeExpenses?.marketing ?? null;

  // Calculo de Volume Total (Kg e Tons) a partir das dimensionais ativas
  const volumeTotalKg = dimensionais.reduce((acc, item) => acc + (item.volume || 0), 0);
  const volumeTotalTons = volumeTotalKg > 0 ? volumeTotalKg / 1000 : 0;

  // Indicadores Derivados Oficiais
  const mcKg = volumeTotalKg > 0 ? macoTotal / volumeTotalKg : null;
  const mcNsPct = faturamentoLiquido > 0 ? (macoTotal / faturamentoLiquido) * 100 : null;
  const mbKg = volumeTotalKg > 0 ? margemBruta / volumeTotalKg : null;
  const mbNsPct = faturamentoLiquido > 0 ? (margemBruta / faturamentoLiquido) * 100 : null;

  // Estrutura P&L Vertical (21 linhas oficiais)
  const plRows = [
    { num: 1, label: "1. Volume (Tons)", valorStr: volumeTotalTons > 0 ? formatUnit(volumeTotalTons, "Tons") : "—", pctStr: "—", tipo: "METRICA" },
    { num: 2, label: "2. Receita Bruta", valor: faturamentoBruto, pctNS: faturamentoLiquido > 0 ? (faturamentoBruto / faturamentoLiquido) * 100 : 100, tipo: "RECEITA" },
    { num: 3, label: "3. Impostos (ICMS + ST)", valor: impostos, pctNS: faturamentoLiquido > 0 ? (impostos / faturamentoLiquido) * 100 : 0, tipo: "DEDUCAO" },
    { num: 4, label: "4. Investimentos Comerciais / Trade", valor: investimentoComercial, pctNS: faturamentoLiquido > 0 ? (investimentoComercial / faturamentoLiquido) * 100 : 0, tipo: "DEDUCAO" },
    { num: 5, label: "5. Receita Líquida", valor: faturamentoLiquido, pctNS: 100, tipo: "SUBTOTAL", highlight: true },
    { num: 6, label: "6. Custo de Produtos (CPV)", valor: cpv, pctNS: faturamentoLiquido > 0 ? (cpv / faturamentoLiquido) * 100 : 0, tipo: "CUSTO" },
    { num: 7, label: "7. Fretes (3,00% Fixo)", valor: frete, pctNS: faturamentoLiquido > 0 ? (frete / faturamentoLiquido) * 100 : 3, tipo: "CUSTO" },
    { num: 8, label: "8. Despesa de Exportação", valorStr: "—", pctStr: "—", tipo: "NAO_DISPONIVEL", info: "N/D" },
    { num: 9, label: "9. Margem de Contribuição (MACO)", valor: macoTotal, pctNS: mcNsPct, tipo: "RESULTADO", highlight: true },
    { num: 10, label: "10. GGF", valorStr: "—", pctStr: "—", tipo: "NAO_DISPONIVEL", info: "N/D" },
    { num: 11, label: "11. Depreciação", valorStr: "—", pctStr: "—", tipo: "NAO_DISPONIVEL", info: "N/D" },
    { num: 12, label: "12. Armazenagem", valorStr: "—", pctStr: "—", tipo: "NAO_DISPONIVEL", info: "N/D" },
    { num: 13, label: "13. Margem Bruta", valor: margemBruta, pctNS: mbNsPct, tipo: "SUBTOTAL", highlight: true },
    {
      num: 14,
      label: "14. Despesa Pessoal",
      valor: despesaPessoal !== null ? despesaPessoal : undefined,
      valorStr: despesaPessoal === null ? "—" : undefined,
      pctNS: despesaPessoal !== null && faturamentoLiquido > 0 ? (despesaPessoal / faturamentoLiquido) * 100 : null,
      tipo: despesaPessoal !== null ? "DESPESA_EXTERNA" : "NAO_DISPONIVEL",
      badgeText: despesaPessoal !== null ? "Planilha Cia" : "N/D",
    },
    {
      num: 15,
      label: "15. Marketing",
      valor: marketing !== null ? marketing : undefined,
      valorStr: marketing === null ? "—" : undefined,
      pctNS: marketing !== null && faturamentoLiquido > 0 ? (marketing / faturamentoLiquido) * 100 : null,
      tipo: marketing !== null ? "DESPESA_EXTERNA" : "NAO_DISPONIVEL",
      badgeText: marketing !== null ? "Planilha Cia" : "N/D",
    },
    { num: 16, label: "16. Margem de Mercado", valorStr: "—", pctStr: "—", tipo: "NAO_DISPONIVEL", info: "N/D" },
    { num: 17, label: "17. MC / Kg", valorStr: mcKg !== null ? `${formatCur(mcKg)} / Kg` : "—", pctStr: "—", tipo: "DERIVADO" },
    { num: 18, label: "18. % MC NS", valorStr: formatPct(mcNsPct), pctStr: "—", tipo: "DERIVADO" },
    { num: 19, label: "19. MB / Kg", valorStr: mbKg !== null ? `${formatCur(mbKg)} / Kg` : "—", pctStr: "—", tipo: "DERIVADO" },
    { num: 20, label: "20. % MB NS", valorStr: formatPct(mbNsPct), pctStr: "—", tipo: "DERIVADO" },
    { num: 21, label: "21. MM / Kg", valorStr: "—", pctStr: "—", tipo: "NAO_DISPONIVEL", info: "N/D" },
  ];

  const getRowStyle = (row: typeof plRows[0]) => {
    if (row.highlight) {
      if (row.num === 9) return "bg-gold/15 border-gold/40 font-extrabold text-foreground";
      if (row.num === 5) return "bg-emerald-500/10 border-emerald-500/30 font-bold text-foreground";
      if (row.num === 13) return "bg-amber-500/10 border-amber-500/30 font-bold text-foreground";
    }
    if (row.tipo === "RESULTADO") return "bg-gold/10 font-bold text-foreground";
    if (row.tipo === "SUBTOTAL") return "bg-muted/40 font-bold text-foreground";
    if (row.tipo === "DESPESA_EXTERNA") return "bg-amber-500/5 font-medium text-foreground";
    if (row.tipo === "NAO_DISPONIVEL") return "text-muted-foreground/60 opacity-60";
    if (row.tipo === "DERIVADO") return "bg-muted/10 font-medium text-foreground";
    return "text-foreground hover:bg-muted/20";
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gold/10 text-gold border border-gold/20">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Demonstração de Resultado (P&L Vertical Executivo)</h3>
            <p className="text-xs text-muted-foreground">
              Estrutura sequencial de 21 linhas de resultado e indicadores de margem comercial
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-lg border border-border/50">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-mono text-[10px] font-semibold">DRE_CORE = LOCKED</span>
        </div>
      </div>

      {/* Tabela P&L Vertical */}
      <div className="overflow-x-auto rounded-xl border border-border">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
            <div className="animate-spin w-5 h-5 border-2 border-gold border-t-transparent rounded-full mx-auto" />
            <span>Processando estrutura do P&L Executivo...</span>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <th className="py-2.5 px-4 font-bold">Métrica / Linha P&L</th>
                <th className="py-2.5 px-4 font-bold text-right">Valor R$ / Medida</th>
                <th className="py-2.5 px-4 font-bold text-right">% Receita Líquida (% NS)</th>
                <th className="py-2.5 px-4 font-bold text-center w-28">Status Fonte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono">
              {plRows.map((row) => {
                const valorDisplay =
                  row.valorStr !== undefined
                    ? row.valorStr
                    : row.valor !== undefined
                    ? formatCur(row.valor)
                    : "—";

                const pctDisplay =
                  row.pctStr !== undefined
                    ? row.pctStr
                    : row.pctNS !== undefined && row.pctNS !== null
                    ? formatPct(row.pctNS)
                    : "—";

                return (
                  <tr key={row.num} className={`transition-colors ${getRowStyle(row)}`}>
                    <td className="py-2.5 px-4 font-sans font-medium">{row.label}</td>
                    <td className="py-2.5 px-4 text-right font-bold">{valorDisplay}</td>
                    <td className="py-2.5 px-4 text-right">{pctDisplay}</td>
                    <td className="py-2.5 px-4 text-center">
                      {"badgeText" in row && row.badgeText ? (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-bold">
                          {row.badgeText}
                        </span>
                      ) : row.tipo === "NAO_DISPONIVEL" ? (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[9px] font-bold">
                          {"info" in row ? row.info : "N/D"}
                        </span>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[9px] font-bold">
                          Oficial
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
