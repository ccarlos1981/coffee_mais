import { NextRequest, NextResponse } from "next/server";
import { ServerLogger, sanitizeString } from "@/lib/telemetry/server-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --------------------------------------------------------------------------
// 1. RATE LIMITING EM MEMÓRIA (BOUNDED - SLIDING WINDOW POR IP)
// --------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 60; // Max 60 eventos/minuto por IP

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const ipRateLimitMap = new Map<string, RateLimitRecord>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = ipRateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    ipRateLimitMap.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  record.count += 1;

  // Limpeza de IPs expirados
  if (ipRateLimitMap.size > 1000) {
    for (const [key, val] of ipRateLimitMap.entries()) {
      if (now > val.resetTime) {
        ipRateLimitMap.delete(key);
      }
    }
  }

  return false;
}

// --------------------------------------------------------------------------
// 2. HANDLER POST /api/telemetry/rum
// --------------------------------------------------------------------------

const ALLOWED_EVENT_TYPES = new Set(["error", "unhandled_rejection", "web_vital", "navigation"]);
const MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB

export async function POST(request: NextRequest) {
  try {
    // 1. Proteção de IP e Rate Limit
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    if (isRateLimited(clientIp)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // 2. Leitura e Limite de Payload
    const textBody = await request.text();
    if (textBody.length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    let payload: any;
    try {
      payload = JSON.parse(textBody);
    } catch {
      return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
    }

    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // 3. Validação de Whitelist
    const eventType = String(payload.eventType || "");
    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
    }

    const route = typeof payload.route === "string" ? sanitizeString(payload.route.slice(0, 500)) : undefined;
    const errorType = typeof payload.errorType === "string" ? payload.errorType.slice(0, 100) : undefined;
    const errorMessage = typeof payload.errorMessage === "string" ? sanitizeString(payload.errorMessage.slice(0, 2000)) : undefined;
    const stack = typeof payload.stack === "string" ? sanitizeString(payload.stack.slice(0, 4000)) : undefined;
    const metricName = typeof payload.metricName === "string" ? payload.metricName.slice(0, 50) : undefined;
    const metricValue = typeof payload.metricValue === "number" ? payload.metricValue : undefined;
    const durationMs = typeof payload.durationMs === "number" ? payload.durationMs : undefined;
    const userAgent = typeof payload.userAgent === "string" ? sanitizeString(payload.userAgent.slice(0, 500)) : undefined;

    // 4. Registro no Server Logger (Ring Buffer + stdout)
    const level = eventType === "error" || eventType === "unhandled_rejection" ? "error" : "info";

    ServerLogger.log(level, {
      requestId: request.headers.get("x-request-id") || undefined,
      route,
      errorType,
      errorMessage,
      stack,
      metricName,
      metricValue,
      durationMs,
      userAgent,
      source: "client_rum",
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    // Fail-safe absoluto: retorna 200 para não quebrar clients
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
