"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, ShieldCheck, Activity, AlertTriangle, RefreshCw, Radio, Zap } from "lucide-react";
import { EnterpriseHealthReport } from "@/lib/governance/observability";
import { EnterpriseObservabilityMetricsData } from "@/lib/governance/observability/metrics";
import { EnterprisePerformanceData } from "@/lib/governance/performance";
import { HealthKpis } from "./components/HealthKpis";
import { GovernanceHealthPanel } from "./components/GovernanceHealthPanel";
import { PerformanceTelemetryPanel } from "./components/PerformanceTelemetryPanel";
import { SecurityAuditPanel } from "./components/SecurityAuditPanel";
import { TestCoveragePanel } from "./components/TestCoveragePanel";
import { ObservabilityOverview } from "./components/ObservabilityOverview";
import { ModuleHealthScore } from "./components/ModuleHealthScore";
import { ApiPerformanceTable } from "./components/ApiPerformanceTable";
import { ErrorTimeline } from "./components/ErrorTimeline";
import { SystemTrendPanel } from "./components/SystemTrendPanel";
import { PerformanceOverview } from "./components/PerformanceOverview";
import { EngineProfiler } from "./components/EngineProfiler";
import { QueryAnalyzerPanel } from "./components/QueryAnalyzerPanel";
import { BundleAnalyzerPanel } from "./components/BundleAnalyzerPanel";
import { OptimizationRecommendations } from "./components/OptimizationRecommendations";

export default function HealthCenterPage() {
  const [report, setReport] = useState<EnterpriseHealthReport | null>(null);
  const [metrics, setMetrics] = useState<EnterpriseObservabilityMetricsData | null>(null);
  const [performance, setPerformance] = useState<EnterprisePerformanceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [resHealth, resMetrics, resPerformance] = await Promise.all([
        fetch("/api/health"),
        fetch("/api/health/metrics"),
        fetch("/api/health/performance"),
      ]);

      if (!resHealth.ok || !resMetrics.ok || !resPerformance.ok) {
        throw new Error("Erro ao carregar dados do Health Center, Observabilidade & Performance.");
      }

      const jsonHealth = await resHealth.json();
      const jsonMetrics = await resMetrics.json();
      const jsonPerformance = await resPerformance.json();

      if (!jsonHealth.success || !jsonMetrics.success || !jsonPerformance.success) {
        throw new Error("Falha no relatório Enterprise.");
      }

      setReport(jsonHealth.data);
      setMetrics(jsonMetrics.data);
      setPerformance(jsonPerformance.data);
    } catch (err: any) {
      console.error("Erro no Health Center:", err);
      setError(err.message || "Erro de conexão com o Health Center.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealthData();
  }, [fetchHealthData]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Cabeçalho Executivo & Governança */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-gold" />
            <span className="text-foreground font-semibold">Health Center, Observabilidade & Performance</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-sm">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                Health Center Enterprise — Sprints 2.1 & 2.2
              </h1>
              <p className="text-xs text-muted-foreground">
                Enterprise Performance & Observability Program: Profiling de Engines, Bundles, Latência & Governança
              </p>
            </div>
          </div>
        </div>

        {/* Badge de Governança Financeira */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchHealthData}
            disabled={loading}
            className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar Diagnóstico
          </button>

          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-2xl text-xs shadow-sm">
            <Zap className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] font-bold text-foreground">
              PERFORMANCE = OPTIMIZED
            </span>
          </div>
        </div>
      </div>

      {/* Mensagem de Erro se houver */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchHealthData}
            className="px-3 py-1 bg-rose-500 text-white font-bold rounded-xl text-xs"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* 2. Performance Overview (Sprint 2.2) */}
      {performance?.overview && <PerformanceOverview overview={performance.overview} />}

      {/* 3. Profiling de Engines (Sprint 2.2) */}
      {performance?.engineProfiles && <EngineProfiler profiles={performance.engineProfiles} />}

      {/* 4. Analisador de Consultas Analíticas (Sprint 2.2) */}
      {performance?.queryAnalyzer && <QueryAnalyzerPanel queries={performance.queryAnalyzer} />}

      {/* 5. Analisador de Bundles Next.js (Sprint 2.2) */}
      {performance?.bundleAnalyzer && <BundleAnalyzerPanel bundles={performance.bundleAnalyzer} />}

      {/* 6. Recomendações de Otimização Segura (Sprint 2.2) */}
      {performance?.recommendations && <OptimizationRecommendations recommendations={performance.recommendations} />}

      {/* 7. Visão Geral de Observabilidade (Sprint 2.1) */}
      {metrics?.overview && <ObservabilityOverview overview={metrics.overview} />}

      {/* 8. Health Score dos Módulos (0-100) (Sprint 2.1) */}
      {metrics?.moduleHealthScores && <ModuleHealthScore scores={metrics.moduleHealthScores} />}

      {/* 9. Tabela de Performance de APIs (Latência P95 / P99) (Sprint 2.1) */}
      {metrics?.apiPerformance && <ApiPerformanceTable metrics={metrics.apiPerformance} />}

      {/* 10. Tendências de Latência & SLA (Sprint 2.1) */}
      {metrics && (
        <SystemTrendPanel
          trends={metrics.trends}
          availability={metrics.availability}
        />
      )}

      {/* 11. Histórico e Coleta de Erros (Sprint 2.1) */}
      {metrics?.errorTimeline && <ErrorTimeline errors={metrics.errorTimeline} />}

      {/* 12. KPIs de Saúde Global do Health Center */}
      {report && <HealthKpis report={report} />}

      {/* 13. Painel de Governança de Baselines */}
      <GovernanceHealthPanel />

      {/* 14. Telemetria & Performance */}
      {report && (
        <PerformanceTelemetryPanel
          telemetry={report.telemetry}
          performance={report.performanceMetrics}
        />
      )}

      {/* 15. Auditoria de Segurança */}
      {report && <SecurityAuditPanel security={report.securityAudit} />}

      {/* 16. Cobertura de Testes */}
      {report && <TestCoveragePanel testSuite={report.testSuite} />}
    </div>
  );
}
