"use client";

import React from "react";
import { Link2, CheckCircle2, ShieldCheck } from "lucide-react";
import { IntegrityAuditItem } from "@/lib/governance/data-quality";

interface IntegrityPanelProps {
  integrity: IntegrityAuditItem[];
}

export const IntegrityPanel: React.FC<IntegrityPanelProps> = ({ integrity }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
          <Link2 className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Auditoria de Integridade Referencial & Chaves Estrangeiras</h3>
          <p className="text-[11px] text-muted-foreground">
            Verificação de relacionamentos, FKs e registros órfãos entre entidades do banco (Frente 7)
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Relacionamento Auditado</th>
              <th className="py-2.5 px-3">Tabela Primária</th>
              <th className="py-2.5 px-3">Tabela Estrangeira (FK)</th>
              <th className="py-2.5 px-3">Registros Órfãos</th>
              <th className="py-2.5 px-3">Referências Ausentes</th>
              <th className="py-2.5 px-3 text-right">Status de Integridade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground font-mono text-[11px]">
            {integrity.map((item, idx) => (
              <tr key={idx} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-bold text-foreground font-sans">
                  {item.relationship}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground">
                  {item.primaryTable}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground">
                  {item.foreignTable}
                </td>
                <td className="py-2.5 px-3 text-emerald-500 font-bold">
                  {item.orphanCount}
                </td>
                <td className="py-2.5 px-3 text-emerald-500 font-bold">
                  {item.missingReferenceCount}
                </td>
                <td className="py-2.5 px-3 text-right font-sans">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold">
                    {item.referentialStatus}
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
