"use client";

import React from "react";
import { Lightbulb, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { SecurityRecommendation } from "@/lib/governance/security";

interface ComplianceRecommendationsProps {
  recommendations: SecurityRecommendation[];
}

export const ComplianceRecommendations: React.FC<ComplianceRecommendationsProps> = ({ recommendations }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-gold/10 text-gold">
          <Lightbulb className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Recomendações de Hardening & Governança</h3>
          <p className="text-[11px] text-muted-foreground">
            Diretrizes técnicas de segurança para preservação da baseline enterprise
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {recommendations.map((rec) => (
          <div key={rec.id} className="p-4 bg-background border border-border rounded-xl space-y-2 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted-foreground uppercase">{rec.category}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    rec.priority === "HIGH"
                      ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                      : rec.priority === "MEDIUM"
                      ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                      : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  }`}
                >
                  {rec.priority}
                </span>
              </div>

              <h4 className="text-xs font-bold text-foreground">{rec.title}</h4>
              <p className="text-[11px] text-muted-foreground">{rec.action}</p>
            </div>

            <div className="pt-2 border-t border-border/50 text-[10px] font-mono text-emerald-500 flex items-center justify-between">
              <span>Impacto: {rec.impact}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
