"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, Lock, CheckCircle2, AlertOctagon, KeyRound } from "lucide-react";
import { EnterpriseSecurityData } from "@/lib/governance/security";

interface SecurityOverviewProps {
  overview: EnterpriseSecurityData["overview"];
}

export const SecurityOverview: React.FC<SecurityOverviewProps> = ({ overview }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              Enterprise Security & Compliance Overview
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                SECURITY_ENTERPRISE = LOCKED
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Diagnóstico contínuo de autenticação, RBAC, políticas RLS, APIs e ambiente (Sprint 2.3)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-background border border-border p-2.5 rounded-xl">
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground uppercase block">Compliance Score</span>
            <span className="text-xl font-mono font-black text-emerald-500">
              {overview.globalComplianceScore}/100
            </span>
          </div>
        </div>
      </div>

      {/* Grid de Metricas de Seguranca */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block">Riscos Críticos</span>
          <span className="text-lg font-mono font-bold text-emerald-500">{overview.criticalRisksCount}</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block">Riscos Altos</span>
          <span className="text-lg font-mono font-bold text-emerald-500">{overview.highRisksCount}</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block">Riscos Médios</span>
          <span className="text-lg font-mono font-bold text-emerald-500">{overview.mediumRisksCount}</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block">Riscos Baixos</span>
          <span className="text-lg font-mono font-bold text-emerald-500">{overview.lowRisksCount}</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block">APIs Auditadas</span>
          <span className="text-lg font-mono font-bold text-foreground">{overview.auditedApisCount}</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block">Módulos Auditados</span>
          <span className="text-lg font-mono font-bold text-foreground">{overview.auditedModulesCount}</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] text-muted-foreground uppercase block">Políticas RLS</span>
          <span className="text-lg font-mono font-bold text-emerald-500">{overview.totalRlsPoliciesVerified} Ativas</span>
        </div>
      </div>
    </div>
  );
};
