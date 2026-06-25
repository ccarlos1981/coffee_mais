"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RotateCw,
  User,
  LogOut,
  Calendar,
  Building2,
  ChevronRight,
  TrendingUp,
  ArrowLeft
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";

export default function PromotorAgendaPage() {
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [agendaData, setAgendaData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [pontoPendente, setPontoPendente] = useState(false);

  // Geolocalização atual do promotor para ordenação inteligente
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          window.location.href = "/login";
          return;
        }
        setUser(authUser);

        // Perfil Digital
        const { data: perfil } = await supabase
          .from("cm_promotor_perfil")
          .select("employee_id")
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (perfil) {
          const { data: emp } = await supabase
            .from("cm_employees")
            .select("*")
            .eq("id", perfil.employee_id)
            .maybeSingle();

          setEmployee(emp);
          if (emp) {
            obterGPSERecarregar(emp.id);
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Erro ao carregar usuário:", err);
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const obterGPSERecarregar = (empId?: string) => {
    const targetEmpId = empId || employee?.id;
    if (!targetEmpId) return;

    setLocationLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setLocation(loc);
          setLocationLoading(false);
          loadAgenda(targetEmpId, loc);
        },
        (error) => {
          console.warn("GPS desativado ou sem permissão. Carregando sem geolocalização.", error);
          setLocationLoading(false);
          loadAgenda(targetEmpId, null);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setLocationLoading(false);
      loadAgenda(targetEmpId, null);
    }
  };

  const loadAgenda = async (empId: string, gpsLoc: { lat: number; lng: number } | null) => {
    try {
      setErrorMsg("");
      setPontoPendente(false);

      let url = `/api/promotor/agenda?promotor_id=${empId}`;
      if (gpsLoc) {
        url += `&latitude=${gpsLoc.lat}&longitude=${gpsLoc.lng}`;
      }

      const res = await fetch(url);
      const result = await res.json();

      if (result.success) {
        setAgendaData(result.data);
      } else {
        if (result.code === "PONTO_PENDENTE") {
          setPontoPendente(true);
        }
        setErrorMsg(result.error || "Erro ao carregar a agenda.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro de conexão ao carregar a agenda.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RotateCw className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-neutral-400 text-sm">Carregando roteiro do dia...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto border-x border-neutral-900 shadow-2xl">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Funcionário não Encontrado</h1>
        <p className="text-neutral-400 max-w-sm mb-6">
          Seu usuário não está vinculado a um promotor ativo no sistema.
        </p>
        <button
          onClick={handleLogout}
          className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg flex items-center gap-2 transition"
        >
          <LogOut className="w-4 h-4" />
          Desconectar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col max-w-md mx-auto relative border-x border-neutral-900 shadow-2xl pb-6">
      {/* Header */}
      <header className="p-5 border-b border-neutral-900 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-30 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.location.href = "/"}
            className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-all flex items-center justify-center border border-transparent hover:border-neutral-700/50"
            title="Voltar ao Menu Principal"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div>
            <h1 className="text-lg font-extrabold bg-gradient-to-r from-amber-500 to-amber-200 bg-clip-text text-transparent">
              Coffee Mais Campo
            </h1>
            <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
              <User className="w-3.5 h-3.5 text-amber-500/80" />
              Agenda: {employee.nome_completo.split(" ")[0]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => obterGPSERecarregar()}
            disabled={locationLoading}
            className="p-2 text-neutral-400 hover:text-white transition"
            title="Recarregar e Reordenar"
          >
            <RotateCw className={`w-5 h-5 ${locationLoading ? "animate-spin text-amber-500" : ""}`} />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 text-neutral-400 hover:text-red-400 transition"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-5 flex flex-col gap-5">
        {/* Banner de Data */}
        <div className="p-4 bg-neutral-900/50 rounded-2xl border border-neutral-900 flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Visitas Programadas</h2>
            <p className="text-sm font-black text-neutral-100 mt-0.5 capitalize">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        </div>

        {/* Ponto pendente bloqueante */}
        {pontoPendente ? (
          <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-900/40 text-center flex flex-col items-center gap-4 py-8">
            <AlertTriangle className="w-12 h-12 text-amber-500 animate-pulse" />
            <h3 className="text-sm font-bold text-amber-400">Ponto de Entrada Pendente</h3>
            <p className="text-xs text-neutral-400 leading-relaxed max-w-xs">
              Para desbloquear sua agenda de visitas e roteirização inteligente, você precisa primeiro registrar sua entrada de jornada de ponto diária.
            </p>
            <Link
              href="/promotor/ponto"
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-xs rounded-xl shadow-lg transition"
            >
              Registrar Entrada de Ponto
            </Link>
          </div>
        ) : errorMsg ? (
          <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/40 text-red-300 text-xs flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        ) : agendaData && agendaData.visitas?.length === 0 ? (
          <div className="text-center py-10 flex flex-col items-center gap-3 text-neutral-500">
            <Building2 className="w-12 h-12 text-neutral-600" />
            <p className="text-xs font-semibold">Nenhuma visita programada para hoje.</p>
          </div>
        ) : agendaData ? (
          <div className="flex flex-col gap-3">
            {/* Legenda de Ordenação por GPS */}
            {location && (
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                Ordenação inteligente ativa por proximidade e criticidade comercial.
              </span>
            )}

            {agendaData.visitas.map((visita: any) => {
              const criticidadeCores: Record<string, string> = {
                OBRIGATORIA: "bg-red-500/10 text-red-400 border-red-900/30",
                ALTA: "bg-orange-500/10 text-orange-400 border-orange-900/30",
                NORMAL: "bg-amber-500/10 text-amber-400 border-amber-900/30",
                BAIXA: "bg-neutral-500/10 text-neutral-400 border-neutral-900/30"
              };

              const statusCores: Record<string, string> = {
                PLANEJADA: "text-neutral-400 bg-neutral-900 border-neutral-800",
                EM_ROTA: "text-blue-400 bg-blue-950/20 border-blue-900/30",
                CHECKIN_REALIZADO: "text-cyan-400 bg-cyan-950/20 border-cyan-900/30",
                EM_EXECUCAO: "text-yellow-400 bg-yellow-950/20 border-yellow-900/30",
                CONCLUIDA: "text-emerald-400 bg-emerald-950/20 border-emerald-900/30",
                NAO_REALIZADA: "text-red-400 bg-red-950/20 border-red-900/30",
                CANCELADA: "text-neutral-500 bg-neutral-900 border-neutral-800",
                LOJA_FECHADA: "text-purple-400 bg-purple-950/20 border-purple-900/30"
              };

              return (
                <Link
                  href={`/promotor/visitas/${visita.id}`}
                  key={visita.id}
                  className="p-4 rounded-2xl bg-neutral-900/40 hover:bg-neutral-900/80 border border-neutral-900 flex justify-between items-center gap-4 transition active:scale-98"
                >
                  <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${criticidadeCores[visita.criticidade_visita] || criticidadeCores.NORMAL}`}>
                        {visita.criticidade_visita}
                      </span>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${statusCores[visita.status] || statusCores.PLANEJADA}`}>
                        {visita.status.replace("_", " ")}
                      </span>
                      {visita.tipo_visita === "MISSAO_EXTRA" && (
                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded border bg-purple-500/10 text-purple-400 border-purple-900/30">
                          Missão
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-neutral-100 truncate mt-1">
                      {visita.pdv?.nome_fantasia || "Parceiro sem nome"}
                    </h3>

                    <p className="text-[10px] text-neutral-400 truncate">
                      Cód: {visita.cod_parceiro} • {visita.pdv?.razao_social || ""}
                    </p>

                    <div className="flex items-center gap-3 mt-1 text-[10px] text-neutral-400 flex-wrap">
                      <span className="flex items-center gap-1 text-amber-500/90 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        Previsto: {visita.duracao_estimada_min} min
                      </span>
                      {visita.distancia_calculada_m !== null && (
                        <span className="flex items-center gap-1 text-emerald-400 font-medium">
                          <MapPin className="w-3.5 h-3.5" />
                          Aprox. {visita.distancia_calculada_m >= 1000 ? `${(visita.distancia_calculada_m / 1000).toFixed(1)} km` : `${visita.distancia_calculada_m} m`}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-neutral-600 shrink-0" />
                </Link>
              );
            })}
          </div>
        ) : null}

        {/* Link rápido de volta ao ponto */}
        <div className="mt-4 pt-4 border-t border-neutral-900 text-center">
          <Link
            href="/promotor/ponto"
            className="text-xs text-neutral-400 hover:text-amber-500 transition font-bold"
          >
            Acessar Controle de Ponto
          </Link>
        </div>
      </main>
    </div>
  );
}
