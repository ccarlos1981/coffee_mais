"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Network, Layers, ShieldCheck, Cpu, BarChart3 } from "lucide-react";
import { WorkflowFilterBar } from "./components/WorkflowFilterBar";
import { WorkflowKpis } from "./components/WorkflowKpis";
import { WorkflowListPanel } from "./components/WorkflowListPanel";
import { WorkflowStateMachinePanel } from "./components/WorkflowStateMachinePanel";
import { WorkflowApprovalsPanel } from "./components/WorkflowApprovalsPanel";
import { WorkflowTimelinePanel } from "./components/WorkflowTimelinePanel";
import { WorkflowDefinitionsPanel } from "./components/WorkflowDefinitionsPanel";
import { WorkflowAnalyticsPanel } from "./components/WorkflowAnalyticsPanel";
import {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowAnalyticsSummary,
} from "@/lib/workflow-enterprise/types";

export default function WorkflowEnterprisePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [analytics, setAnalytics] = useState<WorkflowAnalyticsSummary>({
    totalDefinitions: 0,
    activeDefinitions: 0,
    totalInstances: 0,
    instancesByState: {},
    instancesByEntityType: {},
    averageCycleTimeHours: 0,
    slaCompliancePct: 100,
    pendingApprovalsCount: 0,
  });

  // Selected Instance
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowInstance | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  // Tabs
  const [activeTab, setActiveTab] = useState<"INSTANCES" | "DEFINITIONS" | "APPROVALS" | "ANALYTICS">("INSTANCES");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch Workflows & Analytics
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (entityTypeFilter) params.set("entityType", entityTypeFilter);
      if (stateFilter) params.set("currentState", stateFilter);
      if (priorityFilter) params.set("priority", priorityFilter);

      const [resWf, resDef] = await Promise.all([
        fetch(`/api/workflows?${params.toString()}`),
        fetch(`/api/workflow-definitions`),
      ]);

      if (!resWf.ok || !resDef.ok) {
        throw new Error("Falha ao carregar dados do Enterprise Workflow Engine.");
      }

      const jsonWf = await resWf.json();
      const jsonDef = await resDef.json();

      setInstances(jsonWf.data || []);
      if (jsonWf.analytics) setAnalytics(jsonWf.analytics);
      setDefinitions(jsonDef.data || []);

      if (jsonWf.data && jsonWf.data.length > 0 && !selectedWorkflow) {
        setSelectedWorkflow(jsonWf.data[0]);
      }
    } catch (err: any) {
      console.error("[WorkflowEnterprisePage] Error:", err);
      setError(err.message || "Erro desconhecido ao carregar workflows.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, entityTypeFilter, stateFilter, priorityFilter]);

  const handleStateTransition = async (targetState: string, comment?: string) => {
    if (!selectedWorkflow) return;

    const res = await fetch(`/api/workflows/${selectedWorkflow.workflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetState,
        comment,
        expectedUpdatedAt: selectedWorkflow.updatedAt,
      }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || "Erro ao executar transição.");
    }

    // Refresh selected workflow
    setSelectedWorkflow(json.data);
    fetchData();
  };

  const handleApprovalAction = async (action: 'APPROVE' | 'REJECT' | 'RETURN', stepId?: string, comment?: string) => {
    if (!selectedWorkflow) return;

    const res = await fetch(`/api/workflows/${selectedWorkflow.workflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approvalAction: action,
        stepId,
        comment,
        expectedUpdatedAt: selectedWorkflow.updatedAt,
      }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || "Erro ao processar aprovação.");
    }

    // Refresh selected workflow
    setSelectedWorkflow(json.data);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto font-sans">
      {/* Header Banner & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-4 mb-6">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
            <Link href="/" className="hover:text-neutral-100 transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-amber-500" />
            <Link href="/health" className="hover:text-neutral-100 transition-colors">
              Governança & Health
            </Link>
            <ChevronRight className="w-3 h-3 text-amber-500" />
            <span className="text-neutral-100 font-semibold">Workflow Enterprise</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-neutral-100">Workflow Enterprise</h1>
                <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono font-medium px-2 py-0.5 rounded">
                  SPRINT 4.1 ACTIVE
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Infraestrutura corporativa de máquinas de estado, aprovação transacional e auditoria imutável.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <WorkflowKpis analytics={analytics} />

      {/* Filter Bar */}
      <WorkflowFilterBar
        search={search}
        setSearch={setSearch}
        entityTypeFilter={entityTypeFilter}
        setEntityTypeFilter={setEntityTypeFilter}
        stateFilter={stateFilter}
        setStateFilter={setStateFilter}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
        onRefresh={fetchData}
      />

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-neutral-800 mb-6 pb-2">
        <button
          onClick={() => setActiveTab("INSTANCES")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition ${
            activeTab === "INSTANCES"
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
          }`}
        >
          <Layers className="w-4 h-4" /> Instâncias & Execuções
        </button>

        <button
          onClick={() => setActiveTab("DEFINITIONS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition ${
            activeTab === "DEFINITIONS"
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
          }`}
        >
          <Cpu className="w-4 h-4" /> Modelos (Definitions)
        </button>

        <button
          onClick={() => setActiveTab("APPROVALS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition ${
            activeTab === "APPROVALS"
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Fila de Aprovações
        </button>

        <button
          onClick={() => setActiveTab("ANALYTICS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition ${
            activeTab === "ANALYTICS"
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Métricas & Analytics
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-12 text-center text-neutral-400 text-xs">
          Carregando infraestrutura do Enterprise Workflow Engine...
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 text-center text-rose-300 text-xs">
          {error}
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === "INSTANCES" && (
            <>
              <WorkflowListPanel
                instances={instances}
                selectedWorkflowId={selectedWorkflow?.workflowId}
                onSelectWorkflow={(wf) => setSelectedWorkflow(wf)}
              />

              {selectedWorkflow && (
                <div className="space-y-6 pt-4 border-t border-neutral-800">
                  <WorkflowStateMachinePanel
                    instance={selectedWorkflow}
                    onTransition={handleStateTransition}
                  />

                  <WorkflowApprovalsPanel
                    instance={selectedWorkflow}
                    onApprovalAction={handleApprovalAction}
                  />

                  <WorkflowTimelinePanel instance={selectedWorkflow} />
                </div>
              )}
            </>
          )}

          {activeTab === "DEFINITIONS" && (
            <WorkflowDefinitionsPanel
              definitions={definitions}
              onSelectDefinition={(def) => {
                alert(`Modelo selecionado: ${def.name} (v${def.version})`);
              }}
            />
          )}

          {activeTab === "APPROVALS" && selectedWorkflow && (
            <WorkflowApprovalsPanel
              instance={selectedWorkflow}
              onApprovalAction={handleApprovalAction}
            />
          )}

          {activeTab === "ANALYTICS" && (
            <WorkflowAnalyticsPanel analytics={analytics} />
          )}
        </div>
      )}
    </div>
  );
}
