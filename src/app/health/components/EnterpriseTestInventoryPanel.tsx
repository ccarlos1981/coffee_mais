"use client";

import React from "react";
import { CheckCircle2, ShieldCheck, Cpu, Code2 } from "lucide-react";
import { TestInventoryItem } from "@/lib/governance/quality";

interface EnterpriseTestInventoryPanelProps {
  inventory: TestInventoryItem[];
}

export const EnterpriseTestInventoryPanel: React.FC<EnterpriseTestInventoryPanelProps> = ({ inventory }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
            <Code2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Inventário Oficial de Suítes de Testes (Frente 3)</h3>
            <p className="text-[11px] text-muted-foreground">
              Mapeamento de testes unitários, integração, APIs, componentes e engines por módulo
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
          {inventory.reduce((acc, curr) => acc + curr.testCount, 0)} Testes Automatizados
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Módulo</th>
              <th className="py-2.5 px-3">Tipo de Teste</th>
              <th className="py-2.5 px-3">Qtd. Testes</th>
              <th className="py-2.5 px-3">Aprovados</th>
              <th className="py-2.5 px-3">Falhas</th>
              <th className="py-2.5 px-3">Cobertura (%)</th>
              <th className="py-2.5 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground font-mono text-[11px]">
            {inventory.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-bold text-foreground font-sans">
                  {item.module}
                </td>
                <td className="py-2.5 px-3 font-sans">
                  <span className="px-2 py-0.5 rounded bg-muted text-indigo-400 font-semibold border border-border/50 text-[10px]">
                    {item.testType}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-foreground font-bold">
                  {item.testCount}
                </td>
                <td className="py-2.5 px-3 text-emerald-500 font-bold">
                  {item.passCount}
                </td>
                <td className="py-2.5 px-3 text-emerald-500 font-bold">
                  {item.failCount}
                </td>
                <td className="py-2.5 px-3 font-bold text-indigo-500 font-sans">
                  {item.coveragePct}%
                </td>
                <td className="py-2.5 px-3 text-right font-sans">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold">
                    {item.status}
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
