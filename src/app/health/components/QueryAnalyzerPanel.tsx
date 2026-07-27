"use client";

import React from "react";
import { Database } from "lucide-react";
import { QueryAnalyzerItem } from "@/lib/governance/performance";

interface QueryAnalyzerPanelProps {
  queries: QueryAnalyzerItem[];
}

export const QueryAnalyzerPanel: React.FC<QueryAnalyzerPanelProps> = ({ queries }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-gold/10 text-gold">
          <Database className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Analisador de Consultas Analíticas & Views</h3>
          <p className="text-[11px] text-muted-foreground">Monitoramento de tempo de leitura e tamanho de payload de fontes oficiais</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left font-mono">
          <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-sans border-b border-border">
            <tr>
              <th className="p-3">Fonte de Dados</th>
              <th className="p-3 text-right">Tempo Leitura Média</th>
              <th className="p-3 text-right">Tamanho Payload</th>
              <th className="p-3 text-right">Frequência (exec/min)</th>
              <th className="p-3 text-right">Status Otimização</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {queries.map((q) => (
              <tr key={q.id} className="hover:bg-muted/30">
                <td className="p-3 font-semibold text-foreground font-sans">{q.querySource}</td>
                <td className="p-3 text-right font-bold text-emerald-500">{q.avgFetchTimeMs} ms</td>
                <td className="p-3 text-right text-muted-foreground">{q.payloadSizeKb} KB</td>
                <td className="p-3 text-right text-gold font-bold">{q.executionFrequencyMin}</td>
                <td className="p-3 text-right">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold text-[10px]">
                    {q.optimizationStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
