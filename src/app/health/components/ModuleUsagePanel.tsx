"use client";

import React from "react";
import { Layers, ArrowUpRight, TrendingUp, CheckCircle2 } from "lucide-react";
import { ModuleAdoptionItem } from "@/lib/governance/telemetry";

interface ModuleUsagePanelProps {
  moduleAdoption: ModuleAdoptionItem[];
}

export const ModuleUsagePanel: React.FC<ModuleUsagePanelProps> = ({ moduleAdoption }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Utilização & Adoção por Módulo (Frente 2)</h3>
            <p className="text-[11px] text-muted-foreground">
              Acessos mensais agregados, usuários únicos ativados e tendência de uso
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
          {moduleAdoption.length} Módulos Auditados
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Módulo</th>
              <th className="py-2.5 px-3">Rota</th>
              <th className="py-2.5 px-3">Acessos Mensais</th>
              <th className="py-2.5 px-3">Usuários Ativos</th>
              <th className="py-2.5 px-3">Tendência</th>
              <th className="py-2.5 px-3 text-right">Índice de Adoção (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground font-mono text-[11px]">
            {moduleAdoption.map((item) => (
              <tr key={item.module} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-bold text-foreground font-sans flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-amber-500" />
                  {item.module}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground">
                  {item.route}
                </td>
                <td className="py-2.5 px-3 font-bold text-foreground">
                  {item.monthlyAccesses.toLocaleString("pt-BR")}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground">
                  {item.uniqueUsersCount}
                </td>
                <td className="py-2.5 px-3 font-sans">
                  <span className="text-emerald-500 font-semibold inline-flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> {item.trend}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-amber-500 font-sans">
                  {item.adoptionIndexPct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
