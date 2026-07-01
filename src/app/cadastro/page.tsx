"use client";

import { useState } from "react";
import { Coffee, Lock, Mail, Eye, EyeOff, AlertCircle, Briefcase, CheckCircle2, Phone, MapPin, User } from "lucide-react";
import { signUp } from "./actions";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function CadastroPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [phoneValue, setPhoneValue] = useState("");

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 10) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 6) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
    } else if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else if (value.length > 0) {
      value = `(${value}`;
    }
    setPhoneValue(value);
  };

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
              display: "inline-block",
              position: "relative",
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              overflow: "hidden",
              border: "1px solid var(--border)",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
              marginBottom: "16px",
              background: "#000",
            }}
          >
            <img 
              src="/images/login/logo_white.png" 
              alt="Coffee Mais" 
              style={{ width: "100%", height: "100%", objectFit: "cover" }} 
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
            {/* Nome */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
              <div style={{ flex: 1 }}>
                <label
                  htmlFor="first_name"
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
                  Primeiro nome
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <User style={{ position: "absolute", left: "12px", width: 16, height: 16, color: "var(--foreground-dim)", pointerEvents: "none" }} />
                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    required
                    placeholder="João"
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
              <div style={{ flex: 1 }}>
                <label
                  htmlFor="last_name"
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
                  Último nome
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <User style={{ position: "absolute", left: "12px", width: 16, height: 16, color: "var(--foreground-dim)", pointerEvents: "none" }} />
                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    required
                    placeholder="Silva"
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
            </div>

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
                htmlFor="phone"
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
                Celular / WhatsApp
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Phone style={{ position: "absolute", left: "12px", width: 16, height: 16, color: "var(--foreground-dim)", pointerEvents: "none" }} />
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  placeholder="(31) 99999-9999"
                  value={phoneValue}
                  onChange={handlePhoneChange}
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
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
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

            {selectedRole === "Promotor" && (
              <div style={{ marginBottom: "16px" }}>
                <label
                  htmlFor="uf"
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
                  UF (Estado de atuação)
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <MapPin style={{ position: "absolute", left: "12px", width: 16, height: 16, color: "var(--foreground-dim)", pointerEvents: "none" }} />
                  <select
                    id="uf"
                    name="uf"
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
                    <option value="">Selecione o estado...</option>
                    {UFS.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                  <div style={{ position: "absolute", right: "12px", pointerEvents: "none", color: "var(--foreground-dim)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                </div>
              </div>
            )}

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
              <p style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginTop: "6px", marginLeft: "2px" }}>
                Somente números
              </p>
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
