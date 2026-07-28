"use client";

import React from "react";
import { CheckSquare, CheckCircle2, AlertTriangle } from "lucide-react";
import { CompletenessAuditItem } from "@/lib/governance/data-quality";

interface CompletenessPanelProps {
  completeness: CompletenessAuditItem[];
}

export const CompletenessPanel: React.FC<CompletenessPanelProps> = ({ completeness }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
          <CheckSquare className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Auditoria de Completude de Campos Obrigatórios & Críticos</h3>
          <p className="text-[11px] text-muted-foreground">
            Verificação de cobertura de preenchimento em entidades chave (Frente 5)
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Tabela / Entidade</th>
              <th className="py-2.5 px-3">Campo Auditado</th>
              <th className="py-2.5 px-3">Obrigatório</th>
              <th className="py-2.5 px-3">Crítico</th>
              <th className="py-2.5 px-3">Ausentes</th>
              <th className="py-2.5 px-3">Total Registros</th>
              <th className="py-2.5 px-3 text-right">Preenchimento (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground font-mono text-[11px]">
            {completeness.map((item, idx) => (
              <tr key={idx} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-bold text-foreground font-sans">
                  {item.entity}
                </td>
                <td className="py-2.5 px-3 text-blue-400 font-bold">
                  {item.field}
                </td>
                <td className="py-2.5 px-3 font-sans">
                  {item.isMandatory ? <span className="text-emerald-500 font-semibold">Sim</span> : "Não"}
                </td>
                <td className="py-2.5 px-3 font-sans">
                  {item.isCritical ? <span className="text-amber-500 font-semibold">Crítico</span> : "Normal"}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground">
                  {item.missingCount}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground">
                  {item.totalRecords.toLocaleString("pt-BR")}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-emerald-500 font-sans">
                  {item.filledPercentage}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
