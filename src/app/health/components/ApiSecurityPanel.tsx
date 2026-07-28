"use client";

import React from "react";
import { Lock, ShieldCheck, CheckCircle2, Globe, AlertTriangle } from "lucide-react";
import { ApiSecurityItem } from "@/lib/governance/security";

interface ApiSecurityPanelProps {
  apiSecurity: ApiSecurityItem[];
}

export const ApiSecurityPanel: React.FC<ApiSecurityPanelProps> = ({ apiSecurity }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
          <Lock className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Diagnóstico de Segurança de APIs & Endpoints</h3>
          <p className="text-[11px] text-muted-foreground">
            Auditoria diagnóstica de autenticação, RBAC, headers de segurança e exposição de dados (Read-Only)
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Endpoint</th>
              <th className="py-2.5 px-3">Método</th>
              <th className="py-2.5 px-3">Autenticação</th>
              <th className="py-2.5 px-3">Autorização RBAC</th>
              <th className="py-2.5 px-3">Rate Limiting</th>
              <th className="py-2.5 px-3">Headers de Segurança</th>
              <th className="py-2.5 px-3 text-right">Risco de Exposição</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground font-mono text-[11px]">
            {apiSecurity.map((item) => (
              <tr key={item.endpoint} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-bold text-foreground font-sans">
                  {item.endpoint}
                </td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded bg-muted text-purple-400 font-bold border border-border/50">
                    {item.method}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  {item.authRequired ? (
                    <span className="text-emerald-500 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Obrigatória
                    </span>
                  ) : (
                    <span className="text-amber-500">Opcional</span>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  {item.roleChecked ? (
                    <span className="text-emerald-500 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Verificado
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-blue-400">
                  {item.rateLimitStatus}
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex flex-wrap gap-1 font-sans">
                    {item.securityHeaders.map((header) => (
                      <span key={header} className="px-1.5 py-0.5 rounded bg-muted/60 text-[10px] text-muted-foreground">
                        {header}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right font-semibold text-emerald-500 font-sans">
                  {item.dataExposureRisk === "NONE" ? "0% (Nenhum)" : item.dataExposureRisk}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
