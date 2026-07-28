"use client";

import React from "react";
import { Database, ShieldCheck, CheckCircle2, Server, Layers, Search } from "lucide-react";
import { EnterpriseDataQualityData } from "@/lib/governance/data-quality";

interface DataQualityOverviewProps {
  overview: EnterpriseDataQualityData["overview"];
}

export const DataQualityOverview: React.FC<DataQualityOverviewProps> = ({ overview }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-500 border border-teal-500/20">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              Enterprise Data Quality & Governance Overview
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-500 border border-teal-500/20">
                DATA_QUALITY_ENTERPRISE = LOCKED
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Monitoramento contínuo da integridade, completude, consistência e tempestividade dos dados (Sprint 2.4)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-background border border-border p-2.5 rounded-xl">
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground uppercase block">Data Quality Score</span>
            <span className="text-xl font-mono font-black text-teal-500">
              {overview.globalQualityScore}/100
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Domínios Auditados</span>
          <span className="text-lg font-bold text-foreground">{overview.totalDomainsAudited} Domínios</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Fontes de Dados</span>
          <span className="text-lg font-bold text-foreground">{overview.auditedSourcesCount} Fontes</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Registros Auditados</span>
          <span className="text-lg font-bold text-teal-500">{overview.totalRecordsAudited.toLocaleString("pt-BR")}</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Registros Órfãos</span>
          <span className="text-lg font-bold text-teal-500">{overview.orphansDetectedCount}</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Duplicidades</span>
          <span className="text-lg font-bold text-teal-500">{overview.duplicatesDetectedCount}</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Status Global</span>
          <span className="text-sm font-bold text-teal-500 block pt-0.5">{overview.globalQualityStatus}</span>
        </div>
      </div>
    </div>
  );
};
