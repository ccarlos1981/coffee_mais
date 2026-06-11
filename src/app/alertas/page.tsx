"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  Home,
  BarChart3,
  History,
  Target,
  Upload,
  Users,
  AlertTriangle,
  CheckCircle2,
  Send,
  MessageSquare,
  DollarSign,
  PieChart,
  Briefcase,
  Layers,
  Package,
  Calendar,
  TrendingUp
} from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { ThemeToggle } from "@/components/ThemeProvider";

interface Alert {
  id: string;
  client_name: string;
  manager: string;
  fat_current: number;
  fat_previous: number;
  drop_pct: number;
  alert_type: string;
  status: string;
  alert_month: string;
  created_at: string;
  cm_action_notes?: { id: string; note: string; created_at: string; created_by: string }[];
}

export default function SmartActionHub() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedManager, setSelectedManager] = useState<string>("all");
  const [managersList, setManagersList] = useState<string[]>([]);
  const [actionInput, setActionInput] = useState<{ [key: string]: string }>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, [selectedManager]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const url = selectedManager !== 'all' 
        ? `/api/alertas?manager=${selectedManager}`
        : `/api/alertas`;

      const res = await fetch(url);
      const json = await res.json();

      if (json.success) {
        setAlerts(json.alerts);
        // Build unique managers list if not filtering
        if (selectedManager === 'all') {
           const mg = Array.from(new Set(json.alerts.map((a: Alert) => a.manager))) as string[];
           setManagersList(mg.sort());
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleRegisterAction = async (alert: Alert) => {
    const note = actionInput[alert.id];
    if (!note || note.trim() === "") return;

    setSavingId(alert.id);
    try {
      const res = await fetch('/api/alertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_id: alert.id,
          client_name: alert.client_name,
          note,
          created_by: "Sistema Automático", // TODO: Usuário Logado
          status_update: "TACKLED"
        })
      });
      
      if (res.ok) {
        // Update local state smoothly
        setAlerts(alerts.map(a => {
           if(a.id === alert.id) {
               return { 
                   ...a, 
                   status: 'TACKLED',
                   cm_action_notes: [
                       ...(a.cm_action_notes || []),
                       { id: 'optimistic', note, created_at: new Date().toISOString(), created_by: "Sistema Automático" }
                   ]
               }
           }
           return a;
        }));
        setActionInput(prev => ({ ...prev, [alert.id]: "" }));
      }
    } catch (e) {
      console.error(e);
    }
    setSavingId(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="glass-card p-8 w-full max-w-sm text-center relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-amber-500/5 z-0" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 mb-6 shadow-lg shadow-violet-500/30">
              <Bell className="w-6 h-6 text-white" />
            </div>
            
            <h2 className="text-xl font-bold text-foreground mb-2">Acesso Restrito</h2>
            <p className="text-sm text-muted mb-6">Por favor, digite a senha para acessar o Smart Action Hub.</p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (passwordInput === "123456") {
                setIsAuthenticated(true);
                setError(null);
              } else {
                setError("Senha incorreta");
              }
            }} className="w-full flex flex-col gap-4">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Senha"
                className="w-full bg-background border border-border-light rounded-xl px-4 py-3 text-center tracking-widest text-foreground placeholder:tracking-normal placeholder:text-dim focus:outline-none focus:border-violet-500"
                autoFocus
              />
              
              {error && <p className="text-xs text-red-400 -mt-2">{error}</p>}
              
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white font-medium transition-all shadow-lg shadow-violet-500/20"
              >
                Acessar
              </button>
            </form>

            <Link href="/" className="mt-8 flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors">
              <Home className="w-4 h-4" /> Voltar ao Menu Inicial
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", paddingBottom: 80 }}>
      {/* ═══ NAVBAR ═══ */}
      <nav className="cm-navbar" style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <Link href="/" className="cm-logo">Coffee<span>++</span></Link>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center" }}>
          <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--foreground)" }}>Painel de Alertas</h1>
          <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)" }}>Smart Action Hub</p>
        </div>
        <div className="cm-nav-right">
          <ThemeToggle />
        </div>
      </nav>

      {/* ═══ BODY ═══ */}
      <main style={{ padding: "16px", maxWidth: "800px", margin: "0 auto" }}>
        
        {/* Filtros em dispositivos móveis precisam ser amigáveis */}
        <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
           <select 
             className="dash-filter-select"
             style={{ width: "100%", maxWidth: 200, padding: "8px 12px", background: "var(--card-bg)" }}
             value={selectedManager} 
             onChange={(e) => setSelectedManager(e.target.value)}
           >
             <option value="all">Visão Global (Todos)</option>
             {managersList.map(m => <option key={m} value={m}>{m}</option>)}
           </select>

           {loading && <div style={{ width: 16, height: 16, border: "2px solid var(--accent-gold)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
        </div>

        {/* Lista de Alertas (Cards Mobile First) */}
        {alerts.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--foreground-dim)" }}>
            <CheckCircle2 style={{ width: 40, height: 40, margin: "0 auto 10px", color: "var(--success)" }} />
            <p>Nenhum alerta crítico ativo no momento.</p>
            <p style={{ fontSize: "0.8rem", marginTop: 4 }}>O sistema gera alertas automaticamente durante a noite.</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {alerts.map((alert) => {
            const isSevere = alert.drop_pct >= 60;
            return (
              <div key={alert.id} className="glass-card" style={{ padding: 16, borderLeft: `4px solid ${isSevere ? 'var(--danger)' : 'var(--warning)'}` }}>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", color: "var(--foreground-secondary)" }}>
                      {alert.manager} 
                    </span>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", lineHeight: 1.2 }}>{alert.client_name}</h3>
                  </div>
                  {alert.status === 'PENDING' ? (
                    <span style={{ padding: "4px 8px", background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", borderRadius: 12, fontSize: "0.6rem", fontWeight: 700 }}>
                      PENDENTE
                    </span>
                  ) : (
                    <span style={{ padding: "4px 8px", background: "rgba(34, 197, 94, 0.1)", color: "var(--success)", borderRadius: 12, fontSize: "0.6rem", fontWeight: 700 }}>
                      AÇÃO Mapeada
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16, background: "rgba(0,0,0,0.1)", padding: 12, borderRadius: 8 }}>
                   <div>
                      <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)" }}>Queda</p>
                      <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--danger)", display: "flex", alignItems: "center", gap: 4 }}>
                          <AlertTriangle style={{ width: 12, height: 12 }} />
                          -{formatPercent(alert.drop_pct)}
                      </p>
                   </div>
                   <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)" }}>Faltam (Gap R$)</p>
                      <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--foreground)" }}>
                          {formatCurrency((alert.fat_previous - alert.fat_current) / 1000)}k
                      </p>
                   </div>
                </div>

                {/* Histórico de Ações */}
                {alert.cm_action_notes && alert.cm_action_notes.length > 0 && (
                   <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--foreground-muted)", marginBottom: 8 }}>DIÁRIO DA MATRIZ:</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                         {alert.cm_action_notes.map((note, idx) => (
                            <div key={idx} style={{ background: "var(--background)", padding: "10px", borderRadius: 6, border: "1px solid var(--border-light)" }}>
                               <p style={{ fontSize: "0.75rem", color: "var(--foreground)" }}>"{note.note}"</p>
                               <span style={{ fontSize: "0.6rem", color: "var(--foreground-dim)", display: "block", marginTop: 4 }}>
                                  {new Date(note.created_at).toLocaleDateString()} — {note.created_by}
                               </span>
                            </div>
                         ))}
                      </div>
                   </div>
                )}

                {/* Input Ação */}
                <div style={{ display: "flex", gap: 8 }}>
                   <input 
                      type="text" 
                      placeholder="Registrar visita, feedback ou ação..."
                      style={{ flex: 1, padding: "10px", borderRadius: 6, border: "1px solid var(--border-light)", background: "var(--background)", color: "var(--foreground)" }}
                      value={actionInput[alert.id] || ""}
                      onChange={(e) => setActionInput({...actionInput, [alert.id]: e.target.value})}
                      onKeyDown={(e) => e.key === 'Enter' && handleRegisterAction(alert)}
                   />
                   <button 
                      onClick={() => handleRegisterAction(alert)}
                      className="cm-btn-clear"
                      style={{ background: "var(--accent-gold)", color: "#000", padding: "10px", height: "auto", border: "none" }}
                      disabled={savingId === alert.id || !actionInput[alert.id]}
                   >
                     <Send style={{ width: 14, height: 14 }} />
                   </button>
                </div>

              </div>
            );
          })}
        </div>
      </main>

      {/* ═══ BOTTOM TAB BAR ═══ */}
      <nav className="bottom-tabs" style={{ position: "fixed", bottom: 0, width: "100%" }}>
        <Link href="/" className="bottom-tab"><Home className="bottom-tab-icon" /> Menu</Link>
        <Link href="/vendas" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Vendas</Link>
        <Link href="/historico" className="bottom-tab"><History className="bottom-tab-icon" /> Hist.</Link>
        <Link href="/matriz" className="bottom-tab"><Users className="bottom-tab-icon" /> Matriz</Link>
        {/* NEW SMART ACTION HUB LINK */}
        <Link href="/alertas" className="bottom-tab active"><Bell className="bottom-tab-icon" /> Alertas</Link>
        <Link href="/preco" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Preço</Link>
        <Link href="/dia" className="bottom-tab"><Calendar className="bottom-tab-icon" /> Dia</Link>
        <span className="bottom-tab disabled"><Briefcase className="bottom-tab-icon" /> Carteira</span>
        <span className="bottom-tab disabled"><Package className="bottom-tab-icon" /> Bonif.</span>
        <span className="bottom-tab disabled"><Layers className="bottom-tab-icon" /> Devol.</span>
        <Link href="/metas" className="bottom-tab"><Target className="bottom-tab-icon" /> Metas</Link>
        <Link href="/upload" className="bottom-tab"><Upload className="bottom-tab-icon" /> Upload</Link>
        <Link href="/atendimento" className="bottom-tab"><Users className="bottom-tab-icon" /> Atendimento</Link>
        <span className="bottom-tab disabled"><DollarSign className="bottom-tab-icon" /> DRE</span>
      </nav>
    </div>
  );
}
