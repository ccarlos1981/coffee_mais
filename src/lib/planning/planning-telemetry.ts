import { logAuditAction } from "@/lib/supabase/auth-helpers";

export interface QueryTiming {
  name: string;
  durationMs: number;
  recordCount: number;
}

export interface StructuredLogPayload {
  requestId: string;
  timestamp: string;
  userId: string;
  managerId: string;
  year: number;
  executionTimeMs: number;
  queryTimings: Record<string, number>;
  recordCounts: {
    redes: number;
    sales: number;
    metas: number;
  };
  payloadSizeBytes: number;
  status: "SUCCESS" | "ERROR";
  error?: string;
}

export interface AlertItem {
  id: string;
  severity: "HIGH" | "MEDIUM" | "CRITICAL";
  code: "LATENCY_HIGH" | "HTTP_500" | "FINANCIAL_PARITY_DEV" | "DUPLICATE_REDE" | "NULL_MATRIZ" | "NULL_MANAGER";
  message: string;
  timestamp: string;
  details?: any;
}

export interface PerformanceMetrics {
  totalRequests: number;
  errorCount: number;
  timeoutCount: number;
  avgTimeMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  avgPayloadBytes: number;
  avgRedesCount: number;
}

export interface OperationalDashboardData {
  healthStatus: "OPTIMAL" | "ATTENTION" | "CRITICAL";
  metrics: PerformanceMetrics;
  recentAlerts: AlertItem[];
  recentAuditLogs: StructuredLogPayload[];
  queryPerformance: {
    viewSqlAvgMs: number;
    salesMvAvgMs: number;
    metasTableAvgMs: number;
  };
}

// Ring buffer store for execution metrics in memory
const executionHistory: StructuredLogPayload[] = [];
const activeAlerts: AlertItem[] = [];
const MAX_HISTORY = 1000;

export class PlanningTelemetry {
  /**
   * Generates a unique UUID v4 format request ID
   */
  public static createRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Logs structured request telemetry, evaluates alerts, and persists audit logs.
   */
  public static async logRequest(log: StructuredLogPayload): Promise<void> {
    // 1. In-memory buffer update
    executionHistory.unshift(log);
    if (executionHistory.length > MAX_HISTORY) {
      executionHistory.pop();
    }

    // 2. Structured JSON stdout logger
    console.log(`[PLANNING_TELEMETRY] ${JSON.stringify(log)}`);

    // 3. Evaluate operational alerts
    this.evaluateAlerts(log);

    // 4. Persist to audit log asynchronously if userId is available
    if (log.userId && log.userId !== "anonymous" && log.userId !== "system") {
      try {
        await logAuditAction(log.userId, "ACCESS_METAS_REDE", "vw_redes_planejaveis_oficiais", {
          requestId: log.requestId,
          year: log.year,
          executionTimeMs: log.executionTimeMs,
          payloadSizeBytes: log.payloadSizeBytes,
          status: log.status
        });
      } catch (err) {
        console.warn("[PlanningTelemetry] Failed to log audit action:", err);
      }
    }
  }

  /**
   * Evaluates operational alerts based on strict SLAs and data quality thresholds
   */
  private static evaluateAlerts(log: StructuredLogPayload): void {
    const timestamp = log.timestamp;

    // Alert 1: Latency > 2 seconds
    if (log.executionTimeMs > 2000) {
      this.triggerAlert({
        id: `alert_lat_${log.requestId}`,
        severity: "HIGH",
        code: "LATENCY_HIGH",
        message: `SLA de latência violado: requisição levou ${log.executionTimeMs.toFixed(2)} ms (> 2000 ms).`,
        timestamp,
        details: { requestId: log.requestId, durationMs: log.executionTimeMs }
      });
    }

    // Alert 2: HTTP 500 / Error
    if (log.status === "ERROR") {
      this.triggerAlert({
        id: `alert_err_${log.requestId}`,
        severity: "CRITICAL",
        code: "HTTP_500",
        message: `Erro de execução na API Metas por Rede: ${log.error || "Erro desconhecido"}`,
        timestamp,
        details: { requestId: log.requestId, error: log.error }
      });
    }
  }

  /**
   * Triggers data quality alerts (Null matriz, null manager, duplicate rede, financial parity deviation)
   */
  public static triggerDataQualityAlert(
    code: "DUPLICATE_REDE" | "NULL_MATRIZ" | "NULL_MANAGER" | "FINANCIAL_PARITY_DEV",
    message: string,
    details?: any
  ): void {
    this.triggerAlert({
      id: `alert_dq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      severity: code === "FINANCIAL_PARITY_DEV" ? "CRITICAL" : "HIGH",
      code,
      message,
      timestamp: new Date().toISOString(),
      details
    });
  }

  private static triggerAlert(alert: AlertItem): void {
    activeAlerts.unshift(alert);
    if (activeAlerts.length > 100) activeAlerts.pop();
    console.error(`[PLANNING_ALERT] [${alert.severity}] [${alert.code}] ${alert.message}`);
  }

  /**
   * Calculates performance metrics (Avg, P50, P95, P99, Timeouts, Errors, Payload size)
   */
  public static getMetrics(): PerformanceMetrics {
    const totalRequests = executionHistory.length;
    if (totalRequests === 0) {
      return {
        totalRequests: 0,
        errorCount: 0,
        timeoutCount: 0,
        avgTimeMs: 0,
        p50Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
        avgPayloadBytes: 0,
        avgRedesCount: 0
      };
    }

    const times = executionHistory.map(l => l.executionTimeMs).sort((a, b) => a - b);
    const sumTime = times.reduce((a, b) => a + b, 0);
    const errorCount = executionHistory.filter(l => l.status === "ERROR").length;
    const timeoutCount = executionHistory.filter(l => l.executionTimeMs > 2000).length;
    const sumPayload = executionHistory.reduce((a, b) => a + b.payloadSizeBytes, 0);
    const sumRedes = executionHistory.reduce((a, b) => a + b.recordCounts.redes, 0);

    const getPercentile = (p: number) => {
      const idx = Math.floor((p / 100) * times.length);
      return times[Math.min(idx, times.length - 1)] || 0;
    };

    return {
      totalRequests,
      errorCount,
      timeoutCount,
      avgTimeMs: Number((sumTime / totalRequests).toFixed(2)),
      p50Ms: Number(getPercentile(50).toFixed(2)),
      p95Ms: Number(getPercentile(95).toFixed(2)),
      p99Ms: Number(getPercentile(99).toFixed(2)),
      avgPayloadBytes: Math.round(sumPayload / totalRequests),
      avgRedesCount: Math.round(sumRedes / totalRequests)
    };
  }

  /**
   * Returns complete telemetry dashboard data for operational monitoring
   */
  public static getDashboardData(): OperationalDashboardData {
    const metrics = this.getMetrics();
    const recentAlerts = [...activeAlerts];
    const recentAuditLogs = executionHistory.slice(0, 50);

    let healthStatus: "OPTIMAL" | "ATTENTION" | "CRITICAL" = "OPTIMAL";
    if (metrics.errorCount > 0 || recentAlerts.some(a => a.severity === "CRITICAL")) {
      healthStatus = "CRITICAL";
    } else if (metrics.timeoutCount > 0 || recentAlerts.some(a => a.severity === "HIGH")) {
      healthStatus = "ATTENTION";
    }

    // Query averages
    let viewSum = 0, salesSum = 0, metasSum = 0, count = 0;
    executionHistory.forEach(log => {
      if (log.queryTimings) {
        viewSum += log.queryTimings.viewSql || 0;
        salesSum += log.queryTimings.salesMv || 0;
        metasSum += log.queryTimings.metasTable || 0;
        count++;
      }
    });

    return {
      healthStatus,
      metrics,
      recentAlerts,
      recentAuditLogs,
      queryPerformance: {
        viewSqlAvgMs: count ? Number((viewSum / count).toFixed(2)) : 0,
        salesMvAvgMs: count ? Number((salesSum / count).toFixed(2)) : 0,
        metasTableAvgMs: count ? Number((metasSum / count).toFixed(2)) : 0
      }
    };
  }
}
