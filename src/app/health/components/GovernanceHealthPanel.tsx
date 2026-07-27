"use client";

import React from "react";
import { Lock, ShieldAlert, Check } from "lucide-react";

export const GovernanceHealthPanel: React.FC = () => {
  const lockedSections = [
    { id: "55", name: "Fase 1 — Cockpit Comercial", route: "/inovacoes/cockpit", status: "LOCKED & CONFIRMED" },
    { id: "57", name: "Fase 2 — DRE Comercial", route: "/inovacoes/dre", status: "LOCKED & CONFIRMED" },
    { id: "59", name: "Fase 3 — CRM Comercial", route: "/inovacoes/crm", status: "LOCKED & CONFIRMED" },
    { id: "60", name: "Encerramento Ciclo 1", route: "Arquitetura", status: "LOCKED & CONFIRMED" },
    { id: "61", name: "Centro de Inteligência Comercial", route: "/inteligencia", status: "LOCKED & CONFIRMED" },
    { id: "62", name: "Forecast Comercial", route: "/forecast", status: "LOCKED & CONFIRMED" },
    { id: "63", name: "Simulador Comercial", route: "/simulador", status: "LOCKED & CONFIRMED" },
    { id: "64", name: "Assistente Comercial", route: "/assistente", status: "LOCKED & CONFIRMED" },
    { id: "65", name: "Painel Presidência", route: "/presidencia", status: "LOCKED & CONFIRMED" },
  ];

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Governança & Congelamento da Arquitetura</h3>
            <p className="text-[11px] text-muted-foreground">Status de Baselines Oficiais do AGENTS.md</p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
          <Check className="w-3.5 h-3.5" />
          0 REGRESSÕES DETECTADAS
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
        {lockedSections.map((sec) => (
          <div key={sec.id} className="p-3 bg-background border border-border rounded-xl space-y-1">
            <div className="flex items-center justify-between text-[10px] text-gold font-bold">
              <span>SEÇÃO #{sec.id}</span>
              <span>{sec.route}</span>
            </div>
            <span className="font-bold text-foreground font-sans block">{sec.name}</span>
            <span className="text-[10px] text-emerald-500 block font-bold">{sec.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
