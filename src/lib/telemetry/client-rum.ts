"use client";

// --------------------------------------------------------------------------
// 1. TIPAGENS RUM
// --------------------------------------------------------------------------

export interface ClientRumPayload {
  eventType: "error" | "unhandled_rejection" | "web_vital" | "navigation";
  route: string;
  timestamp: string;
  errorType?: string;
  errorMessage?: string;
  stack?: string;
  metricName?: string;
  metricValue?: number;
  durationMs?: number;
  userAgent?: string;
}

// --------------------------------------------------------------------------
// 2. DEDUPLICAÇÃO DE EVENTOS (JANELA DE 5 SEGUNDOS)
// --------------------------------------------------------------------------

const DEDUP_WINDOW_MS = 5000;
const recentEvents = new Map<string, number>();

function getEventFingerprint(payload: Partial<ClientRumPayload>): string {
  const route = payload.route || "";
  const type = payload.eventType || "";
  const msg = (payload.errorMessage || payload.metricName || "").slice(0, 120);
  return `${type}:${route}:${msg}`;
}

function shouldThrottleEvent(fingerprint: string): boolean {
  const now = Date.now();
  const lastTime = recentEvents.get(fingerprint);

  if (lastTime && now - lastTime < DEDUP_WINDOW_MS) {
    return true; // Duplicado na janela de 5s
  }

  recentEvents.set(fingerprint, now);

  // Limpeza de memória periódica
  if (recentEvents.size > 200) {
    for (const [key, time] of recentEvents.entries()) {
      if (now - time > DEDUP_WINDOW_MS * 2) {
        recentEvents.delete(key);
      }
    }
  }

  return false;
}

// --------------------------------------------------------------------------
// 3. ENVIO FAIL-SAFE VIA SEND BEACON COM FALLBACK
// --------------------------------------------------------------------------

const RUM_ENDPOINT = "/api/telemetry/rum";

export function emitRumEvent(payload: ClientRumPayload): void {
  try {
    if (typeof window === "undefined") return;

    const fingerprint = getEventFingerprint(payload);
    if (shouldThrottleEvent(fingerprint)) {
      return;
    }

    const jsonString = JSON.stringify(payload);

    // 1. Tentar navigator.sendBeacon
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([jsonString], { type: "application/json" });
      const sent = navigator.sendBeacon(RUM_ENDPOINT, blob);
      if (sent) return;
    }

    // 2. Fallback assíncrono não bloqueante via fetch
    if (typeof fetch === "function") {
      setTimeout(() => {
        try {
          fetch(RUM_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: jsonString,
            keepalive: true,
          }).catch(() => {
            // Silencioso
          });
        } catch {
          // Silencioso
        }
      }, 0);
    }
  } catch {
    // Fail-safe absoluto: nunca quebra a UI
  }
}

// --------------------------------------------------------------------------
// 4. REPORT DE ERROS MANUAIS E DO ERROR BOUNDARY
// --------------------------------------------------------------------------

export function reportClientError(
  error: unknown,
  context?: { componentStack?: string; route?: string }
): void {
  try {
    if (typeof window === "undefined") return;

    const route = context?.route || (typeof window !== "undefined" ? window.location.pathname : "/");
    let errorType = "UnknownError";
    let errorMessage = "Erro não especificado";
    let stack: string | undefined = undefined;

    if (error instanceof Error) {
      errorType = error.name || "Error";
      errorMessage = error.message || "Erro desconhecido";
      stack = error.stack;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    if (context?.componentStack) {
      stack = stack ? `${stack}\nComponent Stack: ${context.componentStack}` : context.componentStack;
    }

    emitRumEvent({
      eventType: "error",
      route,
      timestamp: new Date().toISOString(),
      errorType,
      errorMessage,
      stack: stack ? stack.slice(0, 2000) : undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    });
  } catch {
    // Silencioso
  }
}

// --------------------------------------------------------------------------
// 5. INICIALIZAÇÃO SINGLETON DOS LISTENERS GLOBAIS
// --------------------------------------------------------------------------

let isRumInitialized = false;

export function initClientRum(): void {
  try {
    if (typeof window === "undefined" || isRumInitialized) return;
    isRumInitialized = true;

    // A. Listener global de erros de runtime JavaScript
    window.addEventListener("error", (event: ErrorEvent) => {
      try {
        emitRumEvent({
          eventType: "error",
          route: window.location.pathname,
          timestamp: new Date().toISOString(),
          errorType: event.error?.name || "RuntimeError",
          errorMessage: event.message || "Erro de script",
          stack: event.error?.stack ? String(event.error.stack).slice(0, 1500) : undefined,
          userAgent: navigator.userAgent,
        });
      } catch {
        // Silencioso
      }
    });

    // B. Listener global de Promises rejeitadas não tratadas
    window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
      try {
        const reason = event.reason;
        const msg = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "Promise Rejeitada";
        const stack = reason instanceof Error ? reason.stack : undefined;

        emitRumEvent({
          eventType: "unhandled_rejection",
          route: window.location.pathname,
          timestamp: new Date().toISOString(),
          errorType: reason instanceof Error ? reason.name : "UnhandledRejection",
          errorMessage: msg,
          stack: stack ? String(stack).slice(0, 1500) : undefined,
          userAgent: navigator.userAgent,
        });
      } catch {
        // Silencioso
      }
    });

    // C. Coleta leve de Web Vitals nativos (via PerformanceObserver se suportado)
    if (typeof PerformanceObserver !== "undefined") {
      // 1. LCP (Largest Contentful Paint)
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            emitRumEvent({
              eventType: "web_vital",
              route: window.location.pathname,
              timestamp: new Date().toISOString(),
              metricName: "LCP",
              metricValue: Number(lastEntry.startTime.toFixed(2)),
            });
          }
        });
        lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
      } catch {}

      // 2. FCP (First Contentful Paint)
      try {
        const fcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntriesByName("first-contentful-paint");
          if (entries.length > 0) {
            emitRumEvent({
              eventType: "web_vital",
              route: window.location.pathname,
              timestamp: new Date().toISOString(),
              metricName: "FCP",
              metricValue: Number(entries[0].startTime.toFixed(2)),
            });
          }
        });
        fcpObserver.observe({ type: "paint", buffered: true });
      } catch {}
    }
  } catch {
    // Silencioso
  }
}
