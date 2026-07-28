"use client";

import React, { useState } from "react";
import Link from "next/link";
import { OpportunityItem, PipelineStage } from "@/lib/crm-enterprise";
import { DollarSign, Clock, User, Calendar, Tag, ArrowRight, Network, CheckCircle2, Play } from "lucide-react";

interface CrmPipelineKanbanProps {
  opportunities: OpportunityItem[];
  pipelineByStage: Record<PipelineStage, { count: number; totalValue: number }>;
  stageLabels: Record<PipelineStage, string>;
  onRefresh?: () => void;
}

export const CrmPipelineKanban: React.FC<CrmPipelineKanbanProps> = ({
  opportunities,
  pipelineByStage,
  stageLabels,
  onRefresh,
}) => {
  const [loadingWf, setLoadingWf] = useState<string | null>(null);

  const stages: PipelineStage[] = [
    "LEAD",
    "PROSPECT",
    "QUALIFICATION",
    "NEGOTIATION",
    "PROPOSAL",
    "IMPLEMENTATION",
    "ACTIVE_CUSTOMER",
    "EXPANSION",
    "RENEWAL",
  ];

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  const handleStartWorkflow = async (opp: OpportunityItem) => {
    try {
      setLoadingWf(opp.id);
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowKey: "crm_opportunity_workflow",
          entityType: "CRM_OPPORTUNITY",
          entityId: opp.id,
          title: `CRM: ${opp.title} — ${formatCurrency(opp.estimatedValue)}`,
          priority: opp.priority === "HIGH" ? "HIGH" : "MEDIUM",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erro ao iniciar workflow.");
      }

      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || "Erro ao instanciar workflow.");
    } finally {
      setLoadingWf(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">Pipeline Comercial Oficial (9 Estágios Corporativos)</h3>
          <p className="text-[11px] text-muted-foreground">
            Fluxo de oportunidades comerciais integrado ao Enterprise Workflow Engine
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-9 gap-3 overflow-x-auto pb-2">
        {stages.map((stage) => {
          const stageOpps = opportunities.filter((o) => o.stage === stage);
          const stageSummary = pipelineByStage[stage] || { count: 0, totalValue: 0 };

          return (
            <div key={stage} className="bg-background border border-border rounded-xl p-3 space-y-3 min-w-[220px]">
              {/* Cabeçalho do Estágio */}
              <div className="border-b border-border pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground font-sans">{stageLabels[stage]}</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20">
                    {stageSummary.count}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-semibold text-muted-foreground block pt-1">
                  {formatCurrency(stageSummary.totalValue)}
                </span>
              </div>

              {/* Cards de Oportunidades */}
              <div className="space-y-2.5">
                {stageOpps.length === 0 ? (
                  <div className="p-3 text-center text-[10px] text-muted-foreground border border-dashed border-border/60 rounded-lg">
                    Sem Oportunidades
                  </div>
                ) : (
                  stageOpps.map((opp) => {
                    const wfInfo = (opp as any).workflow;
                    const wfState = wfInfo?.workflowState || "NOT_CREATED";

                    return (
                      <div
                        key={opp.id}
                        className="p-3 bg-card border border-border rounded-xl shadow-xs hover:border-gold/50 transition-all space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                              opp.priority === "HIGH"
                                ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                : opp.priority === "MEDIUM"
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            }`}
                          >
                            {opp.priority}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-500 font-bold">
                            {opp.probabilityPct}% Prob.
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-foreground line-clamp-2 leading-tight">
                          {opp.title}
                        </h4>

                        <p className="text-[10px] text-muted-foreground font-medium truncate">
                          {opp.customerName}
                        </p>

                        <div className="text-xs font-mono font-bold text-gold pt-1 border-t border-border/40 flex justify-between items-center">
                          <span>{formatCurrency(opp.estimatedValue)}</span>
                          <span className="text-[9px] text-muted-foreground font-normal">
                            {opp.accountManager.split(" ")[0]}
                          </span>
                        </div>

                        {/* Annotation de Workflow (Sprint 4.2) */}
                        <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                          {wfState === "NOT_CREATED" ? (
                            <button
                              disabled={loadingWf === opp.id}
                              onClick={() => handleStartWorkflow(opp)}
                              className="text-[10px] font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded transition flex items-center gap-1 w-full justify-center disabled:opacity-50"
                            >
                              <Play className="w-2.5 h-2.5" /> Iniciar Workflow
                            </button>
                          ) : (
                            <Link
                              href="/workflow-enterprise"
                              className="text-[10px] font-mono font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-emerald-500/20 transition w-full justify-between"
                            >
                              <span className="flex items-center gap-1">
                                <Network className="w-2.5 h-2.5" /> {wfState}
                              </span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
