"use client";

import React from "react";
import { Cpu } from "lucide-react";
import { EngineProfileItem } from "@/lib/governance/performance";

interface EngineProfilerProps {
  profiles: EngineProfileItem[];
}

export const EngineProfiler: React.FC<EngineProfilerProps> = ({ profiles }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Profiling de Performance das Engines (Tempo de Execução)</h3>
            <p className="text-[11px] text-muted-foreground">Medição em milissegundos do tempo gasto em cada motor analítico</p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          7/7 Engines Otimizadas
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
        {profiles.map((p) => (
          <div key={p.engine} className="p-3 bg-background border border-border rounded-xl space-y-1.5">
            <div className="flex items-center justify-between font-sans">
              <span className="font-bold text-foreground">{p.name}</span>
              <span className="text-emerald-500 font-bold">{p.avgExecutionMs} ms</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Heap: {p.memoryUsageMb} MB</span>
              <span>Cache: {p.cachedPercentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
