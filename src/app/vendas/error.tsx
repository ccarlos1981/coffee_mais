"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function VendasError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log do erro técnico de forma segura (sem vazar dados de auth ou credenciais)
    console.error("[VendasErrorBoundary] Erro capturado:", error.message, error.digest || "");
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background, #0f1117)",
        color: "var(--foreground, #f3f4f6)",
        padding: "24px",
      }}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: 520,
          width: "100%",
          padding: "36px 28px",
          textAlign: "center",
          borderRadius: "16px",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(239, 68, 68, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <AlertTriangle style={{ width: 28, height: 28, color: "var(--danger, #ef4444)" }} />
        </div>

        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            marginBottom: 8,
            color: "var(--foreground, #ffffff)",
            letterSpacing: "-0.01em",
          }}
        >
          Instabilidade ao carregar o Acompanhamento
        </h2>

        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--foreground-muted, #9ca3af)",
            lineHeight: 1.5,
            marginBottom: 24,
          }}
        >
          Ocorreu uma falha temporária ao processar as visualizações do painel.
          Suas informações e permissões permanecem seguras.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => reset()}
            className="cm-btn-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              fontSize: "0.85rem",
              fontWeight: 600,
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            <RefreshCw style={{ width: 14, height: 14 }} />
            Tentar novamente
          </button>

          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              fontSize: "0.85rem",
              fontWeight: 500,
              borderRadius: "8px",
              color: "var(--foreground-secondary, #d1d5db)",
              border: "1px solid var(--border, #374151)",
              background: "transparent",
              textDecoration: "none",
            }}
          >
            <Home style={{ width: 14, height: 14 }} />
            Menu Principal
          </Link>
        </div>
      </div>
    </div>
  );
}
