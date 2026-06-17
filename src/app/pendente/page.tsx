"use client";

import { Coffee, Clock, LogOut } from "lucide-react";
import { useState } from "react";

export default function PendentePage() {
  const [loading, setLoading] = useState(false);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at 30% 20%, rgba(200,169,110,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(61,107,61,0.06) 0%, transparent 50%), var(--background)",
        padding: "20px",
      }}
    >
      {/* Decorative grain overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          position: "relative",
          zIndex: 1,
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: "32px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px 24px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #c8a96e 0%, #8b6914 100%)",
              marginBottom: "16px",
              boxShadow: "0 8px 32px rgba(200,169,110,0.25)",
            }}
          >
            <img
              src="https://coffeemais.com/cdn/shop/files/logo-coffee-mais-branca.png?v=1687448656&width=400"
              alt="Coffee Mais"
              style={{ height: "40px", objectFit: "contain" }}
            />
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display, serif)",
              fontSize: "1.8rem",
              fontWeight: 700,
              color: "var(--foreground)",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            Coffee<span style={{ color: "var(--accent-gold)" }}>++</span>
          </h1>
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--foreground-muted)",
              marginTop: "6px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Apuração de Resultados
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--background-card)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "40px 32px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.2), 0 0 0 1px rgba(200,169,110,0.05)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Top Gold Border */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "3px",
              background: "linear-gradient(90deg, transparent, var(--accent-gold), transparent)",
            }}
          />

          {/* Animated/Glowing Icon */}
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "rgba(200,169,110,0.08)",
              border: "1px solid rgba(200,169,110,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
              color: "var(--accent-gold)",
              boxShadow: "0 0 20px rgba(200,169,110,0.05)",
            }}
          >
            <Clock style={{ width: 32, height: 32 }} className="animate-pulse" />
          </div>

          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "var(--foreground)",
              marginBottom: "12px",
              fontFamily: "var(--font-display, serif)",
            }}
          >
            Acesso em Análise
          </h2>
          
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--foreground-secondary)",
              lineHeight: 1.6,
              marginBottom: "28px",
            }}
          >
            O seu cadastro foi realizado com sucesso, mas para garantir a segurança dos dados da companhia, o seu acesso precisa ser liberado por um administrador.
          </p>

          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "12px 16px",
              fontSize: "0.75rem",
              color: "var(--foreground-muted)",
              textAlign: "left",
              marginBottom: "32px",
              display: "flex",
              alignItems: "start",
              gap: "10px",
            }}
          >
            <Coffee style={{ width: 16, height: 16, color: "var(--accent-gold)", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <strong>O que acontece agora?</strong>
              <p style={{ marginTop: "4px", color: "var(--foreground-muted)" }}>
                O administrador da plataforma foi notificado. Assim que ele liberar o seu e-mail, você poderá acessar o dashboard normalmente.
              </p>
            </div>
          </div>

          {/* Form to Logout */}
          <form action="/auth/signout" method="post" onSubmit={() => setLoading(true)}>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px 0",
                background: "transparent",
                color: "var(--foreground-secondary)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--danger)";
                e.currentTarget.style.color = "var(--danger)";
                e.currentTarget.style.background = "rgba(224,85,85,0.04)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.color = "var(--foreground-secondary)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <LogOut style={{ width: 16, height: 16 }} />
              {loading ? "Saindo..." : "Sair / Entrar com outra conta"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p
          style={{
            textAlign: "center",
            fontSize: "0.65rem",
            color: "var(--foreground-dim)",
            marginTop: "24px",
            letterSpacing: "0.02em",
          }}
        >
          Coffee Mais © {new Date().getFullYear()} — Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
