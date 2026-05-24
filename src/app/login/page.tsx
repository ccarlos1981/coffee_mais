"use client";

import { useState } from "react";
import { Coffee, Lock, Mail, Eye, EyeOff, AlertCircle } from "lucide-react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await login(formData);
    if (result?.error) {
      setError(
        result.error === "Invalid login credentials"
          ? "E-mail ou senha inválidos."
          : result.error
      );
      setLoading(false);
    }
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
        {/* Logo */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "36px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px 24px",
              borderRadius: "16px",
              background:
                "linear-gradient(135deg, #c8a96e 0%, #8b6914 100%)",
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
            borderRadius: "12px",
            padding: "32px 28px",
            boxShadow:
              "0 4px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(200,169,110,0.04)",
          }}
        >
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "var(--foreground)",
              marginBottom: "4px",
            }}
          >
            Entrar
          </h2>
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--foreground-muted)",
              marginBottom: "24px",
            }}
          >
            Acesse sua conta para continuar
          </p>

          {/* Error */}
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
              <AlertCircle
                style={{ width: 16, height: 16, flexShrink: 0 }}
              />
              {error}
            </div>
          )}

          <form action={handleSubmit}>
            {/* Email */}
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
                E-mail
              </label>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Mail
                  style={{
                    position: "absolute",
                    left: "12px",
                    width: 16,
                    height: 16,
                    color: "var(--foreground-dim)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="seu@email.com"
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
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor =
                      "var(--accent-gold)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border)")
                  }
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                <label
                  htmlFor="password"
                  style={{
                    display: "block",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "var(--foreground-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Senha
                </label>
                <a href="/esqueci-senha" style={{ fontSize: "0.7rem", color: "var(--accent-gold)", textDecoration: "none" }}>
                  Esqueci minha senha
                </a>
              </div>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Lock
                  style={{
                    position: "absolute",
                    left: "12px",
                    width: 16,
                    height: 16,
                    color: "var(--foreground-dim)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
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
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor =
                      "var(--accent-gold)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border)")
                  }
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
                  {showPassword ? (
                    <EyeOff style={{ width: 16, height: 16 }} />
                  ) : (
                    <Eye style={{ width: 16, height: 16 }} />
                  )}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", marginBottom: "24px" }}>
              <input
                type="checkbox"
                id="remember"
                name="remember"
                defaultChecked
                style={{
                  marginRight: "8px",
                  accentColor: "var(--accent-gold)",
                  cursor: "pointer"
                }}
              />
              <label htmlFor="remember" style={{ fontSize: "0.75rem", color: "var(--foreground-secondary)", cursor: "pointer" }}>
                Lembrar de mim
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "11px 0",
                background: loading
                  ? "var(--foreground-dim)"
                  : "linear-gradient(135deg, #c8a96e 0%, #a08040 100%)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 700,
                letterSpacing: "0.03em",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                boxShadow: loading
                  ? "none"
                  : "0 4px 16px rgba(200,169,110,0.3)",
              }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div style={{ marginTop: "24px", textAlign: "center", fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
            Não tem uma conta? <a href="/cadastro" style={{ color: "var(--accent-gold)", fontWeight: 600, textDecoration: "none" }}>Cadastre-se</a>
          </div>
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
          Coffee Mais © {new Date().getFullYear()} — Todos os direitos
          reservados
        </p>
      </div>
    </div>
  );
}
