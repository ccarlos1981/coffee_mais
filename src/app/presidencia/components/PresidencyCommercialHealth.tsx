"use client";

import React from "react";
import { Activity, Users, AlertTriangle, UserX, ShieldCheck } from "lucide-react";
import { PresidencyDashboardData } from "@/lib/governance/analytics/presidency";

interface PresidencyCommercialHealthProps {
  saudeComercial: PresidencyDashboardData["saudeComercial"];
  loading?: boolean;
}

export const PresidencyCommercialHealth: React.FC<PresidencyCommercialHealthProps> = ({
  saudeComercial,
  loading = false,
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Saúde da Carteira Comercial</h3>
            <p className="text-[11px] text-muted-foreground">Origem: Cockpit Comercial, CRM Comercial & Centro de Inteligência</p>
          </div>
        </div>

        <div className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-gold/10 text-gold border border-gold/20">
          Score Global: {saudeComercial.scoreSaudeGlobal}/100
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
        <div className="bg-background border border-border rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase block">Clientes Ativos</span>
            <span className="text-xl font-bold text-emerald-500">{saudeComercial.clientesAtivos}</span>
          </div>
          <Users className="w-5 h-5 text-emerald-500/50" />
        </div>

        <div className="bg-background border border-border rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase block">Clientes em Risco</span>
            <span className="text-xl font-bold text-rose-500">{saudeComercial.clientesEmRisco}</span>
          </div>
          <AlertTriangle className="w-5 h-5 text-rose-500/50" />
        </div>

        <div className="bg-background border border-border rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase block">Clientes Inativos</span>
            <span className="text-xl font-bold text-amber-500">{saudeComercial.clientesInativos}</span>
          </div>
          <UserX className="w-5 h-5 text-amber-500/50" />
        </div>
      </div>
    </div>
  );
};
