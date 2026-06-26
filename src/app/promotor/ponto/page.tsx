"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Camera, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  History, 
  FileText, 
  Send, 
  RotateCw,
  Plus,
  X,
  User,
  LogOut,
  Calendar,
  ArrowLeft
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";

const getLocalDateString = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function PromotorPontoPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<"ponto" | "historico" | "ocorrencias">("ponto");
  
  // Dados do usuário
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Filtro de data do histórico (padrão hoje)
  const [filterDate, setFilterDate] = useState<string>(() => getLocalDateString());

  // Estados do Ponto
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [proximoPonto, setProximoPonto] = useState<"ENTRADA" | "SAIDA_INTERVALO" | "RETORNO_INTERVALO" | "SAIDA">("ENTRADA");
  const [batidasHoje, setBatidasHoje] = useState<any[]>([]);
  const [loadingPonto, setLoadingPonto] = useState(false);

  // Geolocalização
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"loading" | "success" | "error">("loading");
  const [locationError, setLocationError] = useState("");

  // Câmera/Foto
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Histórico
  const [historicoBatidas, setHistoricoBatidas] = useState<any[]>([]);
  const [bancoHoras, setBancoHoras] = useState<any>(null);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Ocorrências / Justificativas
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [showNovaOcorrencia, setShowNovaOcorrencia] = useState(false);
  const [tipoAjuste, setTipoAjuste] = useState("FALTA_BATIDA");
  const [dataOcorrencia, setDataOcorrencia] = useState("");
  const [tipoRegistroAfetado, setTipoRegistroAfetado] = useState("ENTRADA");
  const [horarioProposto, setHorarioProposto] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [comprovanteOcorrencia, setComprovanteOcorrencia] = useState<File | null>(null);
  const [loadingOcorrencia, setLoadingOcorrencia] = useState(false);

  // Status de feedback
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // 1. Relógio em tempo real
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setCurrentDate(now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Carregar dados de autenticação e perfil
  useEffect(() => {
    async function loadUserData() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          window.location.href = "/login"; // Redireciona se não autenticado
          return;
        }
        setUser(authUser);

        // Perfil
        const { data: prof } = await supabase
          .from("cm_user_profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();
        setProfile(prof);

        // Perfil Digital do Promotor (tabela auxiliar)
        const { data: perfil } = await supabase
          .from("cm_promotor_perfil")
          .select("employee_id")
          .eq("user_id", authUser.id)
          .maybeSingle();

        let emp = null;
        if (perfil) {
          // Funcionário
          const { data: empData } = await supabase
            .from("cm_employees")
            .select("*")
            .eq("id", perfil.employee_id)
            .maybeSingle();
          emp = empData;
          setEmployee(emp);
        }

        if (emp) {
          loadBatidasHoje(emp.id);
        }
      } catch (err) {
        console.error("Erro ao carregar dados do usuário:", err);
      } finally {
        setLoadingUser(false);
      }
    }
    loadUserData();
  }, []);

  // 3. Monitorar geolocalização ao carregar
  useEffect(() => {
    obterGeolocalizacao();
  }, []);

  const obterGeolocalizacao = () => {
    setLocationStatus("loading");
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationError("Geolocalização não suportada pelo navegador.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setLocationStatus("success");
      },
      (error) => {
        setLocationStatus("error");
        let msg = "Erro ao obter localização.";
        if (error.code === 1) msg = "Permissão de localização negada.";
        else if (error.code === 2) msg = "Sinal de GPS indisponível.";
        else if (error.code === 3) msg = "Tempo esgotado para obter GPS.";
        setLocationError(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Carregar batidas de hoje do promotor para determinar próximo status
  const loadBatidasHoje = async (empId: string) => {
    try {
      const hoje = new Date().toISOString().split("T")[0];
      const { data: batidas, error } = await supabase
        .from("cm_promotor_jornada")
        .select("*")
        .eq("employee_id", empId)
        .gte("timestamp_dispositivo", `${hoje}T00:00:00Z`)
        .order("timestamp_dispositivo", { ascending: true });

      if (error) throw error;
      setBatidasHoje(batidas || []);

      // Determinar próximo ponto lógico
      if (!batidas || batidas.length === 0) {
        setProximoPonto("ENTRADA");
      } else if (batidas.length === 1) {
        setProximoPonto("SAIDA_INTERVALO");
      } else if (batidas.length === 2) {
        setProximoPonto("RETORNO_INTERVALO");
      } else if (batidas.length === 3) {
        setProximoPonto("SAIDA");
      } else {
        // Já bateu as 4 batidas recomendadas
        setProximoPonto("SAIDA");
      }
    } catch (err) {
      console.error("Erro ao carregar batidas de hoje:", err);
    }
  };

  // Carregar Histórico e Ocorrências nas abas corretas
  useEffect(() => {
    if (activeTab === "historico" && employee) {
      loadHistorico(filterDate);
    } else if (activeTab === "ocorrencias" && employee) {
      loadOcorrencias();
    }
  }, [activeTab, employee, filterDate]);

  const loadHistorico = async (dateStr?: string) => {
    setLoadingHistorico(true);
    try {
      const targetDate = dateStr !== undefined ? dateStr : filterDate;
      
      let query = supabase
        .from("cm_promotor_jornada")
        .select("*")
        .eq("employee_id", employee.id);

      if (targetDate) {
        const start = new Date(`${targetDate}T00:00:00`);
        const end = new Date(`${targetDate}T23:59:59`);
        
        query = query
          .gte("timestamp_dispositivo", start.toISOString())
          .lte("timestamp_dispositivo", end.toISOString());
      } else {
        query = query.limit(30);
      }

      const { data: batidas, error } = await query
        .order("timestamp_dispositivo", { ascending: false });

      if (error) throw error;
      setHistoricoBatidas(batidas || []);

      // Buscar banco de horas acumulado
      const { data: bh, error: bhError } = await supabase
        .from("cm_promotor_banco_horas")
        .select("*")
        .eq("employee_id", employee.id)
        .order("data_competencia", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!bhError) {
        setBancoHoras(bh);
      }

    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const loadOcorrencias = async () => {
    try {
      const response = await fetch("/api/promotor/justificativas");
      const res = await response.json();
      if (res.success) {
        setOcorrencias(res.data || []);
      }
    } catch (err) {
      console.error("Erro ao carregar ocorrências:", err);
    }
  };

  // Captura de Foto do Input (Câmera Frontal)
  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFotoFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setFotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const dispararCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Submissão da Batida de Ponto
  const handleBaterPonto = async () => {
    if (!location) {
      setFeedback({ type: "error", message: "Aguardando geolocalização. Ative o GPS." });
      return;
    }
    if (!fotoFile) {
      setFeedback({ type: "error", message: "Foto de comprovante facial é obrigatória." });
      return;
    }

    setLoadingPonto(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("tipo_registro", proximoPonto);
      formData.append("timestamp_dispositivo", new Date().toISOString());
      formData.append("latitude", location.lat.toString());
      formData.append("longitude", location.lng.toString());
      formData.append("gps_accuracy", location.accuracy ? location.accuracy.toString() : "0");
      formData.append("foto", fotoFile);
      formData.append("device_info", JSON.stringify({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      }));

      const res = await fetch("/api/promotor/ponto", {
        method: "POST",
        body: formData
      });

      const result = await res.json();

      if (result.success) {
        setFeedback({ 
          type: "success", 
          message: `Ponto de ${proximoPonto} registrado com sucesso! ${!result.rostoDetectado ? "(Rosto não identificado - Pendente de validação visual)" : ""}` 
        });
        setFotoFile(null);
        setFotoPreview(null);
        // Recarregar
        loadBatidasHoje(employee.id);
      } else {
        setFeedback({ type: "error", message: result.error || "Falha ao registrar ponto." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Erro de rede ao bater ponto." });
    } finally {
      setLoadingPonto(false);
    }
  };

  // Submissão de Justificativa / Ocorrência
  const handleCriarOcorrencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataOcorrencia || !justificativa) {
      setFeedback({ type: "error", message: "Preencha todos os campos obrigatórios." });
      return;
    }

    setLoadingOcorrencia(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("tipo_ajuste", tipoAjuste);
      formData.append("data_ocorrencia", dataOcorrencia);
      formData.append("tipo_registro_afetado", tipoRegistroAfetado);
      formData.append("justificativa", justificativa);
      if (horarioProposto) formData.append("horario_proposto", horarioProposto);
      if (comprovanteOcorrencia) formData.append("comprovante", comprovanteOcorrencia);

      const res = await fetch("/api/promotor/justificativas", {
        method: "POST",
        body: formData
      });

      const result = await res.json();

      if (result.success) {
        setFeedback({ type: "success", message: "Solicitação de ajuste enviada com sucesso!" });
        setShowNovaOcorrencia(false);
        setJustificativa("");
        setHorarioProposto("");
        setComprovanteOcorrencia(null);
        loadOcorrencias();
      } else {
        setFeedback({ type: "error", message: result.error || "Erro ao registrar ocorrência." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Erro de conexão." });
    } finally {
      setLoadingOcorrencia(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RotateCw className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-neutral-400 text-sm">Carregando perfil do promotor...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-neutral-900 text-white p-6 flex flex-col items-center justify-center text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Funcionário não Encontrado</h1>
        <p className="text-neutral-400 max-w-sm mb-6">
          Seu usuário não está vinculado a um funcionário ativo na tabela `cm_employees`. Solicite ao RH ou ao Administrador que faça esse vínculo.
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
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col max-w-md mx-auto relative border-x border-neutral-800 pb-20 shadow-2xl">
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
              <User className="w-3 h-3 text-amber-500/80" />
              {employee.nome_completo.split(" ")[0]} ({profile?.role})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button 
            onClick={handleLogout}
            className="p-2 text-neutral-400 hover:text-red-400 transition"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Feedbacks Flutuantes */}
      {feedback && (
        <div className="px-5 mt-4">
          <div className={`p-4 rounded-xl flex gap-3 items-start border ${
            feedback.type === "success" 
              ? "bg-emerald-950/40 border-emerald-900/50 text-emerald-300" 
              : "bg-red-950/40 border-red-900/50 text-red-300"
          }`}>
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
            )}
            <p className="text-xs leading-relaxed">{feedback.message}</p>
          </div>
        </div>
      )}

      {/* CONTEÚDO DINÂMICO POR ABA */}
      <main className="flex-1 overflow-y-auto p-5">
        
        {/* ABA 1: BATIDA DE PONTO */}
        {activeTab === "ponto" && (
          <div className="flex flex-col gap-6">
            
            {/* Relógio Central */}
            <div className="flex flex-col items-center py-6 bg-gradient-to-b from-neutral-900/50 to-transparent rounded-2xl border border-neutral-900">
              <span className="text-xs text-amber-500 uppercase tracking-widest font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Horário de Brasília
              </span>
              <h2 className="text-4xl font-black mt-2 font-mono text-neutral-100 tracking-wider">
                {currentTime || "00:00:00"}
              </h2>
              <p className="text-xs text-neutral-400 mt-1 capitalize font-medium">
                {currentDate}
              </p>
            </div>

            {/* Câmera e Comprovante Facial (Obrigatório) */}
            <div className="flex flex-col items-center gap-3">
              <input 
                type="file" 
                accept="image/*" 
                capture="user"
                ref={fileInputRef}
                onChange={handleFotoChange}
                className="hidden" 
              />
              
              <div 
                onClick={dispararCamera}
                className="w-44 h-44 rounded-full border-2 border-dashed border-amber-500/30 bg-neutral-900 hover:bg-neutral-850 cursor-pointer flex flex-col items-center justify-center overflow-hidden transition relative group shadow-lg"
              >
                {fotoPreview ? (
                  <>
                    <img src={fotoPreview} alt="Selfie de ponto" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-neutral-400">
                    <div className="p-3 bg-amber-500/10 rounded-full text-amber-500 animate-pulse">
                      <Camera className="w-7 h-7" />
                    </div>
                    <span className="text-xs font-semibold text-neutral-300">Tirar Selfie Ponto</span>
                    <span className="text-[10px] text-neutral-500 max-w-[120px] text-center">Câmera frontal</span>
                  </div>
                )}
              </div>
              {fotoFile && (
                <button 
                  onClick={dispararCamera}
                  className="text-xs text-neutral-400 hover:text-amber-500 transition font-medium flex items-center gap-1"
                >
                  Tirar outra foto
                </button>
              )}
            </div>

            {/* Geolocalização e Status */}
            <div className="p-4 bg-neutral-900/60 rounded-xl border border-neutral-900 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  locationStatus === "success" 
                    ? "bg-emerald-500/10 text-emerald-400" 
                    : locationStatus === "error" 
                      ? "bg-red-500/10 text-red-400" 
                      : "bg-amber-500/10 text-amber-400 animate-pulse"
                }`}>
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-200">Localização (GPS)</h4>
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    {locationStatus === "success" && location
                      ? `Lat: ${location.lat.toFixed(5)} Lng: ${location.lng.toFixed(5)} (${Math.round(location.accuracy || 0)}m)`
                      : locationStatus === "error"
                        ? locationError
                        : "Buscando satélites..."}
                  </p>
                </div>
              </div>
              <button 
                onClick={obterGeolocalizacao}
                className="p-2 text-neutral-400 hover:text-white transition"
                title="Recarregar GPS"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* Batidas Realizadas Hoje */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-extrabold uppercase text-neutral-400 tracking-wider">Batidas de Hoje</h3>
              <div className="grid grid-cols-4 gap-2">
                {["ENTRADA", "SAIDA_INTERVALO", "RETORNO_INTERVALO", "SAIDA"].map((tipo) => {
                  const batida = batidasHoje.find(b => b.tipo_registro === tipo);
                  return (
                    <div 
                      key={tipo}
                      className={`p-2.5 rounded-lg border flex flex-col items-center justify-center ${
                        batida 
                          ? "bg-amber-950/20 border-amber-900/50 text-amber-400" 
                          : "bg-neutral-900/20 border-neutral-900 text-neutral-500"
                      }`}
                    >
                      <span className="text-[8px] font-bold tracking-wider block text-center truncate w-full">
                        {tipo === "SAIDA_INTERVALO" 
                          ? "ALMOÇO" 
                          : tipo === "RETORNO_INTERVALO" 
                            ? "RETORNO" 
                            : tipo}
                      </span>
                      <span className="text-xs font-mono font-black mt-1">
                        {batida 
                          ? new Date(batida.timestamp_dispositivo).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) 
                          : "--:--"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Seletor manual caso queira desviar do próximo recomendado */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase">Ação:</span>
              <select 
                value={proximoPonto}
                onChange={(e) => setProximoPonto(e.target.value as any)}
                className="flex-1 text-xs bg-neutral-900 border border-neutral-850 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="ENTRADA">Entrada (Iniciar Dia)</option>
                <option value="SAIDA_INTERVALO">Saída p/ Almoço (Intervalo)</option>
                <option value="RETORNO_INTERVALO">Retorno de Almoço (Intervalo)</option>
                <option value="SAIDA">Saída (Finalizar Dia)</option>
              </select>
            </div>

            {/* Botão de Registro Principal */}
            <button
              onClick={handleBaterPonto}
              disabled={loadingPonto || locationStatus === "loading"}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition active:scale-98 ${
                locationStatus === "loading"
                  ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-extrabold"
              }`}
            >
              {loadingPonto ? (
                <>
                  <RotateCw className="w-5 h-5 animate-spin" />
                  Registrando ponto...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Registrar {proximoPonto}
                </>
              )}
            </button>
            
          </div>
        )}

        {/* ABA 2: HISTÓRICO DE BATIDAS */}
        {activeTab === "historico" && (
          <div className="flex flex-col gap-4">
            {/* Banco de horas consolidado */}
            {bancoHoras && (
              <div className="p-4 bg-gradient-to-r from-neutral-900 to-neutral-850 border border-neutral-900 rounded-xl flex justify-between items-center">
                <div>
                  <h4 className="text-xs text-neutral-400 font-medium">Saldo Banco de Horas</h4>
                  <p className="text-xs text-neutral-400 mt-0.5">Competência: {new Date(bancoHoras.data_competencia).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className={`text-lg font-black font-mono ${bancoHoras.saldo_acumulado >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {bancoHoras.saldo_acumulado >= 0 ? "+" : ""}
                  {bancoHoras.saldo_acumulado} min
                </div>
              </div>
            )}

            {/* Filtro de Data */}
            <div className="p-3 bg-neutral-900/50 backdrop-blur-md border border-neutral-900 rounded-xl flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2 text-neutral-300">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[11px] font-bold">Filtrar Data:</span>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-[11px] text-neutral-200 font-mono focus:outline-none focus:border-amber-500/80 transition-colors"
                />
                {filterDate && (
                  <button 
                    onClick={() => setFilterDate("")}
                    className="px-2 py-1 text-neutral-400 hover:text-neutral-200 bg-neutral-950 border border-neutral-800 rounded-lg text-[10px] font-bold transition-all hover:bg-neutral-900"
                    title="Limpar filtro de data"
                  >
                    Ver Tudo
                  </button>
                )}
              </div>
            </div>

            <h3 className="text-xs font-extrabold uppercase text-neutral-400 tracking-wider">Histórico de Ponto</h3>
            {loadingHistorico ? (
              <div className="flex flex-col items-center py-10">
                <RotateCw className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : historicoBatidas.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-10">Nenhuma batida registrada.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {historicoBatidas.map((item) => (
                  <div 
                    key={item.id}
                    className="p-3 bg-neutral-900/40 border border-neutral-900 rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-neutral-900 rounded-lg text-amber-500/80 font-bold text-xs">
                        {item.tipo_registro.substring(0, 3)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-neutral-200">
                          {item.tipo_registro === "SAIDA_INTERVALO" 
                            ? "Saída Intervalo" 
                            : item.tipo_registro === "RETORNO_INTERVALO" 
                              ? "Retorno Intervalo" 
                              : item.tipo_registro}
                        </h4>
                        <p className="text-[10px] text-neutral-500 mt-0.5">
                          {new Date(item.timestamp_dispositivo).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-mono font-black text-neutral-100">
                        {new Date(item.timestamp_dispositivo).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {item.is_offline_sync && (
                        <span className="block text-[8px] bg-amber-500/10 text-amber-400 border border-amber-900/30 px-1 rounded mt-0.5">
                          Ajustado
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA 3: JUSTIFICATIVAS / OCORRÊNCIAS */}
        {activeTab === "ocorrencias" && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-extrabold uppercase text-neutral-400 tracking-wider">Ajustes & Ocorrências</h3>
              <button 
                onClick={() => setShowNovaOcorrencia(true)}
                className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Solicitação
              </button>
            </div>

            {ocorrencias.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-10">Nenhuma solicitação criada.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {ocorrencias.map((item) => (
                  <div 
                    key={item.id}
                    className="p-3 bg-neutral-900/40 border border-neutral-900 rounded-xl"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          item.status === "PENDENTE" 
                            ? "bg-amber-500/10 text-amber-400 border border-amber-900/30" 
                            : item.status === "APROVADO" 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-900/30" 
                              : "bg-red-500/10 text-red-400 border border-red-900/30"
                        }`}>
                          {item.status}
                        </span>
                        <h4 className="text-xs font-bold text-neutral-200 mt-2">
                          {item.tipo_ajuste.replace("_", " ")} ({item.tipo_registro_afetado})
                        </h4>
                        <p className="text-[10px] text-neutral-400 mt-1">
                          Data Ocorrência: {new Date(item.data_ocorrencia).toLocaleDateString("pt-BR")}
                          {item.horario_proposto && ` às ${item.horario_proposto.substring(0, 5)}`}
                        </p>
                      </div>
                      <span className="text-[10px] text-neutral-500">
                        {new Date(item.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-neutral-900/60">
                      <p className="text-[10px] text-neutral-400 leading-normal italic">
                        &quot;{item.justificativa}&quot;
                      </p>
                    </div>
                    {item.observacao_supervisor && (
                      <div className="mt-2 p-2 bg-neutral-950/60 border border-neutral-900 rounded-lg">
                        <p className="text-[9px] font-bold text-neutral-400">Resposta do Supervisor:</p>
                        <p className="text-[9px] text-neutral-500 mt-0.5 italic">&quot;{item.observacao_supervisor}&quot;</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* MODAL / BOTTOM SHEET DE CRIAÇÃO DE OCORRÊNCIA */}
            {showNovaOcorrencia && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center">
                <div className="bg-neutral-900 border-t border-neutral-800 w-full max-w-md rounded-t-2xl p-5 flex flex-col gap-4 animate-in slide-in-from-bottom duration-250">
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
                    <h3 className="text-sm font-bold text-neutral-100">Solicitar Ajuste de Ponto</h3>
                    <button 
                      onClick={() => setShowNovaOcorrencia(false)}
                      className="p-1 text-neutral-400 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleCriarOcorrencia} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase">Motivo do Ajuste</label>
                      <select 
                        value={tipoAjuste}
                        onChange={(e) => setTipoAjuste(e.target.value)}
                        className="text-xs bg-neutral-950 border border-neutral-850 rounded-lg p-2.5 text-white"
                      >
                        <option value="FALTA_BATIDA">Esquecimento de Ponto (Falta Batida)</option>
                        <option value="ATRASO_JUSTIFICADO">Atraso Justificado / Problema Rota</option>
                        <option value="ATESTADO_MEDICO">Atestado Médico / Licença</option>
                        <option value="FOLGA_COMPENSATORIA">Compensação de Horas (Folga)</option>
                        <option value="OUTRO">Outro Motivo</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase">Data</label>
                        <input 
                          type="date" 
                          required
                          value={dataOcorrencia}
                          onChange={(e) => setDataOcorrencia(e.target.value)}
                          className="text-xs bg-neutral-950 border border-neutral-850 rounded-lg p-2.5 text-white focus:outline-none"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase">Batida Afetada</label>
                        <select 
                          value={tipoRegistroAfetado}
                          onChange={(e) => setTipoRegistroAfetado(e.target.value)}
                          className="text-xs bg-neutral-950 border border-neutral-850 rounded-lg p-2.5 text-white focus:outline-none"
                        >
                          <option value="ENTRADA">Entrada</option>
                          <option value="SAIDA_INTERVALO">Saída Intervalo</option>
                          <option value="RETORNO_INTERVALO">Retorno Intervalo</option>
                          <option value="SAIDA">Saída</option>
                          <option value="DIA_INTEIRO">Falta (Dia Inteiro)</option>
                        </select>
                      </div>
                    </div>

                    {tipoAjuste === "FALTA_BATIDA" && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase">Horário Proposto para Inclusão</label>
                        <input 
                          type="time" 
                          required={tipoAjuste === "FALTA_BATIDA"}
                          value={horarioProposto}
                          onChange={(e) => setHorarioProposto(e.target.value)}
                          className="text-xs bg-neutral-950 border border-neutral-850 rounded-lg p-2.5 text-white focus:outline-none w-full"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase">Justificativa Detalhada</label>
                      <textarea 
                        required
                        rows={3}
                        placeholder="Descreva o motivo detalhadamente..."
                        value={justificativa}
                        onChange={(e) => setJustificativa(e.target.value)}
                        className="text-xs bg-neutral-950 border border-neutral-850 rounded-lg p-2.5 text-white focus:outline-none resize-none leading-relaxed"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase">Comprovante / Atestado (Opcional)</label>
                      <input 
                        type="file" 
                        accept="image/*,application/pdf"
                        onChange={(e) => setComprovanteOcorrencia(e.target.files?.[0] || null)}
                        className="text-xs text-neutral-400 file:bg-neutral-950 file:border file:border-neutral-800 file:text-neutral-300 file:px-3 file:py-1.5 file:rounded-md file:mr-3 cursor-pointer"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loadingOcorrencia}
                      className="w-full mt-2 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2"
                    >
                      {loadingOcorrencia ? (
                        <>
                          <RotateCw className="w-4 h-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4" />
                          Enviar Solicitação
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Navigation Footer */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-neutral-900 border-t border-neutral-850 flex justify-around p-2.5 z-40">
        <button 
          onClick={() => setActiveTab("ponto")}
          className={`flex flex-col items-center gap-1 p-1 transition ${activeTab === "ponto" ? "text-amber-500" : "text-neutral-500 hover:text-neutral-400"}`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[9px] font-bold">Bater Ponto</span>
        </button>
        <button 
          onClick={() => setActiveTab("historico")}
          className={`flex flex-col items-center gap-1 p-1 transition ${activeTab === "historico" ? "text-amber-500" : "text-neutral-500 hover:text-neutral-400"}`}
        >
          <History className="w-5 h-5" />
          <span className="text-[9px] font-bold">Histórico</span>
        </button>
        <button 
          onClick={() => setActiveTab("ocorrencias")}
          className={`flex flex-col items-center gap-1 p-1 transition ${activeTab === "ocorrencias" ? "text-amber-500" : "text-neutral-500 hover:text-neutral-400"}`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[9px] font-bold">Ocorrências</span>
        </button>
      </nav>
    </div>
  );
}
