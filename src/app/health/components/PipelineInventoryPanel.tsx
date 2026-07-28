"use client";

import React from "react";
import { GitBranch, CheckCircle2, Terminal } from "lucide-react";
import { PipelineItem } from "@/lib/governance/devex";

interface PipelineInventoryPanelProps {
  pipelines: PipelineItem[];
}

export const PipelineInventoryPanel: React.FC<PipelineInventoryPanelProps> = ({ pipelines }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Inventário de Pipelines CI/CD</h3>
            <p className="text-[11px] text-muted-foreground">
              Monitoramento dos workflows automatizados de auditoria, testes, tipagem e compilação
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
          {pipelines.length} Workflows Ativos
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Pipeline / Workflow</th>
              <th className="py-2.5 px-3">Comando / Script</th>
              <th className="py-2.5 px-3">Etapa</th>
              <th className="py-2.5 px-3">Tempo Médio</th>
              <th className="py-2.5 px-3 font-mono text-right">Taxa de Sucesso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground font-mono text-[11px]">
            {pipelines.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-bold text-foreground font-sans flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-cyan-500" />
                  {item.name}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground">
                  {item.workflowFile}
                </td>
                <td className="py-2.5 px-3 font-sans">
                  <span className="px-2 py-0.5 rounded bg-muted text-cyan-500 font-bold border border-border/50 text-[10px]">
                    {item.stage}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-bold text-foreground">
                  {item.avgDurationSeconds}s
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-emerald-500 font-sans">
                  {item.successRatePct}% (PASSED)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
