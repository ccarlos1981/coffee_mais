"use client";

import React from "react";
import { UserCheck, Key, Shield, CheckCircle2, AlertCircle } from "lucide-react";
import { AccessMatrixItem } from "@/lib/governance/security";

interface AccessMatrixPanelProps {
  accessMatrix: AccessMatrixItem[];
}

export const AccessMatrixPanel: React.FC<AccessMatrixPanelProps> = ({ accessMatrix }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
          <UserCheck className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Matriz Oficial de Governança de Acesso (RBAC)</h3>
          <p className="text-[11px] text-muted-foreground">
            Mapeamento de perfis, escopo de módulo, engines, permissões ativas e órfãs
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Perfil (Role)</th>
              <th className="py-2.5 px-3">Escopo de Módulo</th>
              <th className="py-2.5 px-3">Acesso às Engines</th>
              <th className="py-2.5 px-3">Permissões Utilizadas</th>
              <th className="py-2.5 px-3">Permissões Órfãs</th>
              <th className="py-2.5 px-3 text-right">Cobertura RBAC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground">
            {accessMatrix.map((item) => (
              <tr key={item.role} className="hover:bg-muted/30 transition-colors">
                <td className="py-3 px-3 font-bold text-foreground flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-gold" />
                  {item.role}
                </td>
                <td className="py-3 px-3 text-muted-foreground max-w-xs truncate">
                  {item.module}
                </td>
                <td className="py-3 px-3 font-mono text-[11px] text-blue-400">
                  {item.engineAccess}
                </td>
                <td className="py-3 px-3">
                  <div className="flex flex-wrap gap-1">
                    {item.permissionsUsed.map((perm) => (
                      <span
                        key={perm}
                        className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground border border-border/50"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-3">
                  {item.orphanPermissions.length === 0 ? (
                    <span className="text-[11px] font-mono text-emerald-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Nenhuma
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-amber-500">
                      {item.orphanPermissions.length} pendentes
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-emerald-500">
                  {item.rbacCoveragePct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
