"use client";

import React from "react";
import { ShieldCheck, Key, Lock, AlertTriangle } from "lucide-react";
import { EnterpriseHealthReport } from "@/lib/governance/observability";

interface SecurityAuditPanelProps {
  security: EnterpriseHealthReport["securityAudit"];
}

export const SecurityAuditPanel: React.FC<SecurityAuditPanelProps> = ({ security }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Auditoria de Segurança & Autenticação (RLS)</h3>
          <p className="text-[11px] text-muted-foreground">Proteção tríplice em 100% das rotas de API</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Proteção de Autenticação</span>
          <span className="text-lg font-bold text-emerald-500">{security.authProtectionPct}% Aprovada</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Políticas RLS Supabase</span>
          <span className="text-lg font-bold text-emerald-500">{security.rlsEnforcementStatus}</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Tentativas Não Autorizadas</span>
          <span className="text-lg font-bold text-foreground">{security.unauthorizedAttemptsCount} Ocorrências</span>
        </div>
      </div>
    </div>
  );
};
