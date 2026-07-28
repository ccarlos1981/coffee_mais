"use client";

import React from "react";
import { GitCommit, ArrowRight, CheckCircle2 } from "lucide-react";
import { DependencyNode } from "@/lib/governance/architecture";

interface DependencyGraphPanelProps {
  dependencyNodes: DependencyNode[];
}

export const DependencyGraphPanel: React.FC<DependencyGraphPanelProps> = ({ dependencyNodes }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-teal-500/10 text-teal-500">
          <GitCommit className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Grafo de Dependências & Fluxo Arquitetural</h3>
          <p className="text-[11px] text-muted-foreground">
            Desacoplamento estrito entre fontes oficiais, views, engines, APIs e a interface do usuário
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {dependencyNodes.map((node, idx) => (
          <div key={node.name} className="p-3.5 bg-background border border-border rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-500 flex items-center justify-center font-bold text-[10px]">
                  {idx + 1}
                </span>
                <span className="font-bold text-foreground font-sans">{node.name}</span>
              </div>

              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                {node.layer}
              </span>
            </div>

            {node.dependsOn.length > 0 && (
              <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground pt-1 border-t border-border/50">
                <span>Depende de:</span>
                <ArrowRight className="w-3 h-3 text-teal-500" />
                <span className="text-foreground font-semibold">{node.dependsOn.join(", ")}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
