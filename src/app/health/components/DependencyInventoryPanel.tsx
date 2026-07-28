"use client";

import React from "react";
import { Package, CheckCircle2, ArrowUpRight, ShieldCheck } from "lucide-react";
import { DependencyInventoryItem } from "@/lib/governance/security";

interface DependencyInventoryPanelProps {
  dependencyInventory: DependencyInventoryItem[];
}

export const DependencyInventoryPanel: React.FC<DependencyInventoryPanelProps> = ({ dependencyInventory }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Inventário Oficial de Dependências & Licenças</h3>
            <p className="text-[11px] text-muted-foreground">
              Mapeamento de pacotes do projeto, versões atuais, manutenção e licenças (Frente 5)
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold text-cyan-500 bg-cyan-500/10 px-2.5 py-1 rounded-xl border border-cyan-500/20">
          {dependencyInventory.length} Pacotes Mapeados
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Biblioteca / Pacote</th>
              <th className="py-2.5 px-3">Versão Atual</th>
              <th className="py-2.5 px-3">Última Versão</th>
              <th className="py-2.5 px-3">Licença</th>
              <th className="py-2.5 px-3">Manutenção</th>
              <th className="py-2.5 px-3 text-right">Atualização Disponível</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground font-mono text-[11px]">
            {dependencyInventory.map((item) => (
              <tr key={item.name} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-bold text-foreground font-sans flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-muted-foreground" />
                  {item.name}
                </td>
                <td className="py-2.5 px-3 text-emerald-500 font-bold">
                  v{item.currentVersion}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground">
                  v{item.latestVersion}
                </td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded bg-muted text-foreground text-[10px] border border-border/50 font-sans">
                    {item.license}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <span className="text-emerald-500 font-sans font-semibold">
                    {item.maintenanceStatus}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-sans">
                  {item.updateAvailable ? (
                    <span className="text-amber-500 font-semibold inline-flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3" /> Patch / Minor
                    </span>
                  ) : (
                    <span className="text-emerald-500 font-semibold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Atualizado
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
