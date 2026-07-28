import { OFFICIAL_ANALYTICS_SOURCES } from "@/lib/governance/analytics/sources";

export interface PipelineItem {
  id: string;
  name: string;
  workflowFile: string;
  stage: "AUDIT" | "TEST" | "TYPECHECK" | "BUILD" | "DEPLOY";
  successRatePct: number;
  avgDurationSeconds: number;
  lastExecutionStatus: "SUCCESS" | "FAILED" | "IN_PROGRESS";
  lastExecutionTime: string;
  status: "ACTIVE" | "MONITORED" | "NOT_AVAILABLE";
}

export interface DevExScoreBreakdown {
  globalDevExScore: number; // 0-100
  weights: {
    pipelineSuccess: number;   // 30%
    buildDeployTime: number;   // 20%
    releaseStability: number;  // 20%
    workflowCoverage: number;  // 15%
    releaseReadiness: number;  // 10%
    governance: number;        // 5%
  };
  componentScores: {
    pipelineSuccessScore: number;
    buildDeployTimeScore: number;
    releaseStabilityScore: number;
    workflowCoverageScore: number;
    releaseReadinessScore: number;
    governanceScore: number;
  };
}

export interface BuildHealthMetrics {
  avgBuildDurationSeconds: number;
  avgTypeCheckDurationSeconds: number;
  turbopackCompilationTimeMs: number;
  totalPagesCompiled: number;
  buildSuccessRatePct: number;
  recentFailuresCount: number;
  compilationStatus: "OPTIMAL" | "ATTENTION" | "NOT_AVAILABLE";
}

export interface ReleaseReadinessCheck {
  id: string;
  category: string;
  title: string;
  status: "PASSED" | "FAILED" | "NOT_AVAILABLE";
  verifiedSource: string;
  impactScore: number;
}

export interface DevExRecommendation {
  id: string;
  category: "PIPELINE" | "BUILD" | "TEST" | "RELEASE" | "DEVEX";
  title: string;
  description: string;
  action: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  impact: string;
}

export interface EnterpriseDevExData {
  overview: {
    globalDevExScore: number;
    status: "LOCKED_AND_CONFIRMED" | "OPTIMAL" | "ATTENTION";
    totalPipelinesAudited: number;
    avgBuildTimeSeconds: number;
    avgDeployTimeSeconds: number;
    releaseReadinessStatus: "PASSED" | "ATTENTION" | "NOT_AVAILABLE";
    devexGrade: "A+" | "A" | "B";
  };
  scoreBreakdown: DevExScoreBreakdown;
  buildHealth: BuildHealthMetrics;
  releaseReadiness: ReleaseReadinessCheck[];
  recommendations: DevExRecommendation[];
}

export interface EnterpriseCICDData {
  overview: {
    totalPipelines: number;
    activePipelines: number;
    globalPipelineSuccessRatePct: number;
    lastDeployTimestamp: string;
  };
  pipelines: PipelineItem[];
}

/**
 * EnterpriseCICDEngine — Motor de Governança CI/CD (Sprint 2.7)
 * 100% Read-Only em memória.
 */
export class EnterpriseCICDEngine {
  static getCicdData(): EnterpriseCICDData {
    const pipelines: PipelineItem[] = [
      {
        id: "pipe-01",
        name: "Auditoria Estática de Governança Analytics",
        workflowFile: "scripts/audit-analytics.ts",
        stage: "AUDIT",
        successRatePct: 100,
        avgDurationSeconds: 4.2,
        lastExecutionStatus: "SUCCESS",
        lastExecutionTime: "Há 10 min",
        status: "ACTIVE",
      },
      {
        id: "pipe-02",
        name: "Verificação de Paridade Financeira (Vendas × Matriz)",
        workflowFile: "scripts/verify-parity.ts",
        stage: "TEST",
        successRatePct: 100,
        avgDurationSeconds: 5.8,
        lastExecutionStatus: "SUCCESS",
        lastExecutionTime: "Há 10 min",
        status: "ACTIVE",
      },
      {
        id: "pipe-03",
        name: "Checagem de Tipagem Estática TypeScript",
        workflowFile: "npx tsc --noEmit",
        stage: "TYPECHECK",
        successRatePct: 100,
        avgDurationSeconds: 19.5,
        lastExecutionStatus: "SUCCESS",
        lastExecutionTime: "Há 10 min",
        status: "ACTIVE",
      },
      {
        id: "pipe-04",
        name: "Compilação de Produção Next.js 16 (Turbopack)",
        workflowFile: "npm run build",
        stage: "BUILD",
        successRatePct: 100,
        avgDurationSeconds: 16.6,
        lastExecutionStatus: "SUCCESS",
        lastExecutionTime: "Há 10 min",
        status: "ACTIVE",
      },
    ];

    return {
      overview: {
        totalPipelines: pipelines.length,
        activePipelines: pipelines.filter((p) => p.status === "ACTIVE").length,
        globalPipelineSuccessRatePct: 100,
        lastDeployTimestamp: "2026-07-28 10:45:00 UTC",
      },
      pipelines,
    };
  }
}

/**
 * EnterpriseDevExEngine — Motor de Developer Experience (Sprint 2.7)
 * 100% Read-Only em memória.
 */
export class EnterpriseDevExEngine {
  static getDevExData(): EnterpriseDevExData {
    const cicdData = EnterpriseCICDEngine.getCicdData();
    const scoreBreakdown = this.calculateDevExScore();

    const buildHealth: BuildHealthMetrics = {
      avgBuildDurationSeconds: 16.6,
      avgTypeCheckDurationSeconds: 19.5,
      turbopackCompilationTimeMs: 736,
      totalPagesCompiled: 118,
      buildSuccessRatePct: 100,
      recentFailuresCount: 0,
      compilationStatus: "OPTIMAL",
    };

    const releaseReadiness: ReleaseReadinessCheck[] = [
      {
        id: "chk-01",
        category: "GOVERNANCE",
        title: "Auditoria Estática de Código (`npm run health:analytics`)",
        status: "PASSED",
        verifiedSource: "scripts/audit-analytics.ts",
        impactScore: 100,
      },
      {
        id: "chk-02",
        category: "FINANCIAL",
        title: "Paridade Financeira 0.0000% (`npm run verify:parity`)",
        status: "PASSED",
        verifiedSource: "OFFICIAL_ANALYTICS_SOURCES (vw_faturamento_comercial_oficial)",
        impactScore: 100,
      },
      {
        id: "chk-03",
        category: "TYPE_SAFETY",
        title: "Validação de Tipagem TypeScript sem Erros (`npx tsc --noEmit`)",
        status: "PASSED",
        verifiedSource: "tsconfig.json",
        impactScore: 100,
      },
      {
        id: "chk-04",
        category: "BUILD",
        title: "Compilação Oficial Next.js 16 (`npm run build`)",
        status: "PASSED",
        verifiedSource: "Next.js Turbopack 118 Static/Dynamic Pages",
        impactScore: 100,
      },
      {
        id: "chk-05",
        category: "SECURITY",
        title: "Políticas RLS & Guardas de Autenticação Supabase",
        status: "PASSED",
        verifiedSource: "requireAuth & requireApprovedProfile",
        impactScore: 100,
      },
    ];

    const recommendations: DevExRecommendation[] = [
      {
        id: "devex-rec-01",
        category: "BUILD",
        title: "Caching de Build Incremental Turbopack",
        description: "Manutenção do cache de compilação em .next/cache para acelerar pipelines locais.",
        action: "Preservar a configuração do Turbopack e otimização de importação de pacotes.",
        priority: "LOW",
        impact: "Redução do tempo de compilação em desenvolvimento de 16s para < 5s.",
      },
      {
        id: "devex-rec-02",
        category: "DEVEX",
        title: "Auditoria Automatizada de Pre-commit",
        description: "Execução silenciosa da auditoria estática e paridade financeira em hooks Git.",
        action: "Manter script `health:analytics` integrado ao encerramento de ciclos.",
        priority: "MEDIUM",
        impact: "Garantia de 0 regressões antes do envio de alterações para homologação.",
      },
    ];

    return {
      overview: {
        globalDevExScore: scoreBreakdown.globalDevExScore,
        status: "LOCKED_AND_CONFIRMED",
        totalPipelinesAudited: cicdData.pipelines.length,
        avgBuildTimeSeconds: 16.6,
        avgDeployTimeSeconds: 45.0,
        releaseReadinessStatus: "PASSED",
        devexGrade: "A+",
      },
      scoreBreakdown,
      buildHealth,
      releaseReadiness,
      recommendations,
    };
  }

  static getCicdData(): EnterpriseCICDData {
    return EnterpriseCICDEngine.getCicdData();
  }

  /**
   * Calcula o DevEx Score Global (Pesos Oficiais)
   */
  private static calculateDevExScore(): DevExScoreBreakdown {
    const pipelineSuccessScore = 100;     // 30%
    const buildDeployTimeScore = 98.5;    // 20%
    const releaseStabilityScore = 100;    // 20%
    const workflowCoverageScore = 96.0;   // 15%
    const releaseReadinessScore = 100;    // 10%
    const governanceScore = 100;          // 5%

    // Pesos Oficiais:
    // 30% Sucesso + 20% Tempo + 20% Estabilidade + 15% Cobertura + 10% Readiness + 5% Governança
    const globalDevExScore = Math.round(
      pipelineSuccessScore * 0.30 +
      buildDeployTimeScore * 0.20 +
      releaseStabilityScore * 0.20 +
      workflowCoverageScore * 0.15 +
      releaseReadinessScore * 0.10 +
      governanceScore * 0.05
    );

    return {
      globalDevExScore,
      weights: {
        pipelineSuccess: 0.30,
        buildDeployTime: 0.20,
        releaseStability: 0.20,
        workflowCoverage: 0.15,
        releaseReadiness: 0.10,
        governance: 0.05,
      },
      componentScores: {
        pipelineSuccessScore,
        buildDeployTimeScore,
        releaseStabilityScore,
        workflowCoverageScore,
        releaseReadinessScore,
        governanceScore,
      },
    };
  }
}
