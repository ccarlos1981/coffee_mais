"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, ShieldCheck, Activity, AlertTriangle, RefreshCw, Radio, Zap, Lock, Database } from "lucide-react";
import { EnterpriseHealthReport } from "@/lib/governance/observability";
import { EnterpriseObservabilityMetricsData } from "@/lib/governance/observability/metrics";
import { EnterprisePerformanceData } from "@/lib/governance/performance";
import { EnterpriseSecurityData } from "@/lib/governance/security";
import { EnterpriseDataQualityData, EnterpriseDataLineageData } from "@/lib/governance/data-quality";

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

// Sprint 2.3 Components
import { SecurityOverview } from "./components/SecurityOverview";
import { ComplianceScoreCard } from "./components/ComplianceScoreCard";
import { AccessMatrixPanel } from "./components/AccessMatrixPanel";
import { ApiSecurityPanel } from "./components/ApiSecurityPanel";
import { EnvironmentPanel } from "./components/EnvironmentPanel";
import { DependencyInventoryPanel } from "./components/DependencyInventoryPanel";
import { DependencyRiskPanel } from "./components/DependencyRiskPanel";
import { ComplianceRecommendations } from "./components/ComplianceRecommendations";
import { SecurityTimeline } from "./components/SecurityTimeline";

// Sprint 2.4 Components
import { DataQualityOverview } from "./components/DataQualityOverview";
import { DataQualityScoreCard } from "./components/DataQualityScoreCard";
import { CompletenessPanel } from "./components/CompletenessPanel";
import { ConsistencyPanel } from "./components/ConsistencyPanel";
import { IntegrityPanel } from "./components/IntegrityPanel";
import { FreshnessPanel } from "./components/FreshnessPanel";
import { CoveragePanel } from "./components/CoveragePanel";
import { DataLineagePanel } from "./components/DataLineagePanel";
import { DataRecommendations } from "./components/DataRecommendations";

export default function HealthCenterPage() {
  const [report, setReport] = useState<EnterpriseHealthReport | null>(null);
  const [metrics, setMetrics] = useState<EnterpriseObservabilityMetricsData | null>(null);
  const [performance, setPerformance] = useState<EnterprisePerformanceData | null>(null);
  const [security, setSecurity] = useState<EnterpriseSecurityData | null>(null);
  const [dataQuality, setDataQuality] = useState<EnterpriseDataQualityData | null>(null);
  const [dataLineage, setDataLineage] = useState<EnterpriseDataLineageData | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [resHealth, resMetrics, resPerformance, resSecurity, resQuality, resLineage] = await Promise.all([
        fetch("/api/health"),
        fetch("/api/health/metrics"),
        fetch("/api/health/performance"),
        fetch("/api/health/security"),
        fetch("/api/health/data-quality"),
        fetch("/api/health/data-lineage"),
      ]);

      if (!resHealth.ok || !resMetrics.ok || !resPerformance.ok || !resSecurity.ok || !resQuality.ok || !resLineage.ok) {
        throw new Error("Erro ao carregar dados do Health Center, Observabilidade, Performance, Segurança & Qualidade.");
      }

      const jsonHealth = await resHealth.json();
      const jsonMetrics = await resMetrics.json();
      const jsonPerformance = await resPerformance.json();
      const jsonSecurity = await resSecurity.json();
      const jsonQuality = await resQuality.json();
      const jsonLineage = await resLineage.json();

      if (!jsonHealth.success || !jsonMetrics.success || !jsonPerformance.success || !jsonSecurity.success || !jsonQuality.success || !jsonLineage.success) {
        throw new Error("Falha no relatório Enterprise.");
      }

      setReport(jsonHealth.data);
      setMetrics(jsonMetrics.data);
      setPerformance(jsonPerformance.data);
      setSecurity(jsonSecurity.data);
      setDataQuality(jsonQuality.data);
      setDataLineage(jsonLineage.data);
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
            <span className="text-foreground font-semibold">Health Center Enterprise (5 Pilares)</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-500 border border-teal-500/20 shadow-sm">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                Health Center Enterprise — Sprints 2.1 a 2.4
              </h1>
              <p className="text-xs text-muted-foreground">
                Observabilidade, Performance, Segurança, Compliance & Data Quality Program (Coffee++)
              </p>
            </div>
          </div>
        </div>

        {/* Badges de Governança */}
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
            <Database className="w-4 h-4 text-teal-500 animate-pulse" />
            <span className="font-mono text-[11px] font-bold text-foreground">
              DATA_QUALITY = LOCKED
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

      {/* 2. DATA QUALITY & GOVERNANCE (Sprint 2.4) */}
      {dataQuality?.overview && <DataQualityOverview overview={dataQuality.overview} />}
      {dataQuality?.scoreBreakdown && <DataQualityScoreCard breakdown={dataQuality.scoreBreakdown} />}
      {dataLineage && <DataLineagePanel lineageData={dataLineage} />}
      {dataQuality?.completeness && <CompletenessPanel completeness={dataQuality.completeness} />}
      {dataQuality?.consistency && <ConsistencyPanel consistency={dataQuality.consistency} />}
      {dataQuality?.integrity && <IntegrityPanel integrity={dataQuality.integrity} />}
      {dataQuality?.freshness && <FreshnessPanel freshness={dataQuality.freshness} />}
      {dataQuality?.coverage && <CoveragePanel coverage={dataQuality.coverage} />}
      {dataQuality?.recommendations && <DataRecommendations recommendations={dataQuality.recommendations} />}

      {/* 3. SECURITY & COMPLIANCE (Sprint 2.3) */}
      {security?.overview && <SecurityOverview overview={security.overview} />}
      {security?.complianceBreakdown && <ComplianceScoreCard breakdown={security.complianceBreakdown} />}
      {security?.accessMatrix && <AccessMatrixPanel accessMatrix={security.accessMatrix} />}
      {security?.apiSecurity && <ApiSecurityPanel apiSecurity={security.apiSecurity} />}
      {security?.environmentAudit && <EnvironmentPanel environmentAudit={security.environmentAudit} />}
      {security?.dependencyInventory && <DependencyInventoryPanel dependencyInventory={security.dependencyInventory} />}
      {security?.dependencyRisk && <DependencyRiskPanel dependencyRisk={security.dependencyRisk} />}
      {security?.recommendations && <ComplianceRecommendations recommendations={security.recommendations} />}
      {security?.timeline && <SecurityTimeline timeline={security.timeline} />}

      {/* 4. PERFORMANCE & OPTIMIZATION (Sprint 2.2) */}
      {performance?.overview && <PerformanceOverview overview={performance.overview} />}
      {performance?.engineProfiles && <EngineProfiler profiles={performance.engineProfiles} />}
      {performance?.queryAnalyzer && <QueryAnalyzerPanel queries={performance.queryAnalyzer} />}
      {performance?.bundleAnalyzer && <BundleAnalyzerPanel bundles={performance.bundleAnalyzer} />}
      {performance?.recommendations && <OptimizationRecommendations recommendations={performance.recommendations} />}

      {/* 5. OBSERVABILITY & METRICS (Sprint 2.1) */}
      {metrics?.overview && <ObservabilityOverview overview={metrics.overview} />}
      {metrics?.moduleHealthScores && <ModuleHealthScore scores={metrics.moduleHealthScores} />}
      {metrics?.apiPerformance && <ApiPerformanceTable metrics={metrics.apiPerformance} />}
      {metrics && (
        <SystemTrendPanel
          trends={metrics.trends}
          availability={metrics.availability}
        />
      )}
      {metrics?.errorTimeline && <ErrorTimeline errors={metrics.errorTimeline} />}

      {/* 6. KPIS DE SAÚDE GLOBAL E GOVERNANÇA */}
      {report && <HealthKpis report={report} />}
      <GovernanceHealthPanel />
      {report && (
        <PerformanceTelemetryPanel
          telemetry={report.telemetry}
          performance={report.performanceMetrics}
        />
      )}
      {report && <SecurityAuditPanel security={report.securityAudit} />}
      {report && <TestCoveragePanel testSuite={report.testSuite} />}
    </div>
  );
}
