"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, ShieldCheck, Activity, AlertTriangle, RefreshCw, Radio, Zap, Lock, Database, Cpu, Monitor, Code, Layers } from "lucide-react";
import { EnterpriseHealthReport } from "@/lib/governance/observability";
import { EnterpriseObservabilityMetricsData } from "@/lib/governance/observability/metrics";
import { EnterprisePerformanceData } from "@/lib/governance/performance";
import { EnterpriseSecurityData } from "@/lib/governance/security";
import { EnterpriseDataQualityData, EnterpriseDataLineageData } from "@/lib/governance/data-quality";
import { EnterpriseQualityData, EnterpriseTestsData } from "@/lib/governance/quality";
import { EnterpriseTelemetryData, EnterpriseAdoptionData } from "@/lib/governance/telemetry";
import { EnterpriseDevExData, EnterpriseCICDData } from "@/lib/governance/devex";
import { EnterpriseArchitectureData, EnterpriseDocumentationData } from "@/lib/governance/architecture";

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

// Sprint 2.5 Components
import { QualityOverview } from "./components/QualityOverview";
import { QualityScoreCard } from "./components/QualityScoreCard";
import { EnterpriseTestInventoryPanel } from "./components/EnterpriseTestInventoryPanel";
import { RegressionPanel } from "./components/RegressionPanel";
import { BuildValidationPanel } from "./components/BuildValidationPanel";
import { QualityRecommendations } from "./components/QualityRecommendations";

// Sprint 2.6 Components
import { TelemetryOverview } from "./components/TelemetryOverview";
import { AdoptionScoreCard } from "./components/AdoptionScoreCard";
import { ModuleUsagePanel } from "./components/ModuleUsagePanel";
import { UserJourneyPanel } from "./components/UserJourneyPanel";
import { FeatureUsagePanel } from "./components/FeatureUsagePanel";
import { SessionAnalyticsPanel } from "./components/SessionAnalyticsPanel";
import { DeviceAnalyticsPanel } from "./components/DeviceAnalyticsPanel";
import { TelemetryRecommendations } from "./components/TelemetryRecommendations";

// Sprint 2.7 Components
import { DevExOverview } from "./components/DevExOverview";
import { DevExScoreCard } from "./components/DevExScoreCard";
import { PipelineInventoryPanel } from "./components/PipelineInventoryPanel";
import { BuildHealthPanel } from "./components/BuildHealthPanel";
import { ReleaseReadinessPanel } from "./components/ReleaseReadinessPanel";
import { DevExRecommendations } from "./components/DevExRecommendations";

// Sprint 2.8 Components
import { ArchitectureOverview } from "./components/ArchitectureOverview";
import { ArchitectureScoreCard } from "./components/ArchitectureScoreCard";
import { EngineInventoryPanel } from "./components/EngineInventoryPanel";
import { ApiInventoryPanel } from "./components/ApiInventoryPanel";
import { DependencyGraphPanel } from "./components/DependencyGraphPanel";
import { ArchitectureRecommendations } from "./components/ArchitectureRecommendations";

export default function HealthCenterPage() {
  const [report, setReport] = useState<EnterpriseHealthReport | null>(null);
  const [metrics, setMetrics] = useState<EnterpriseObservabilityMetricsData | null>(null);
  const [performance, setPerformance] = useState<EnterprisePerformanceData | null>(null);
  const [security, setSecurity] = useState<EnterpriseSecurityData | null>(null);
  const [dataQuality, setDataQuality] = useState<EnterpriseDataQualityData | null>(null);
  const [dataLineage, setDataLineage] = useState<EnterpriseDataLineageData | null>(null);
  const [quality, setQuality] = useState<EnterpriseQualityData | null>(null);
  const [testsData, setTestsData] = useState<EnterpriseTestsData | null>(null);
  const [telemetry, setTelemetry] = useState<EnterpriseTelemetryData | null>(null);
  const [adoptionData, setAdoptionData] = useState<EnterpriseAdoptionData | null>(null);
  const [devex, setDevEx] = useState<EnterpriseDevExData | null>(null);
  const [cicd, setCicd] = useState<EnterpriseCICDData | null>(null);
  const [architecture, setArchitecture] = useState<EnterpriseArchitectureData | null>(null);
  const [documentation, setDocumentation] = useState<EnterpriseDocumentationData | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [resHealth, resMetrics, resPerformance, resSecurity, resQualityData, resLineage, resQuality, resTests, resTelemetry, resAdoption, resDevEx, resCicd, resArch, resDoc] = await Promise.all([
        fetch("/api/health"),
        fetch("/api/health/metrics"),
        fetch("/api/health/performance"),
        fetch("/api/health/security"),
        fetch("/api/health/data-quality"),
        fetch("/api/health/data-lineage"),
        fetch("/api/health/quality"),
        fetch("/api/health/tests"),
        fetch("/api/health/telemetry"),
        fetch("/api/health/adoption"),
        fetch("/api/health/devex"),
        fetch("/api/health/cicd"),
        fetch("/api/health/architecture"),
        fetch("/api/health/documentation"),
      ]);

      if (!resHealth.ok || !resMetrics.ok || !resPerformance.ok || !resSecurity.ok || !resQualityData.ok || !resLineage.ok || !resQuality.ok || !resTests.ok || !resTelemetry.ok || !resAdoption.ok || !resDevEx.ok || !resCicd.ok || !resArch.ok || !resDoc.ok) {
        throw new Error("Erro ao carregar dados do Health Center, Observabilidade, Performance, Segurança, Qualidade, Testes, Telemetria, DevEx & Arquitetura.");
      }

      const jsonHealth = await resHealth.json();
      const jsonMetrics = await resMetrics.json();
      const jsonPerformance = await resPerformance.json();
      const jsonSecurity = await resSecurity.json();
      const jsonQualityData = await resQualityData.json();
      const jsonLineage = await resLineage.json();
      const jsonQuality = await resQuality.json();
      const jsonTests = await resTests.json();
      const jsonTelemetry = await resTelemetry.json();
      const jsonAdoption = await resAdoption.json();
      const jsonDevEx = await resDevEx.json();
      const jsonCicd = await resCicd.json();
      const jsonArch = await resArch.json();
      const jsonDoc = await resDoc.json();

      if (!jsonHealth.success || !jsonMetrics.success || !jsonPerformance.success || !jsonSecurity.success || !jsonQualityData.success || !jsonLineage.success || !jsonQuality.success || !jsonTests.success || !jsonTelemetry.success || !jsonAdoption.success || !jsonDevEx.success || !jsonCicd.success || !jsonArch.success || !jsonDoc.success) {
        throw new Error("Falha no relatório Enterprise.");
      }

      setReport(jsonHealth.data);
      setMetrics(jsonMetrics.data);
      setPerformance(jsonPerformance.data);
      setSecurity(jsonSecurity.data);
      setDataQuality(jsonQualityData.data);
      setDataLineage(jsonLineage.data);
      setQuality(jsonQuality.data);
      setTestsData(jsonTests.data);
      setTelemetry(jsonTelemetry.data);
      setAdoptionData(jsonAdoption.data);
      setDevEx(jsonDevEx.data);
      setCicd(jsonCicd.data);
      setArchitecture(jsonArch.data);
      setDocumentation(jsonDoc.data);
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
            <span className="text-foreground font-semibold">Health Center Enterprise (9 Pilares Executivos)</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-500 border border-teal-500/20 shadow-sm">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                Health Center Enterprise — Sprints 2.1 a 2.8
              </h1>
              <p className="text-xs text-muted-foreground">
                Observabilidade, Performance, Segurança, Compliance, Data Quality, QA, Telemetria, DevEx & Arquitetura (Coffee++)
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
            <Layers className="w-4 h-4 text-teal-500 animate-pulse" />
            <span className="font-mono text-[11px] font-bold text-foreground">
              ARCHITECTURE_ENTERPRISE = LOCKED
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

      {/* 2. ENTERPRISE ARCHITECTURE & DOCUMENTATION GOVERNANCE (Sprint 2.8) */}
      {architecture?.overview && <ArchitectureOverview overview={architecture.overview} />}
      {architecture?.scoreBreakdown && <ArchitectureScoreCard breakdown={architecture.scoreBreakdown} />}
      {documentation?.engines && <EngineInventoryPanel engines={documentation.engines} />}
      {documentation?.apis && <ApiInventoryPanel apis={documentation.apis} />}
      {architecture?.dependencyNodes && <DependencyGraphPanel dependencyNodes={architecture.dependencyNodes} />}
      {architecture?.recommendations && <ArchitectureRecommendations recommendations={architecture.recommendations} />}

      {/* 3. DEVELOPER EXPERIENCE & CI/CD GOVERNANCE (Sprint 2.7) */}
      {devex?.overview && <DevExOverview overview={devex.overview} />}
      {devex?.scoreBreakdown && <DevExScoreCard breakdown={devex.scoreBreakdown} />}
      {cicd?.pipelines && <PipelineInventoryPanel pipelines={cicd.pipelines} />}
      {devex?.buildHealth && <BuildHealthPanel buildHealth={devex.buildHealth} />}
      {devex?.releaseReadiness && <ReleaseReadinessPanel releaseReadiness={devex.releaseReadiness} />}
      {devex?.recommendations && <DevExRecommendations recommendations={devex.recommendations} />}

      {/* 4. OPERATIONAL TELEMETRY & USAGE ANALYTICS (Sprint 2.6) */}
      {telemetry?.overview && <TelemetryOverview overview={telemetry.overview} />}
      {adoptionData?.scoreBreakdown && <AdoptionScoreCard breakdown={adoptionData.scoreBreakdown} />}
      {adoptionData?.scoreBreakdown?.moduleAdoption && <ModuleUsagePanel moduleAdoption={adoptionData.scoreBreakdown.moduleAdoption} />}
      {telemetry?.userJourneys && <UserJourneyPanel userJourneys={telemetry.userJourneys} />}
      {adoptionData?.featureUsage && <FeatureUsagePanel featureUsage={adoptionData.featureUsage} />}
      {telemetry?.sessionAnalytics && <SessionAnalyticsPanel sessionAnalytics={telemetry.sessionAnalytics} />}
      {telemetry?.deviceAnalytics && <DeviceAnalyticsPanel deviceAnalytics={telemetry.deviceAnalytics} />}
      {telemetry?.recommendations && <TelemetryRecommendations recommendations={telemetry.recommendations} />}

      {/* 5. TEST AUTOMATION & QUALITY ASSURANCE (Sprint 2.5) */}
      {quality?.overview && <QualityOverview overview={quality.overview} />}
      {quality?.scoreBreakdown && <QualityScoreCard breakdown={quality.scoreBreakdown} />}
      {quality?.buildValidation && <BuildValidationPanel buildValidation={quality.buildValidation} />}
      {testsData?.testInventory && <EnterpriseTestInventoryPanel inventory={testsData.testInventory} />}
      {testsData?.regressions && <RegressionPanel regressions={testsData.regressions} />}
      {quality?.recommendations && <QualityRecommendations recommendations={quality.recommendations} />}

      {/* 6. DATA QUALITY & GOVERNANCE (Sprint 2.4) */}
      {dataQuality?.overview && <DataQualityOverview overview={dataQuality.overview} />}
      {dataQuality?.scoreBreakdown && <DataQualityScoreCard breakdown={dataQuality.scoreBreakdown} />}
      {dataLineage && <DataLineagePanel lineageData={dataLineage} />}
      {dataQuality?.completeness && <CompletenessPanel completeness={dataQuality.completeness} />}
      {dataQuality?.consistency && <ConsistencyPanel consistency={dataQuality.consistency} />}
      {dataQuality?.integrity && <IntegrityPanel integrity={dataQuality.integrity} />}
      {dataQuality?.freshness && <FreshnessPanel freshness={dataQuality.freshness} />}
      {dataQuality?.coverage && <CoveragePanel coverage={dataQuality.coverage} />}
      {dataQuality?.recommendations && <DataRecommendations recommendations={dataQuality.recommendations} />}

      {/* 7. SECURITY & COMPLIANCE (Sprint 2.3) */}
      {security?.overview && <SecurityOverview overview={security.overview} />}
      {security?.complianceBreakdown && <ComplianceScoreCard breakdown={security.complianceBreakdown} />}
      {security?.accessMatrix && <AccessMatrixPanel accessMatrix={security.accessMatrix} />}
      {security?.apiSecurity && <ApiSecurityPanel apiSecurity={security.apiSecurity} />}
      {security?.environmentAudit && <EnvironmentPanel environmentAudit={security.environmentAudit} />}
      {security?.dependencyInventory && <DependencyInventoryPanel dependencyInventory={security.dependencyInventory} />}
      {security?.dependencyRisk && <DependencyRiskPanel dependencyRisk={security.dependencyRisk} />}
      {security?.recommendations && <ComplianceRecommendations recommendations={security.recommendations} />}
      {security?.timeline && <SecurityTimeline timeline={security.timeline} />}

      {/* 8. PERFORMANCE & OPTIMIZATION (Sprint 2.2) */}
      {performance?.overview && <PerformanceOverview overview={performance.overview} />}
      {performance?.engineProfiles && <EngineProfiler profiles={performance.engineProfiles} />}
      {performance?.queryAnalyzer && <QueryAnalyzerPanel queries={performance.queryAnalyzer} />}
      {performance?.bundleAnalyzer && <BundleAnalyzerPanel bundles={performance.bundleAnalyzer} />}
      {performance?.recommendations && <OptimizationRecommendations recommendations={performance.recommendations} />}

      {/* 9. OBSERVABILITY & METRICS (Sprint 2.1) */}
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

      {/* 10. KPIS DE SAÚDE GLOBAL E GOVERNANÇA */}
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
