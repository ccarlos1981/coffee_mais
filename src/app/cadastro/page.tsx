"use client";

import { useState } from "react";
import { Coffee, Lock, Mail, Eye, EyeOff, AlertCircle, Briefcase, CheckCircle2 } from "lucide-react";
import { signUp } from "./actions";

export default function CadastroPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const ROLES = [
    "Gerente Regional",
    "Trade",
    "Supervisor",
    "Vendedor",
    "Promotor",
    "Financeiro"
  ];

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const result = await signUp(formData);
    
    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setSuccess(result.success);
    }
    
    setLoading(false);
  }

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
          maxWidth: "400px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
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
            Criar Conta
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
            Cadastre-se na plataforma
          </p>
        </div>

        <div
          style={{
            background: "var(--background-card)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "32px 28px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(200,169,110,0.04)",
          }}
        >
          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                marginBottom: "20px",
                borderRadius: "8px",
                background: "rgba(224,85,85,0.08)",
                border: "1px solid rgba(224,85,85,0.2)",
                color: "var(--danger)",
                fontSize: "0.8rem",
              }}
            >
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                marginBottom: "20px",
                borderRadius: "8px",
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                color: "#10b981",
                fontSize: "0.8rem",
              }}
            >
              <CheckCircle2 style={{ width: 16, height: 16, flexShrink: 0 }} />
              {success}
            </div>
          )}

          <form action={handleSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "var(--foreground-secondary)",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                E-mail corporativo
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Mail style={{ position: "absolute", left: "12px", width: 16, height: 16, color: "var(--foreground-dim)", pointerEvents: "none" }} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="seu.nome@coffeemais.com"
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 40px",
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    color: "var(--foreground)",
                    fontSize: "0.85rem",
                    outline: "none",
                    transition: "border-color 0.2s ease",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-gold)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="role"
                style={{
                  display: "block",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "var(--foreground-secondary)",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Área de Atuação
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Briefcase style={{ position: "absolute", left: "12px", width: 16, height: 16, color: "var(--foreground-dim)", pointerEvents: "none" }} />
                <select
                  id="role"
                  name="role"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 40px",
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    color: "var(--foreground)",
                    fontSize: "0.85rem",
                    outline: "none",
                    transition: "border-color 0.2s ease",
                    appearance: "none",
                    cursor: "pointer"
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-gold)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <option value="">Selecione sua área...</option>
                  {ROLES.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                  <option value="RH">RH</option>
                </select>
                <div style={{ position: "absolute", right: "12px", pointerEvents: "none", color: "var(--foreground-dim)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                htmlFor="password"
                style={{
                  display: "block",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "var(--foreground-secondary)",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Senha
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Lock style={{ position: "absolute", left: "12px", width: 16, height: 16, color: "var(--foreground-dim)", pointerEvents: "none" }} />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  pattern="[0-9]*"
                  inputMode="numeric"
                  placeholder="Apenas números (mín. 6)"
                  minLength={6}
                  onKeyPress={(e) => {
                    if (!/[0-9]/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 44px 10px 40px",
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    color: "var(--foreground)",
                    fontSize: "0.85rem",
                    outline: "none",
                    transition: "border-color 0.2s ease",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-gold)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--foreground-dim)",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "11px 0",
                background: loading ? "var(--foreground-dim)" : "linear-gradient(135deg, #c8a96e 0%, #a08040 100%)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 700,
                letterSpacing: "0.03em",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                boxShadow: loading ? "none" : "0 4px 16px rgba(200,169,110,0.3)",
              }}
            >
              {loading ? "Cadastrando..." : "Cadastrar"}
            </button>
          </form>
          
          <div style={{ marginTop: "24px", textAlign: "center", fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
            Já tem uma conta? <a href="/login" style={{ color: "var(--accent-gold)", fontWeight: 600, textDecoration: "none" }}>Fazer Login</a>
          </div>
        </div>
      </div>
    </div>
  );
}
