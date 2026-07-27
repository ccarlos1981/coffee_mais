"use client";

import React from "react";
import { Cpu } from "lucide-react";
import { ApiPerformanceMetric } from "@/lib/governance/observability/metrics";

interface ApiPerformanceTableProps {
  metrics: ApiPerformanceMetric[];
}

export const ApiPerformanceTable: React.FC<ApiPerformanceTableProps> = ({ metrics }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-gold/10 text-gold">
          <Cpu className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Latência Detalhada por Rota de API (P95 / P99)</h3>
          <p className="text-[11px] text-muted-foreground">Métricas de tempo de resposta e vazão em tempo real</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left font-mono">
          <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-sans border-b border-border">
            <tr>
              <th className="p-3">Endpoint</th>
              <th className="p-3">Método</th>
              <th className="p-3 text-right">Média (ms)</th>
              <th className="p-3 text-right">P95 (ms)</th>
              <th className="p-3 text-right">P99 (ms)</th>
              <th className="p-3 text-right">Mín/Máx (ms)</th>
              <th className="p-3 text-right">Vazão (req/min)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {metrics.map((row) => (
              <tr key={row.endpoint} className="hover:bg-muted/30">
                <td className="p-3 font-semibold text-foreground font-sans">{row.endpoint}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">
                    {row.method}
                  </span>
                </td>
                <td className="p-3 text-right font-bold text-emerald-500">{row.avgMs} ms</td>
                <td className="p-3 text-right font-bold text-foreground">{row.p95Ms} ms</td>
                <td className="p-3 text-right text-muted-foreground">{row.p99Ms} ms</td>
                <td className="p-3 text-right text-muted-foreground">{row.minMs} / {row.maxMs} ms</td>
                <td className="p-3 text-right font-bold text-gold">{row.throughputReqMin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
