"use client";

import React from "react";
import { BarChart3, TrendingUp, Award, MapPin } from "lucide-react";
import { CommercialExecutionData } from "@/lib/commercial-execution";

interface ExecutionAnalyticsPanelProps {
  data: CommercialExecutionData;
}

export const ExecutionAnalyticsPanel: React.FC<ExecutionAnalyticsPanelProps> = ({ data }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
          <BarChart3 className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Analytics de Execução Comercial em Campo</h3>
          <p className="text-[11px] text-muted-foreground">
            Indicadores agregados de produtividade da equipe comercial e metas de cobertura semanal
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Taxa de Execução */}
        <div className="p-4 bg-background border border-border rounded-xl space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Índice de Cobertura da Carteira</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-500">
            {data.executionAnalytics.managerExecutionRatePct}%
          </div>
          <p className="text-[11px] text-muted-foreground font-sans">
            Média de atendimento aos clientes ativos nos últimos 30 dias
          </p>
        </div>

        {/* Visitas Semanais */}
        <div className="p-4 bg-background border border-border rounded-xl space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Meta Semanal de Visitas</span>
            <TrendingUp className="w-4 h-4 text-gold" />
          </div>
          <div className="text-2xl font-mono font-bold text-foreground">
            {data.executionAnalytics.weeklyVisitsRealizedCount} / {data.executionAnalytics.weeklyVisitsGoalCount}
          </div>
          <p className="text-[11px] text-muted-foreground font-sans">
            Visitas realizadas vs planejadas para o ciclo semanal corrente
          </p>
        </div>

        {/* Regiões de Maior Cobertura */}
        <div className="p-4 bg-background border border-border rounded-xl space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Principais Praças Atendidas</span>
            <MapPin className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="space-y-1 font-mono text-xs">
            {data.executionAnalytics.topRegionsExecuted.map((region, idx) => (
              <div key={idx} className="flex items-center gap-2 text-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{region}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
