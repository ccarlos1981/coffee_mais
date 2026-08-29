import crypto from "crypto";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface TelemetryEvent {
  id: string;
  level: LogLevel;
  timestamp: string;
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  errorType?: string;
  errorMessage?: string;
  stack?: string;
  userAgent?: string;
  userRole?: string;
  metricName?: string;
  metricValue?: number;
  source: "server" | "client_rum";
}

// --------------------------------------------------------------------------
// 1. SANITIZAÇÃO DE DADOS (ZERO PII, ZERO FINANCEIRO, ZERO CREDENCIAIS)
// --------------------------------------------------------------------------

const FORBIDDEN_KEYS = new Set([
  "authorization",
  "cookie",
  "token",
  "refreshtoken",
  "password",
  "secret",
  "nome",
  "email",
  "telefone",
  "cpf",
  "endereco",
  "faturamento",
  "maco",
  "valor_meta",
  "roi",
  "vlr_total_liq",
  "vlr_desconto",
  "custo_total",
]);

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BEARER_REGEX = /Bearer\s+[A-Za-z0-9-_=.]+/gi;
const CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

export function sanitizeString(val: string | undefined): string | undefined {
  if (!val) return val;
  return val
    .replace(EMAIL_REGEX, "[REDACTED_EMAIL]")
    .replace(BEARER_REGEX, "Bearer [REDACTED_TOKEN]")
    .replace(CPF_REGEX, "[REDACTED_CPF]");
}

export function sanitizeLogPayload(payload: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase();
    if (FORBIDDEN_KEYS.has(lowerKey)) {
      clean[key] = "[REDACTED]";
      continue;
    }
    if (typeof value === "string") {
      clean[key] = sanitizeString(value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      clean[key] = sanitizeLogPayload(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

// --------------------------------------------------------------------------
// 2. RING BUFFER EM MEMÓRIA (BOUNDED - 100 EVENTOS LOCAIS)
// --------------------------------------------------------------------------

const RING_BUFFER_CAPACITY = 100;

class TelemetryRingBuffer {
  private buffer: TelemetryEvent[] = [];

  push(event: TelemetryEvent) {
    if (this.buffer.length >= RING_BUFFER_CAPACITY) {
      this.buffer.shift();
    }
    this.buffer.push(event);
  }

  getAll(): TelemetryEvent[] {
    return [...this.buffer];
  }

  getMetricsSummary() {
    const events = this.buffer;
    const latencies = events
      .filter((e) => typeof e.durationMs === "number")
      .map((e) => e.durationMs as number)
      .sort((a, b) => a - b);

    const errorCount = events.filter((e) => e.level === "error").length;
    const totalRequests = events.length;

    const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const p99 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0;

    return {
      sampleSize: totalRequests,
      errorCount,
      errorRatePct: totalRequests > 0 ? Number(((errorCount / totalRequests) * 100).toFixed(2)) : 0,
      latencyP50Ms: p50,
      latencyP95Ms: p95,
      latencyP99Ms: p99,
      note: "Estatísticas efêmeras da instância local (Ring Buffer 100 eventos).",
    };
  }

  clear() {
    this.buffer = [];
  }
}

export const telemetryRingBuffer = new TelemetryRingBuffer();

// --------------------------------------------------------------------------
// 3. LOGGER ESTRUTURADO JSON
// --------------------------------------------------------------------------

export function generateRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export class ServerLogger {
  static log(level: LogLevel, data: Omit<TelemetryEvent, "id" | "timestamp" | "level">) {
    try {
      const event: TelemetryEvent = {
        id: generateRequestId(),
        level,
        timestamp: new Date().toISOString(),
        requestId: data.requestId || generateRequestId(),
        route: data.route ? sanitizeString(data.route) : undefined,
        method: data.method,
        status: data.status,
        durationMs: data.durationMs,
        errorType: data.errorType,
        errorMessage: sanitizeString(data.errorMessage),
        stack: sanitizeString(data.stack),
        userAgent: data.userAgent ? sanitizeString(data.userAgent) : undefined,
        userRole: data.userRole,
        metricName: data.metricName,
        metricValue: data.metricValue,
        source: data.source || "server",
      };

      // 1. Armazena no buffer circular em memória da instância
      telemetryRingBuffer.push(event);

      // 2. Emite JSON estruturado para stdout/stderr
      const output = JSON.stringify(event);
      if (level === "error") {
        console.error(output);
      } else if (level === "warn") {
        console.warn(output);
      } else {
        console.log(output);
      }
    } catch {
      // Fail-safe silencioso: a telemetria nunca pode lançar exceções
    }
  }

  static info(data: Omit<TelemetryEvent, "id" | "timestamp" | "level">) {
    this.log("info", data);
  }

  static warn(data: Omit<TelemetryEvent, "id" | "timestamp" | "level">) {
    this.log("warn", data);
  }

  static error(data: Omit<TelemetryEvent, "id" | "timestamp" | "level">) {
    this.log("error", data);
  }
}
