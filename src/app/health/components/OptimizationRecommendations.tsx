"use client";

import React from "react";
import { Sparkles, ShieldCheck } from "lucide-react";
import { OptimizationRecommendationItem } from "@/lib/governance/performance";

interface OptimizationRecommendationsProps {
  recommendations: OptimizationRecommendationItem[];
}

export const OptimizationRecommendations: React.FC<OptimizationRecommendationsProps> = ({ recommendations }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Recomendações de Otimização Segura</h3>
            <p className="text-[11px] text-muted-foreground">Melhorias passivas recomendadas sem alteração de regras de negócio</p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          100% SAFE (READ-ONLY)
        </span>
      </div>

      <div className="space-y-2.5 font-mono text-xs">
        {recommendations.map((rec) => (
          <div key={rec.id} className="p-3.5 bg-background border border-border rounded-xl flex items-center justify-between">
            <div className="space-y-0.5 font-sans">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-muted text-gold font-mono font-bold text-[10px]">
                  {rec.category}
                </span>
                <span className="font-bold text-foreground">{rec.componentOrRoute}</span>
              </div>
              <p className="text-muted-foreground text-[11px]">{rec.description}</p>
            </div>

            <div className="text-right shrink-0">
              <span className="text-emerald-500 font-bold block">+{rec.estimatedGainMs} ms ganho</span>
              <span className="text-[10px] text-muted-foreground">{rec.safetyLevel}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
