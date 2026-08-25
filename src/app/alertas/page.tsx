"use client";

import { useState, useCallback, useEffect } from "react";
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
  TrendingUp,
  Lock,
  RefreshCw,
  ArrowLeft,
  Plus
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { ThemeToggle } from "@/components/ThemeProvider";
import { NewFollowUpModal, FollowUpInitialContext } from "@/app/processo-comercial/follow-up/components/NewFollowUpModal";
import { FollowUpStatusBadge } from "@/app/processo-comercial/follow-up/components/FollowUpStatusBadge";
import type { FollowUpActionRecord } from "@/lib/services/follow-up-service";

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
  const [authLoading, setAuthLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedManager, setSelectedManager] = useState<string>("all");
  const [managersList, setManagersList] = useState<string[]>([]);
  const [actionInput, setActionInput] = useState<{ [key: string]: string }>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Estados da Modal de Follow-up (OP-04)
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpContext, setFollowUpContext] = useState<FollowUpInitialContext | null>(null);
  const [followUpToast, setFollowUpToast] = useState<string | null>(null);
  const [alertFollowUps, setAlertFollowUps] = useState<Record<string, FollowUpActionRecord>>({});

  const fetchAlertFollowUps = useCallback(async () => {
    try {
      const res = await fetch(`/api/follow-up?origem=ALERTA_QUEDA&pageSize=100`, { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const map: Record<string, FollowUpActionRecord> = {};
        for (const act of json.data) {
          if (act.origem_ref) {
            map[act.origem_ref] = act;
          }
        }
        setAlertFollowUps(map);
      }
    } catch (err) {
      console.error("Erro ao buscar follow-ups de alertas:", err);
    }
  }, []);

  const handleOpenFollowUpAlert = (alert: Alert) => {
    setFollowUpContext({
      clienteNome: alert.client_name,
      manager_id: alert.manager,
      origem: "ALERTA_QUEDA",
      origem_ref: alert.id,
      tipo_acao: "RECUPERACAO_VOLUME",
      motivo: `Tratamento de Queda de Faturamento: ${alert.client_name}`,
      descricao: `Alerta: Queda de ${formatPercent(alert.drop_pct)} no mês ${alert.alert_month}.\nFaturamento Anterior: ${formatCurrency(alert.fat_previous)} | Faturamento Atual: ${formatCurrency(alert.fat_current)} | Gap: ${formatCurrency(alert.fat_previous - alert.fat_current)}.`,
      prioridade: alert.drop_pct >= 60 ? "CRITICA" : alert.drop_pct >= 40 ? "ALTA" : "MEDIA",
    });
    setIsFollowUpModalOpen(true);
  };

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedManager !== 'all' 
        ? `/api/alertas?manager=${selectedManager}`
        : `/api/alertas`;

      const [res] = await Promise.all([
        fetch(url),
        fetchAlertFollowUps(),
      ]);
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
  }, [selectedManager, fetchAlertFollowUps]);

  useEffect(() => {
    const checkAuthAndPermissions = async () => {
      try {
        setAuthLoading(true);
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
          setHasAccess(false);
          setAuthLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("cm_user_profiles")
          .select("role, approved")
          .eq("id", user.id)
          .single();

        if (!profile || !profile.approved) {
          setHasAccess(false);
          setAuthLoading(false);
          return;
        }

        const role = profile.role;
        setUserRole(role);

        // Super-usuários possuem acesso total
        if (role === "Admin" || role === "CEO" || role === "Admin Master" || role === "TI" || role === "Diretoria" || role === "Presidência" || role === "Gerente Nacional") {
          setHasAccess(true);
          setAuthLoading(false);
          return;
        }

        // Validação da permissão do módulo 'Alertas' na matriz de permissões
        const { data: perm } = await supabase
          .from("cm_role_permissions")
          .select("has_access")
          .eq("role", role)
          .eq("module_name", "Alertas")
          .maybeSingle();

        if (perm && perm.has_access) {
          setHasAccess(true);
        } else {
          setHasAccess(false);
        }
      } catch (err) {
        console.error("Erro na verificação de permissões do módulo Alertas:", err);
        setHasAccess(false);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuthAndPermissions();
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchAlerts();
    }
  }, [hasAccess, fetchAlerts]);

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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground gap-4">
        <RefreshCw className="w-8 h-8 text-violet-500 animate-spin" />
        <p className="text-sm text-muted">Verificando credenciais e permissões de acesso...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-foreground">
        <div className="glass-card p-8 max-w-md w-full text-center relative overflow-hidden shadow-2xl border border-border">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4 text-red-500">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Acesso Não Autorizado</h2>
          <p className="text-sm text-muted mb-6">
            Seu perfil ({userRole || "Não autenticado"}) não possui permissão para acessar o Painel de Alertas.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent/80 text-foreground text-sm font-medium transition-colors border border-border"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao Menu Inicial
          </Link>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {(() => {
                      const existingAction = alertFollowUps[alert.id];
                      if (existingAction) {
                        return (
                          <FollowUpStatusBadge
                            status={existingAction.status}
                            isAtrasada={existingAction.is_atrasada}
                            size="sm"
                            title={`Follow-up Vinculado: ${existingAction.status} (${existingAction.motivo})`}
                          />
                        );
                      }
                      if (alert.status === 'PENDING') {
                        return (
                          <span style={{ padding: "4px 8px", background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", borderRadius: 12, fontSize: "0.6rem", fontWeight: 700 }}>
                            PENDENTE
                          </span>
                        );
                      }
                      return (
                        <span style={{ padding: "4px 8px", background: "rgba(34, 197, 94, 0.1)", color: "var(--success)", borderRadius: 12, fontSize: "0.6rem", fontWeight: 700 }}>
                          AÇÃO Mapeada
                        </span>
                      );
                    })()}
                  </div>
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
                      <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--foreground-muted)", marginBottom: 8 }}>DIÁRIO DA REDE:</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                         {alert.cm_action_notes.map((note, idx) => (
                            <div key={idx} style={{ background: "var(--background)", padding: "10px", borderRadius: 6, border: "1px solid var(--border-light)" }}>
                               <p style={{ fontSize: "0.75rem", color: "var(--foreground)" }}>&quot;{note.note}&quot;</p>
                               <span style={{ fontSize: "0.6rem", color: "var(--foreground-dim)", display: "block", marginTop: 4 }}>
                                  {new Date(note.created_at).toLocaleDateString()} — {note.created_by}
                                </span>
                            </div>
                         ))}
                      </div>
                   </div>
                )}

                {/* Input Ação e Botão de Follow-up */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                      title="Salvar nota rápida"
                   >
                     <Send style={{ width: 14, height: 14 }} />
                   </button>
                   {(() => {
                      const existingAction = alertFollowUps[alert.id];
                      if (existingAction) {
                        return (
                          <span
                            style={{
                              background: "rgba(56, 189, 248, 0.1)",
                              color: "#38bdf8",
                              border: "1px solid rgba(56, 189, 248, 0.3)",
                              padding: "10px 14px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              borderRadius: 6,
                              display: "flex",
                              alignItems: "center",
                              gap: 6
                            }}
                            title={`Ação de Follow-up vinculada (${existingAction.status})`}
                          >
                            <CheckCircle2 style={{ width: 13, height: 13 }} />
                            <span>Ação Ativa</span>
                          </span>
                        );
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => handleOpenFollowUpAlert(alert)}
                          className="cm-btn-clear"
                          style={{ background: "rgba(245, 158, 11, 0.15)", color: "var(--accent-gold)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "10px 14px", height: "auto", fontSize: "0.75rem", fontWeight: 700, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                          title="Gerar Ação Oficial de Follow-up"
                        >
                          <Plus style={{ width: 13, height: 13 }} />
                          <span>Follow-up</span>
                        </button>
                      );
                   })()}
                </div>

              </div>
            );
          })}
        </div>

        {/* Toast Feedback */}
        {followUpToast && (
          <div style={{ position: "fixed", bottom: 70, right: 20, zIndex: 9999, padding: "12px 18px", background: "rgba(16, 185, 129, 0.95)", color: "#fff", fontWeight: 700, fontSize: "0.8rem", borderRadius: 10, boxShadow: "0 10px 25px rgba(0,0,0,0.3)" }}>
            {followUpToast}
          </div>
        )}

        {/* Modal Canônica de Criação de Follow-up (Alertas) */}
        {isFollowUpModalOpen && (
          <NewFollowUpModal
            isOpen={isFollowUpModalOpen}
            onClose={() => setIsFollowUpModalOpen(false)}
            onCreated={() => {
              setIsFollowUpModalOpen(false);
              setFollowUpToast("Ação de Follow-up registrada com sucesso!");
              setTimeout(() => setFollowUpToast(null), 4000);
              fetchAlerts();
            }}
            initialContext={followUpContext}
          />
        )}
      </main>

      {/* ═══ BOTTOM TAB BAR ═══ */}
      <nav className="bottom-tabs" style={{ position: "fixed", bottom: 0, width: "100%" }}>
        <Link href="/" className="bottom-tab"><Home className="bottom-tab-icon" /> Menu</Link>
        <Link href="/vendas" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Vendas</Link>
        <Link href="/historico" className="bottom-tab"><History className="bottom-tab-icon" /> Hist.</Link>
        <Link href="/matriz" className="bottom-tab"><Users className="bottom-tab-icon" /> Rede</Link>
        {/* NEW SMART ACTION HUB LINK */}
        <Link href="/alertas" className="bottom-tab active"><Bell className="bottom-tab-icon" /> Alertas</Link>
        <Link href="/preco" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Preço</Link>
        <Link href="/dia" className="bottom-tab"><Calendar className="bottom-tab-icon" /> Dia</Link>
        <Link href="/positivacao" className="bottom-tab"><CheckCircle2 className="bottom-tab-icon" /> Posit.</Link>
        <Link href="/sku-pdv" className="bottom-tab"><Package className="bottom-tab-icon" /> Sku PDV</Link>
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
