"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Clock,
  User,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  MapPin,
  Eye,
  Search,
  Check,
  X,
  RotateCw,
  Trophy,
  Calendar,
  AlertCircle,
  ArrowLeft
} from "lucide-react";

export default function SupervisorPontoPage() {
  const supabase = createClient();
  const [activeSubTab, setActiveSubTab] = useState<"auditoria" | "ocorrencias" | "banco">("auditoria");
  
  // Dados de Autenticação
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Estados dos Dados
  const [batidas, setBatidas] = useState<any[]>([]);
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [bancoHoras, setBancoHoras] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Filtros
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [filterDate, setFilterDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  // Modal de Foto Comprovante
  const [selectedFotoUrl, setSelectedFotoUrl] = useState<string | null>(null);
  const [signedFotoUrl, setSignedFotoUrl] = useState<string | null>(null);
  const [loadingFoto, setLoadingFoto] = useState(false);

  // Resoluções de Ocorrências
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [observacaoSupervisor, setObservacaoSupervisor] = useState("");
  const [submittingDecisao, setSubmittingDecisao] = useState(false);

  // Feedbacks
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // 1. Validar login e obter perfil de supervisor
  useEffect(() => {
    async function checkSupervisorAuth() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          window.location.href = "/login";
          return;
        }
        setUser(authUser);

        const { data: prof } = await supabase
          .from("cm_user_profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();

        setProfile(prof);

        // Supervisor precisa pertencer a funções de gerência/trade
        const isSupervisor = ["Supervisor", "CEO", "Admin", "Trade"].includes(prof?.role || "");
        if (!isSupervisor) {
          window.location.href = "/promotor/ponto"; // Redireciona promotores comuns
          return;
        }

        // Buscar perfil auxiliar do supervisor
        const { data: perfil } = await supabase
          .from("cm_promotor_perfil")
          .select("employee_id")
          .eq("user_id", authUser.id)
          .maybeSingle();

        let emp = null;
        if (perfil) {
          const { data: empData } = await supabase
            .from("cm_employees")
            .select("*")
            .eq("id", perfil.employee_id)
            .maybeSingle();
          emp = empData;
          setEmployee(emp);
        }

      } catch (err) {
        console.error("Erro na autenticação:", err);
      } finally {
        setLoadingAuth(false);
      }
    }
    checkSupervisorAuth();
  }, []);

  // 2. Carregar dados de acordo com a aba ativa e filtros
  useEffect(() => {
    if (user && profile) {
      loadDados();
    }
  }, [activeSubTab, user, profile, filterDate]);

  const loadDados = async () => {
    setLoadingData(true);
    setFeedback(null);
    try {
      if (activeSubTab === "auditoria") {
        // Carrega batidas filtradas da equipe
        let query = supabase.from("cm_promotor_jornada").select(`
          *,
          employee:cm_employees(id, nome_completo, cpf)
        `);

        // Se for Supervisor, traz apenas os dele
        if (profile.role === "Supervisor" && employee) {
          const { data: mappings } = await supabase
            .from("cm_promotor_supervisor_mapping")
            .select("promotor_id")
            .eq("supervisor_id", employee.id);

          const promotorIds = mappings?.map(m => m.promotor_id) || [];
          query = query.in("employee_id", promotorIds);
        }

        // Filtro por Data
        if (filterDate) {
          const start = new Date(`${filterDate}T00:00:00`);
          const end = new Date(`${filterDate}T23:59:59`);
          query = query
            .gte("timestamp_dispositivo", start.toISOString())
            .lte("timestamp_dispositivo", end.toISOString());
        }

        const { data: resBatidas, error: errB } = await query.order("timestamp_dispositivo", { ascending: false }).limit(50);
        if (errB) throw errB;
        setBatidas(resBatidas || []);

        // Buscar alertas ativos de jornada
        let alertasQuery = supabase.from("cm_promotor_alertas_jornada").select(`
          *,
          employee:cm_employees(id, nome_completo)
        `);
        if (profile.role === "Supervisor" && employee) {
          const { data: mappings } = await supabase
            .from("cm_promotor_supervisor_mapping")
            .select("promotor_id")
            .eq("supervisor_id", employee.id);
          const promotorIds = mappings?.map(m => m.promotor_id) || [];
          alertasQuery = alertasQuery.in("employee_id", promotorIds);
        }
        const { data: resAlertas } = await alertasQuery.eq("resolvido", false).order("created_at", { ascending: false });
        setAlertas(resAlertas || []);

      } else if (activeSubTab === "ocorrencias") {
        // Justificativas pendentes de aprovação
        const res = await fetch("/api/promotor/justificativas");
        const json = await res.json();
        if (json.success) {
          setOcorrencias(json.data || []);
        } else {
          throw new Error(json.error || "Erro ao buscar ocorrências.");
        }

      } else if (activeSubTab === "banco") {
        // Banco de horas consolidado
        let query = supabase.from("cm_promotor_banco_horas").select(`
          *,
          employee:cm_employees(id, nome_completo, cpf)
        `);
        
        if (profile.role === "Supervisor" && employee) {
          const { data: mappings } = await supabase
            .from("cm_promotor_supervisor_mapping")
            .select("promotor_id")
            .eq("supervisor_id", employee.id);
          const promotorIds = mappings?.map(m => m.promotor_id) || [];
          query = query.in("employee_id", promotorIds);
        }

        const { data: resBh, error: errBh } = await query.order("data_competencia", { ascending: false });
        if (errBh) throw errBh;

        // Agrupar saldo acumulado por promotor para exibir ranking
        const saldosPorPromotor: Record<string, { nome: string; saldo: number; data: string }> = {};
        resBh?.forEach(b => {
          const empId = b.employee_id;
          if (!saldosPorPromotor[empId]) {
            saldosPorPromotor[empId] = {
              nome: b.employee?.nome_completo || "Desconhecido",
              saldo: b.saldo_acumulado,
              data: b.data_competencia
            };
          }
        });

        setBancoHoras(Object.values(saldosPorPromotor));
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Erro ao buscar dados do Supabase." });
    } finally {
      setLoadingData(false);
    }
  };

  // Gerar URL assinada temporária para visualização segura da foto do promotor
  const handleVerFoto = async (fotoPath: string) => {
    setSelectedFotoUrl(fotoPath);
    setSignedFotoUrl(null);
    setLoadingFoto(true);
    try {
      const { data, error } = await supabase.storage
        .from("promotor-ponto")
        .createSignedUrl(fotoPath, 60); // Link válido por 60 segundos

      if (error) throw error;
      setSignedFotoUrl(data.signedUrl);
    } catch (err) {
      console.error("Erro ao gerar URL assinada da foto:", err);
      setFeedback({ type: "error", message: "Erro ao carregar a foto do comprovante." });
    } finally {
      setLoadingFoto(false);
    }
  };

  // Enviar aprovação/rejeição de ocorrência
  const handleDecidirOcorrencia = async (status: "APROVADO" | "REJEITADO") => {
    if (!resolvingId) return;

    setSubmittingDecisao(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/promotor/justificativas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: resolvingId,
          status,
          observacao_supervisor: observacaoSupervisor
        })
      });

      const result = await res.json();

      if (result.success) {
        setFeedback({ 
          type: "success", 
          message: `Solicitação de ajuste ${status === "APROVADO" ? "aprovada" : "rejeitada"} com sucesso!` 
        });
        setResolvingId(null);
        setObservacaoSupervisor("");
        loadDados(); // Recarrega ocorrencias
      } else {
        setFeedback({ type: "error", message: result.error || "Erro ao registrar decisão." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Erro de conexão ao salvar decisão." });
    } finally {
      setSubmittingDecisao(false);
    }
  };

  // Resolver alertas (atraso, falta de foto)
  const handleResolverAlerta = async (alertaId: string) => {
    try {
      const { error } = await supabase
        .from("cm_promotor_alertas_jornada")
        .update({
          resolvido: true,
          resolvido_por: user.id,
          observacao_resolucao: "Verificado pelo supervisor no painel."
        })
        .eq("id", alertaId);

      if (error) throw error;
      setFeedback({ type: "success", message: "Alerta arquivado com sucesso." });
      loadDados();
    } catch (err) {
      console.error("Erro ao resolver alerta:", err);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <RotateCw className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  // Filtrar dados da tabela de auditoria por nome de promotor
  const batidasFiltradas = batidas.filter(b => 
    b.employee?.nome_completo.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      {/* Container Principal Centralizado */}
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        
        {/* Back Button */}
        <button 
          onClick={() => window.location.href = "/"} 
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors font-medium text-sm w-fit cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Painel
        </button>

        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-neutral-900">
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-amber-500 to-amber-200 bg-clip-text text-transparent flex items-center gap-2">
              <Clock className="w-7 h-7 text-amber-500" />
              Gestão de Ponto — Módulo PROMOTOR
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Painel de Supervisão e Auditoria de Jornadas e Banco de Horas
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-400 bg-neutral-900 border border-neutral-850 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2">
              <User className="w-4 h-4 text-amber-500" />
              {profile?.role}: {employee?.nome_completo || "Administrador"}
            </span>
          </div>
        </header>

        {/* Notificações de Alertas Ativos da Equipe */}
        {activeSubTab === "auditoria" && alertas.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-900/50 rounded-xl p-4 flex flex-col gap-2">
            <h3 className="text-xs font-bold text-amber-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {alertas.length} Inconsistências Detectadas Hoje pendentes de revisão:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
              {alertas.map(a => (
                <div key={a.id} className="p-2.5 bg-neutral-950/60 rounded-lg flex justify-between items-center text-xs">
                  <div>
                    <span className="font-extrabold text-amber-400 uppercase text-[9px] bg-amber-500/10 px-1.5 py-0.5 rounded mr-2">
                      {a.tipo_alerta}
                    </span>
                    <span className="font-semibold text-neutral-200">{a.employee?.nome_completo}:</span>
                    <span className="text-neutral-400 ml-1">"{a.descricao}"</span>
                  </div>
                  <button 
                    onClick={() => handleResolverAlerta(a.id)}
                    className="text-[10px] text-neutral-400 hover:text-emerald-400 font-bold transition px-2 py-1 rounded bg-neutral-900 border border-neutral-850"
                  >
                    Arquivar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feedback Flutuante */}
        {feedback && (
          <div className={`p-4 rounded-xl flex gap-3 border ${
            feedback.type === "success" 
              ? "bg-emerald-950/30 border-emerald-900/40 text-emerald-300" 
              : "bg-red-950/30 border-red-900/40 text-red-300"
          }`}>
            {feedback.type === "success" ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <p className="text-xs leading-normal">{feedback.message}</p>
          </div>
        )}

        {/* Abas Superiores do Painel */}
        <div className="flex border-b border-neutral-900 gap-6">
          <button 
            onClick={() => setActiveSubTab("auditoria")}
            className={`pb-3 text-sm font-bold border-b-2 transition ${activeSubTab === "auditoria" ? "border-amber-500 text-amber-500" : "border-transparent text-neutral-400 hover:text-neutral-200"}`}
          >
            Auditoria de Ponto
          </button>
          <button 
            onClick={() => setActiveSubTab("ocorrencias")}
            className={`pb-3 text-sm font-bold border-b-2 transition ${activeSubTab === "ocorrencias" ? "border-amber-500 text-amber-500" : "border-transparent text-neutral-400 hover:text-neutral-200"}`}
          >
            Solicitações de Ajuste ({ocorrencias.filter(o => o.status === "PENDENTE").length})
          </button>
          <button 
            onClick={() => setActiveSubTab("banco")}
            className={`pb-3 text-sm font-bold border-b-2 transition ${activeSubTab === "banco" ? "border-amber-500 text-amber-500" : "border-transparent text-neutral-400 hover:text-neutral-200"}`}
          >
            Banco de Horas
          </button>
        </div>

        {/* CONTEÚDO DAS ABAS */}
        <main className="min-h-[400px]">
          
          {/* TAB 1: AUDITORIA DE PONTO */}
          {activeSubTab === "auditoria" && (
            <div className="flex flex-col gap-4">
              
              {/* Barra de Busca e Filtro de Data */}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="flex gap-3 bg-neutral-900 border border-neutral-850 p-2.5 rounded-xl w-full sm:max-w-xs">
                  <Search className="w-5 h-5 text-neutral-500" />
                  <input 
                    type="text" 
                    placeholder="Filtrar por promotor..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="bg-transparent text-xs w-full text-white placeholder-neutral-500 focus:outline-none"
                  />
                </div>
                
                <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-850 p-2 rounded-xl">
                  <Calendar className="w-4 h-4 text-neutral-500" />
                  <input 
                    type="date" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="bg-transparent text-xs text-white focus:outline-none cursor-pointer [color-scheme:dark] select-none"
                  />
                  {filterDate && (
                    <button 
                      onClick={() => setFilterDate("")}
                      className="text-[10px] text-neutral-500 hover:text-white transition px-1"
                      title="Limpar data"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>

              {loadingData ? (
                <div className="flex items-center justify-center py-20">
                  <RotateCw className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              ) : batidasFiltradas.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-20">Nenhuma batida de ponto encontrada.</p>
              ) : (
                <div className="overflow-x-auto bg-neutral-900 border border-neutral-850 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-850 text-neutral-400 font-extrabold uppercase bg-neutral-900/60">
                        <th className="p-4">Promotor</th>
                        <th className="p-4">Tipo</th>
                        <th className="p-4">Data Batida</th>
                        <th className="p-4">Hora Aparelho</th>
                        <th className="p-4">GPS / Precisão</th>
                        <th className="p-4 text-center">Foto Comprovante</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900">
                      {batidasFiltradas.map((b) => (
                        <tr key={b.id} className="hover:bg-neutral-850/40 transition">
                          <td className="p-4 font-bold text-neutral-200">
                            {b.employee?.nome_completo || "Desconhecido"}
                          </td>
                          <td className="p-4">
                            <span className="font-extrabold uppercase text-[10px] bg-neutral-950 px-2.5 py-1 rounded border border-neutral-850 text-neutral-300">
                              {b.tipo_registro}
                            </span>
                          </td>
                          <td className="p-4 text-neutral-400">
                            {new Date(b.timestamp_dispositivo).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="p-4 font-mono font-bold text-neutral-200">
                            {new Date(b.timestamp_dispositivo).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="p-4">
                            <span className="flex items-center gap-1 text-neutral-300 font-mono">
                              <MapPin className="w-3.5 h-3.5 text-amber-500/80" />
                              {b.latitude.toFixed(4)}, {b.longitude.toFixed(4)} 
                              <span className="text-[10px] text-neutral-500">({Math.round(b.gps_accuracy || 0)}m)</span>
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <button 
                              onClick={() => handleVerFoto(b.foto_comprovante_url)}
                              className="px-2.5 py-1.5 bg-neutral-950 hover:bg-neutral-850 border border-neutral-850 hover:border-amber-500/30 text-neutral-300 font-bold rounded-lg flex items-center gap-1.5 transition mx-auto"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Visualizar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SOLICITAÇÕES DE AJUSTE (OCORRÊNCIAS) */}
          {activeSubTab === "ocorrencias" && (
            <div className="flex flex-col gap-4">
              {loadingData ? (
                <div className="flex items-center justify-center py-20">
                  <RotateCw className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              ) : ocorrencias.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-20">Nenhuma solicitação de ajuste pendente.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ocorrencias.map((item) => (
                    <div 
                      key={item.id} 
                      className={`p-4 bg-neutral-900 border rounded-xl flex flex-col justify-between ${
                        item.status === "PENDENTE" 
                          ? "border-amber-900/40" 
                          : item.status === "APROVADO" 
                            ? "border-emerald-900/40" 
                            : "border-red-900/40"
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase ${
                              item.status === "PENDENTE" 
                                ? "bg-amber-500/10 text-amber-400 border border-amber-900/30" 
                                : item.status === "APROVADO" 
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-900/30" 
                                  : "bg-red-500/10 text-red-400 border border-red-900/30"
                            }`}>
                              {item.status}
                            </span>
                            <h3 className="text-sm font-black text-neutral-100 mt-3">
                              {item.employee?.nome_completo}
                            </h3>
                          </div>
                          <span className="text-[10px] text-neutral-500">
                            {new Date(item.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>

                        <div className="mt-4 flex flex-col gap-1.5 text-xs text-neutral-300">
                          <p><strong className="text-neutral-400">Tipo de Ajuste:</strong> {item.tipo_ajuste.replace("_", " ")}</p>
                          <p><strong className="text-neutral-400">Batida Afetada:</strong> {item.tipo_registro_afetado}</p>
                          <p><strong className="text-neutral-400">Data Divergência:</strong> {new Date(item.data_ocorrencia).toLocaleDateString("pt-BR")}</p>
                          {item.horario_proposto && <p><strong className="text-neutral-400">Hora Proposta:</strong> {item.horario_proposto.substring(0, 5)}</p>}
                        </div>

                        <div className="mt-3 p-3 bg-neutral-950/60 rounded-lg text-xs leading-relaxed italic text-neutral-400 border border-neutral-900">
                          "{item.justificativa}"
                        </div>
                      </div>

                      {/* Ações do Supervisor */}
                      {item.status === "PENDENTE" && (
                        <div className="mt-4 pt-3 border-t border-neutral-850 flex flex-col gap-3">
                          {resolvingId === item.id ? (
                            <div className="flex flex-col gap-2">
                              <textarea 
                                placeholder="Observação/Justificativa da decisão..."
                                rows={2}
                                value={observacaoSupervisor}
                                onChange={(e) => setObservacaoSupervisor(e.target.value)}
                                className="text-xs bg-neutral-950 border border-neutral-850 rounded-lg p-2.5 text-white w-full focus:outline-none"
                              />
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleDecidirOcorrencia("APROVADO")}
                                  disabled={submittingDecisao}
                                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
                                >
                                  {submittingDecisao ? <RotateCw className="w-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                  Confirmar Aprovação
                                </button>
                                <button 
                                  onClick={() => handleDecidirOcorrencia("REJEITADO")}
                                  disabled={submittingDecisao}
                                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
                                >
                                  {submittingDecisao ? <RotateCw className="w-3 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                  Confirmar Rejeição
                                </button>
                                <button 
                                  onClick={() => setResolvingId(null)}
                                  className="py-2 px-3 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-lg text-xs"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setResolvingId(item.id)}
                                className="flex-1 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-900/30 hover:border-amber-900/60 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
                              >
                                Decidir Solicitação
                              </button>
                              {item.documento_comprovante_url && (
                                <button 
                                  onClick={() => handleVerFoto(item.documento_comprovante_url)}
                                  className="py-2 px-3 bg-neutral-950 hover:bg-neutral-850 border border-neutral-850 text-neutral-300 rounded-lg text-xs flex items-center gap-1.5 transition"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Ver Anexo
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BANCO DE HORAS E RANKING */}
          {activeSubTab === "banco" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black text-neutral-100">Saldo Acumulado de Horas da Equipe</h3>
              </div>

              {loadingData ? (
                <div className="flex items-center justify-center py-20">
                  <RotateCw className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              ) : bancoHoras.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-20">Nenhum registro de banco de horas encontrado.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {bancoHoras.map((bh, idx) => (
                    <div 
                      key={bh.nome}
                      className="p-4 bg-neutral-900 border border-neutral-850 rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-neutral-950 flex items-center justify-center text-amber-500 font-black text-xs border border-neutral-850">
                          {idx + 1}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-neutral-200">{bh.nome}</h4>
                          <p className="text-[9px] text-neutral-500 mt-0.5">Última atualização: {new Date(bh.data).toLocaleDateString("pt-BR")}</p>
                        </div>
                      </div>
                      <div className={`text-sm font-black font-mono ${bh.saldo >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {bh.saldo >= 0 ? "+" : ""}
                        {bh.saldo} min
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>

        {/* MODAL DE VISUALIZAÇÃO DE FOTO DO COMPROVANTE (SIGNED URL) */}
        {selectedFotoUrl && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl p-4 max-w-sm w-full flex flex-col gap-4">
              <button 
                onClick={() => { setSelectedFotoUrl(null); setSignedFotoUrl(null); }}
                className="absolute -top-3 -right-3 p-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-full text-neutral-300"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-500" />
                Foto Comprovante
              </h3>

              <div className="w-full h-80 rounded-xl bg-neutral-950 overflow-hidden flex items-center justify-center border border-neutral-850 relative">
                {loadingFoto ? (
                  <RotateCw className="w-6 h-6 animate-spin text-amber-500" />
                ) : signedFotoUrl ? (
                  <img src={signedFotoUrl} alt="Comprovante de batida" className="w-full h-full object-contain" />
                ) : (
                  <p className="text-xs text-neutral-500">Erro ao carregar imagem.</p>
                )}
              </div>
              
              <div className="text-[10px] text-neutral-500 break-all select-all font-mono p-2 bg-neutral-950 rounded-lg">
                Caminho Storage: {selectedFotoUrl}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
