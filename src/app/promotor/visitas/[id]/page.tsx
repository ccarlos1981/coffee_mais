"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MapPin,
  Camera,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  RotateCw,
  Send,
  Building2,
  FileText,
  HelpCircle,
  FolderLock,
  Trash2,
  Plus,
  Image as ImageIcon
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { compressImage } from "@/lib/utils/canvas-compressor";

// Função Haversine para cálculo de distância geodésica em metros no cliente
function calculateDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Raio da Terra em metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function PromotorVisitaExecucaoPage() {
  const params = useParams();
  const router = useRouter();
  const visitaId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [visita, setVisita] = useState<any>(null);
  const [geoloc, setGeoloc] = useState<any>(null);
  const [missoes, setMissoes] = useState<any[]>([]);
  const [execucoes, setExecucoes] = useState<Record<string, any>>({});
  const [errorMsg, setErrorMsg] = useState("");

  // Fluxos operacionais
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  // Foto Fachada (Obrigatória no Check-in)
  const [fotoFachadaFile, setFotoFachadaFile] = useState<File | null>(null);
  const [fotoFachadaPreview, setFotoFachadaPreview] = useState<string | null>(null);
  const checkinInputRef = useRef<HTMLInputElement>(null);

  // Fotos da visita (Álbum)
  const [fotos, setFotos] = useState<any[]>([]);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [tipoFotoModal, setTipoFotoModal] = useState("GONDOLA");
  const [descricaoFotoModal, setDescricaoFotoModal] = useState("");
  const [fotoCapturadaFile, setFotoCapturadaFile] = useState<File | null>(null);
  const [fotoCapturadaPreview, setFotoCapturadaPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Modais
  const [activeMissao, setActiveMissao] = useState<any>(null);
  const [respostasAtuais, setRespostasAtuais] = useState<Record<string, any>>({});
  const [showOcorrenciaModal, setShowOcorrenciaModal] = useState(false);

  // Ocorrência/Impedimento
  const [tipoOcorrencia, setTipoOcorrencia] = useState("LOJA_FECHADA");
  const [descricaoOcorrencia, setDescricaoOcorrencia] = useState("");
  const [fotoOcorrenciaFile, setFotoOcorrenciaFile] = useState<File | null>(null);
  const [fotoOcorrenciaPreview, setFotoOcorrenciaPreview] = useState<string | null>(null);
  const ocorrenciaInputRef = useRef<HTMLInputElement>(null);

  // Loading específico de botões
  const [btnLoading, setBtnLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Calcular distância dinamicamente no cliente
  const dist = gpsLocation && geoloc && geoloc.latitude !== null && geoloc.longitude !== null
    ? calculateDistanceM(gpsLocation.lat, gpsLocation.lng, geoloc.latitude, geoloc.longitude)
    : null;

  const noRaio = dist !== null && geoloc && dist <= (geoloc.geofence_radius_m || 100);

  // 1. Carregar dados da visita
  useEffect(() => {
    loadVisitaData();
  }, [visitaId]);

  const loadVisitaData = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      // Buscar visita, PDV e localização
      const { data: v, error: vError } = await supabase
        .from("cm_promotor_visita")
        .select(`
          *,
          pdv:base_atendimento(cod_parceiro, nome_fantasia, razao_social)
        `)
        .eq("id", visitaId)
        .single();

      if (vError || !v) {
        throw new Error("Visita não encontrada no sistema.");
      }

      setVisita(v);

      // Geolocalização cadastrada da loja
      const { data: g } = await supabase
        .from("cm_promotor_pdv_geoloc")
        .select("*")
        .eq("cod_parceiro", v.cod_parceiro)
        .maybeSingle();

      setGeoloc(g);

      // Carregar Missões associadas a esta visita
      const { data: agenda } = await supabase
        .from("cm_promotor_agenda_diaria")
        .select("promotor_id, data_agenda")
        .eq("id", v.agenda_diaria_id)
        .single();

      if (agenda) {
        // Buscar missões de trade cadastradas para este promotor/PDV
        const { data: mv } = await supabase
          .from("cm_trade_missao_pdv")
          .select(`
            missao_id,
            status,
            missao:cm_trade_missao(*)
          `)
          .eq("promotor_id", agenda.promotor_id)
          .eq("cod_parceiro", v.cod_parceiro);

        const missoesAtivas = mv?.filter(m => {
          if (!m.missao) return false;
          const mInfo = m.missao as any;
          const inicio = new Date(mInfo.data_inicio);
          const fim = new Date(mInfo.data_fim);
          const dataAgenda = new Date(agenda.data_agenda);
          return dataAgenda >= inicio && dataAgenda <= fim;
        }) || [];

        setMissoes(missoesAtivas);

        // Buscar respostas já enviadas nesta visita
        const { data: ex } = await supabase
          .from("cm_trade_missao_execucao")
          .select("*")
          .eq("visita_id", v.id);

        const execMap: Record<string, any> = {};
        ex?.forEach(item => {
          execMap[item.missao_id] = item.respostas_checklist;
        });
        setExecucoes(execMap);

        // Buscar fotos desta visita
        const { data: ft } = await supabase
          .from("cm_promotor_visita_foto")
          .select("*")
          .eq("visita_id", v.id)
          .eq("is_deleted", false)
          .order("ordem", { ascending: true })
          .order("created_at", { ascending: true });

        setFotos(ft || []);
      }

      obterGPS();

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Erro ao carregar dados da visita.");
    } finally {
      setLoading(false);
    }
  };

  // Coletar GPS
  const obterGPS = () => {
    setGpsStatus("loading");
    if (!navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setGpsStatus("success");
      },
      (error) => {
        console.error("Erro GPS:", error);
        setGpsStatus("error");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  // Iniciar Deslocamento
  const handleIniciarRota = async () => {
    setBtnLoading(true);
    setFeedback(null);
    try {
      const { error } = await supabase
        .from("cm_promotor_visita")
        .update({
          status: "EM_ROTA",
          em_rota_at: new Date().toISOString()
        })
        .eq("id", visitaId);

      if (error) throw error;

      // Enviar log de deslocamento iniciado para a timeline/replay
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: perfil } = await supabase
            .from("cm_promotor_perfil")
            .select("employee_id")
            .eq("user_id", authUser.id)
            .single();

          if (perfil && gpsLocation) {
            await supabase.from("cm_promotor_heartbeat_log").insert({
              promotor_id: perfil.employee_id,
              latitude: gpsLocation.lat,
              longitude: gpsLocation.lng,
              accuracy_m: gpsLocation.accuracy,
              source_event: "DESLOCAMENTO_INICIADO"
            });
          }
        }
      } catch (logErr) {
        console.error("Erro ao gravar log de deslocamento iniciado:", logErr);
      }

      setFeedback({ type: "success", message: "Status alterado: Deslocamento iniciado!" });
      loadVisitaData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Erro ao iniciar rota." });
    } finally {
      setBtnLoading(false);
    }
  };

  // Foto Capturada para o Álbum
  const handleCaptureFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFotoCapturadaFile(file);
      const reader = new FileReader();
      reader.onload = () => setFotoCapturadaPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Enviar foto para o Álbum
  const handleUploadFoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fotoCapturadaFile) {
      setFeedback({ type: "error", message: "Tire uma foto antes de enviar." });
      return;
    }

    setBtnLoading(true);
    setFeedback(null);

    try {
      setFeedback({ type: "success", message: "Otimizando e comprimindo imagem..." });
      const compressedFile = await compressImage(fotoCapturadaFile, 1280, 250);

      const formData = new FormData();
      formData.append("visita_id", visitaId);
      formData.append("tipo_foto", tipoFotoModal);
      formData.append("descricao", descricaoFotoModal);
      formData.append("foto", compressedFile);
      formData.append("taken_at", new Date().toISOString());

      if (gpsLocation) {
        formData.append("latitude", gpsLocation.lat.toString());
        formData.append("longitude", gpsLocation.lng.toString());
      }

      const proximaOrdem = fotos.length + 1;
      formData.append("ordem", proximaOrdem.toString());

      setFeedback({ type: "success", message: "Enviando foto ao servidor..." });
      const res = await fetch("/api/promotor/visitas/upload-foto", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (data.success) {
        setFeedback({ type: "success", message: "Foto adicionada com sucesso!" });
        setShowPhotoModal(false);
        setFotoCapturadaFile(null);
        setFotoCapturadaPreview(null);
        setDescricaoFotoModal("");
        loadVisitaData();
      } else {
        setFeedback({ type: "error", message: data.error || "Erro ao fazer upload da foto." });
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: "error", message: err.message || "Erro ao enviar foto." });
    } finally {
      setBtnLoading(false);
    }
  };

  // Remover foto (Soft Delete)
  const handleDeleteFoto = async (fotoId: string) => {
    if (!confirm("Tem certeza que deseja remover esta foto?")) {
      return;
    }

    setBtnLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/promotor/visitas/delete-foto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foto_id: fotoId })
      });

      const data = await res.json();

      if (data.success) {
        setFeedback({ type: "success", message: "Foto removida com sucesso!" });
        loadVisitaData();
      } else {
        setFeedback({ type: "error", message: data.error || "Erro ao remover foto." });
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: "error", message: err.message || "Erro ao conectar para deletar foto." });
    } finally {
      setBtnLoading(false);
    }
  };

  // Foto Ocorrência
  const handleOcorrenciaFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFotoOcorrenciaFile(file);
      const reader = new FileReader();
      reader.onload = () => setFotoOcorrenciaPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Executar Checkin com Foto da Fachada
  const handleCheckin = async () => {
    if (!gpsLocation) {
      setFeedback({ type: "error", message: "GPS obrigatório. Por favor, ative a localização." });
      return;
    }

    if (!fotoFachadaFile) {
      setFeedback({ type: "error", message: "A foto da fachada é obrigatória para realizar o check-in." });
      return;
    }

    setBtnLoading(true);
    setFeedback(null);

    try {
      setFeedback({ type: "success", message: "Comprimindo foto da fachada..." });
      const compressedFile = await compressImage(fotoFachadaFile, 1280, 250);

      const formData = new FormData();
      formData.append("visita_id", visitaId);
      formData.append("latitude", gpsLocation.lat.toString());
      formData.append("longitude", gpsLocation.lng.toString());
      formData.append("dispositivo_timestamp", new Date().toISOString());
      formData.append("foto_fachada", compressedFile);

      setFeedback({ type: "success", message: "Enviando check-in ao servidor..." });
      const res = await fetch("/api/promotor/visitas/checkin", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (data.success) {
        setFeedback({ type: "success", message: "Check-in realizado com sucesso!" });
        setFotoFachadaFile(null);
        setFotoFachadaPreview(null);
        loadVisitaData();
      } else {
        setFeedback({ type: "error", message: data.error || "Erro no check-in." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Erro de conexão ao realizar check-in." });
    } finally {
      setBtnLoading(false);
    }
  };

  // Executar Checkout
  const handleCheckout = async () => {
    if (!gpsLocation) {
      setFeedback({ type: "error", message: "Aguardando GPS atual." });
      return;
    }

    setBtnLoading(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("visita_id", visitaId);
      formData.append("latitude", gpsLocation.lat.toString());
      formData.append("longitude", gpsLocation.lng.toString());
      formData.append("dispositivo_timestamp", new Date().toISOString());

      const res = await fetch("/api/promotor/visitas/checkout", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (data.success) {
        setFeedback({ type: "success", message: "Check-out realizado e visita concluída!" });
        router.push("/promotor/agenda");
      } else {
        setFeedback({ type: "error", message: data.error || "Erro no check-out." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Erro de rede no check-out." });
    } finally {
      setBtnLoading(false);
    }
  };

  // Submeter respostas da missão
  const handleSalvarMissao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMissao) return;

    setBtnLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/promotor/visitas/missao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visita_id: visitaId,
          missao_id: activeMissao.missao_id,
          respostas_checklist: respostasAtuais
        })
      });

      const data = await res.json();

      if (data.success) {
        setExecucoes(prev => ({ ...prev, [activeMissao.missao_id]: respostasAtuais }));
        setActiveMissao(null);
        setFeedback({ type: "success", message: `Checklist de "${activeMissao.missao?.titulo}" gravado!` });
        // Recarregar visita para atualizar status de EM_EXECUCAO
        loadVisitaData();
      } else {
        setFeedback({ type: "error", message: data.error || "Erro ao salvar checklist." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Erro ao enviar checklist." });
    } finally {
      setBtnLoading(false);
    }
  };

  // Registrar Impedimento/Ocorrência
  const handleRegistrarOcorrencia = async (e: React.FormEvent) => {
    e.preventDefault();
    setBtnLoading(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("visita_id", visitaId);
      formData.append("tipo_ocorrencia", tipoOcorrencia);
      formData.append("descricao", descricaoOcorrencia);
      if (fotoOcorrenciaFile) {
        formData.append("foto", fotoOcorrenciaFile);
      }

      const res = await fetch("/api/promotor/visitas/ocorrencia", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (data.success) {
        setShowOcorrenciaModal(false);
        setDescricaoOcorrencia("");
        setFotoOcorrenciaFile(null);
        setFotoOcorrenciaPreview(null);
        
        if (data.data.status_visita === "LOJA_FECHADA" || data.data.status_visita === "NAO_REALIZADA") {
          // Visita fechada
          router.push("/promotor/agenda");
        } else {
          loadVisitaData();
        }
      } else {
        setFeedback({ type: "error", message: data.error || "Erro ao registrar ocorrência." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Erro de rede." });
    } finally {
      setBtnLoading(false);
    }
  };

  const handleInputChecklist = (field: string, val: any) => {
    setRespostasAtuais(prev => ({ ...prev, [field]: val }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <RotateCw className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white p-5 flex flex-col items-center justify-center text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-sm font-semibold">{errorMsg}</p>
        <button onClick={() => router.push("/promotor/agenda")} className="mt-4 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs">
          Voltar para Agenda
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col max-w-md mx-auto relative border-x border-neutral-900 shadow-2xl pb-10">
      {/* Header */}
      <header className="p-5 border-b border-neutral-900 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-30 flex justify-between items-center">
        <button onClick={() => router.push("/promotor/agenda")} className="p-2 text-neutral-400 hover:text-white transition flex items-center gap-1">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-xs font-semibold">Voltar</span>
        </button>
        <h1 className="text-xs font-extrabold uppercase text-amber-500 tracking-wider">
          Visita em Detalhe
        </h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setShowOcorrenciaModal(true)}
            className="px-2.5 py-1.5 bg-red-950/40 border border-red-900/40 text-red-400 rounded-lg text-[10px] font-black uppercase transition hover:bg-red-950/60"
          >
            Impedimento
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 p-5 flex flex-col gap-5 overflow-y-auto">
        {/* Dados da Loja */}
        <div className="p-4 bg-neutral-900/30 rounded-2xl border border-neutral-900 flex gap-3">
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500 shrink-0 h-fit">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-neutral-200">{visita.pdv?.nome_fantasia}</h2>
            <p className="text-[10px] text-neutral-400 mt-0.5">Cód: {visita.cod_parceiro} • {visita.pdv?.razao_social}</p>
            <p className="text-[10px] text-neutral-500 mt-1 flex items-center gap-1">
              <FolderLock className="w-3.5 h-3.5" />
              Raio de tolerância: {geoloc?.geofence_radius_m || 100}m
            </p>
          </div>
        </div>

        {/* Feedbacks de Status */}
        {feedback && (
          <div className={`p-4 rounded-xl border flex gap-3 items-start text-xs ${
            feedback.type === "success" ? "bg-emerald-950/40 border-emerald-900/50 text-emerald-300" : "bg-red-950/40 border-red-900/50 text-red-300"
          }`}>
            {feedback.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />}
            <p>{feedback.message}</p>
          </div>
        )}

        {/* FLUXO 1: PLANEJADA (Iniciar Rota) */}
        {visita.status === "PLANEJADA" && (
          <div className="flex flex-col gap-4 py-4 text-center">
            <MapPin className="w-12 h-12 text-neutral-600 mx-auto animate-bounce" />
            <div className="max-w-xs mx-auto">
              <h3 className="text-sm font-bold text-neutral-200">Pronto para iniciar?</h3>
              <p className="text-xs text-neutral-500 mt-1">
                Ative o deslocamento para registrar o tempo de trânsito até o estabelecimento.
              </p>
            </div>
            <button
              onClick={handleIniciarRota}
              disabled={btnLoading}
              className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-500 text-white font-black text-sm rounded-xl shadow-lg transition active:scale-98"
            >
              {btnLoading ? "Alterando status..." : "Iniciar Deslocamento (Ir para a Loja)"}
            </button>
          </div>
        )}

        {/* FLUXO 2: EM ROTA (Check-in por Geolocalização) */}
        {visita.status === "EM_ROTA" && (
          <div className="flex flex-col gap-5">
            <div className="p-4 bg-neutral-900/60 rounded-xl border border-neutral-900">
              <h3 className="text-xs font-bold text-neutral-300 uppercase">Validação de Localização</h3>
              
              <div className="flex justify-between items-center mt-2.5">
                <span className="text-[10px] text-neutral-400">GPS do Promotor:</span>
                <span className={`text-[10px] font-bold ${gpsStatus === "success" ? "text-emerald-400" : "text-amber-500"}`}>
                  {gpsStatus === "success" ? "Conectado" : gpsStatus === "loading" ? "Buscando satélites..." : "GPS desativado"}
                </span>
              </div>
              
              {gpsLocation && geoloc && dist !== null && (
                <div className="mt-2.5 pt-2 border-t border-neutral-800 flex justify-between items-center text-[10px]">
                  <span className="text-neutral-400">Distância da Loja:</span>
                  <span className={`font-mono font-bold ${noRaio ? "text-emerald-400" : "text-amber-500"}`}>
                    {dist < 1000 ? `${Math.round(dist)} metros` : `${(dist / 1000).toFixed(2)} km`}
                    {noRaio ? " (No raio permitido)" : " (Fora do raio)"}
                  </span>
                </div>
              )}
            </div>

            {/* Captura de Foto da Fachada */}
            <div className="p-4 bg-neutral-900/60 rounded-xl border border-neutral-900 flex flex-col gap-2.5">
              <h3 className="text-xs font-bold text-neutral-300 uppercase">Foto da Fachada (Obrigatória)</h3>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={checkinInputRef}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    setFotoFachadaFile(file);
                    const reader = new FileReader();
                    reader.onload = () => setFotoFachadaPreview(reader.result as string);
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <div
                onClick={() => checkinInputRef.current?.click()}
                className="w-full h-36 rounded-xl border border-neutral-800 bg-neutral-950 flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:bg-neutral-900 transition relative"
              >
                {fotoFachadaPreview ? (
                  <img src={fotoFachadaPreview} alt="Foto da Fachada" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-neutral-500">
                    <Camera className="w-6 h-6 text-neutral-400" />
                    <span className="text-[10px] font-extrabold uppercase">Tirar Foto da Fachada</span>
                    <span className="text-[8px] text-neutral-600 font-medium">Requer acesso à câmera</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleCheckin}
              disabled={btnLoading || gpsStatus !== "success" || !fotoFachadaFile}
              className={`w-full py-4 rounded-xl font-black text-sm transition active:scale-98 shadow-md ${
                gpsStatus === "success" && fotoFachadaFile
                  ? "bg-amber-500 text-neutral-950 hover:bg-amber-400"
                  : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
              }`}
            >
              {btnLoading ? "Processando check-in..." : "Realizar Check-in na Loja"}
            </button>
          </div>
        )}

        {/* FLUXO 3: EXECUÇÃO (Checklists + Checkout) */}
        {(visita.status === "CHECKIN_REALIZADO" || visita.status === "EM_EXECUCAO") && (
          <div className="flex flex-col gap-6">
            {/* Lista de Missões / Tarefas */}
            <div className="flex flex-col gap-2.5">
              <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Missões e Checklists</h3>
              {missoes.length === 0 ? (
                <div className="p-4 rounded-xl bg-neutral-900/30 border border-neutral-900/80 text-center py-6 text-neutral-500 text-xs">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
                  Nenhuma missão de trade marketing pendente hoje.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {missoes.map(m => {
                    const respondido = !!execucoes[m.missao_id];
                    return (
                      <button
                        key={m.missao_id}
                        onClick={() => {
                          setActiveMissao(m);
                          setRespostasAtuais(execucoes[m.missao_id] || {});
                        }}
                        className={`p-3.5 rounded-xl border text-left flex justify-between items-center transition ${
                          respondido 
                            ? "bg-emerald-950/10 border-emerald-900/40 text-emerald-400" 
                            : "bg-neutral-900/40 border-neutral-900 hover:bg-neutral-900 text-neutral-200"
                        }`}
                      >
                        <div>
                          <h4 className="text-xs font-bold">{m.missao?.titulo}</h4>
                          <p className="text-[9px] text-neutral-400 mt-0.5 truncate max-w-[280px]">
                            {m.missao?.descricao}
                          </p>
                        </div>
                        {respondido ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : (
                          <span className="text-[9px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-900/30 px-2 py-0.5 rounded">
                            Pendente
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ÁLBUM DE FOTOS DA VISITA */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Álbum de Fotos</h3>
                <button
                  onClick={() => {
                    setFotoCapturadaFile(null);
                    setFotoCapturadaPreview(null);
                    setDescricaoFotoModal("");
                    setShowPhotoModal(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold rounded-lg text-[10px] uppercase transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nova Foto
                </button>
              </div>

              {fotos.length === 0 ? (
                <div className="p-5 rounded-xl bg-neutral-900/30 border border-neutral-900/80 text-center py-6 text-neutral-500 text-xs">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
                  Nenhuma foto cadastrada nesta visita. Clique em "Nova Foto" para registrar.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {fotos.map((f: any) => {
                    const tipoFormatado = {
                      GONDOLA: "Gôndola",
                      ILHA: "Ilha / Corredor",
                      PONTA_GONDOLA: "Ponta de Gôndola",
                      ENTRADA_LOJA: "Entrada da Loja",
                      SAIDA_LOJA: "Saída / Checkout",
                      CONCORRENCIA: "Concorrência",
                      RUPTURA: "Ruptura (Falta)",
                      EXTRA: "Ponto Extra"
                    }[f.tipo_foto as string] || f.tipo_foto;

                    const publicUrl = supabase.storage.from("promotor-ponto").getPublicUrl(f.foto_url).data.publicUrl;

                    return (
                      <div key={f.id} className="bg-neutral-900/50 rounded-xl border border-neutral-850 overflow-hidden flex flex-col relative group">
                        <div className="relative aspect-square w-full bg-neutral-950">
                          <img src={publicUrl} alt={f.tipo_foto} className="w-full h-full object-cover" />
                          <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-neutral-950/80 backdrop-blur-sm text-[8px] font-bold text-amber-400 rounded">
                            #{f.ordem || 1} • {tipoFormatado}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteFoto(f.id)}
                            className="absolute top-2 right-2 p-1.5 bg-red-950/80 backdrop-blur-sm hover:bg-red-900 text-red-400 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {f.descricao && (
                          <div className="p-2 border-t border-neutral-850">
                            <p className="text-[9px] text-neutral-300 italic line-clamp-2">
                              {f.descricao}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Painel de Checkout */}
            <div className="p-4 bg-neutral-900/60 rounded-2xl border border-neutral-900 flex flex-col gap-3">
              <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Finalização (Check-out)</h3>
              <p className="text-[10px] text-neutral-500">
                O checkout validará se você tirou as fotos necessárias de acordo com o motivo desta visita ({visita.motivo_visita}).
              </p>
              <button
                onClick={handleCheckout}
                disabled={btnLoading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm rounded-xl shadow-lg transition active:scale-98"
              >
                {btnLoading ? "Finalizando..." : "Finalizar Visita (Check-out)"}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE CAPTURA DE FOTOS DA VISITA */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-5 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <header className="p-4 border-b border-neutral-800 bg-neutral-900 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase text-amber-500">
                Registrar Foto da Visita
              </h3>
              <button 
                onClick={() => {
                  setShowPhotoModal(false);
                  setFotoCapturadaFile(null);
                  setFotoCapturadaPreview(null);
                }} 
                className="text-xs text-neutral-400 hover:text-white font-bold"
              >
                Cancelar
              </button>
            </header>
            
            <form onSubmit={handleUploadFoto} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Categoria da Foto</label>
                <select
                  value={tipoFotoModal}
                  onChange={(e) => setTipoFotoModal(e.target.value)}
                  className="text-xs bg-neutral-950 border border-neutral-900 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="GONDOLA">Gôndola (Ponto Natural)</option>
                  <option value="ILHA">Ilha / Corredor</option>
                  <option value="PONTA_GONDOLA">Ponta de Gôndola</option>
                  <option value="ENTRADA_LOJA">Entrada da Loja</option>
                  <option value="SAIDA_LOJA">Saída / Checkout</option>
                  <option value="CONCORRENCIA">Concorrência</option>
                  <option value="RUPTURA">Ruptura (Falta de Produto)</option>
                  <option value="EXTRA">Ponto Extra / Outros</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Observações (Opcional)</label>
                <textarea
                  value={descricaoFotoModal}
                  onChange={(e) => setDescricaoFotoModal(e.target.value)}
                  placeholder="Escreva alguma observação relevante sobre a foto..."
                  rows={2}
                  className="text-xs bg-neutral-950 border border-neutral-900 rounded-lg p-2.5 text-white focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Capturar Imagem</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  ref={photoInputRef} 
                  onChange={handleCaptureFotoChange} 
                  className="hidden" 
                />
                <div
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full h-36 rounded-xl border border-neutral-800 bg-neutral-950 flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:bg-neutral-900 transition relative"
                >
                  {fotoCapturadaPreview ? (
                    <img src={fotoCapturadaPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-neutral-500">
                      <Camera className="w-6 h-6 text-neutral-400" />
                      <span className="text-[10px] font-extrabold uppercase">Tirar Foto</span>
                      <span className="text-[8px] text-neutral-600">Recomendado usar em modo retrato</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={btnLoading || !fotoCapturadaFile}
                className={`w-full py-3.5 font-black text-xs rounded-xl mt-2 transition ${
                  fotoCapturadaFile && !btnLoading
                    ? "bg-amber-500 text-neutral-950 hover:bg-amber-400" 
                    : "bg-neutral-800 text-neutral-600 cursor-not-allowed"
                }`}
              >
                {btnLoading ? "Enviando e Comprimindo..." : "Salvar Foto no Álbum"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE RESPOSTA DO CHECKLIST DA MISSÃO */}
      {activeMissao && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-5">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <header className="p-4 border-b border-neutral-800 bg-neutral-900 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase text-amber-500 truncate max-w-[200px]">
                {activeMissao.missao?.titulo}
              </h3>
              <button onClick={() => setActiveMissao(null)} className="text-xs text-neutral-400 hover:text-white font-bold">
                Fechar
              </button>
            </header>
            
            <form onSubmit={handleSalvarMissao} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              <p className="text-[10px] text-neutral-400 italic">
                {activeMissao.missao?.descricao}
              </p>

              {/* Checklist Dinâmico com base no schema da missão */}
              {activeMissao.missao?.checklist_schema?.fields?.map((field: any) => (
                <div key={field.name} className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-neutral-300 uppercase flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-500/80" />
                    {field.label}
                  </label>
                  
                  {field.type === "boolean" && (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleInputChecklist(field.name, true)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${
                          respostasAtuais[field.name] === true
                            ? "bg-emerald-950/40 border-emerald-900/50 text-emerald-400"
                            : "bg-neutral-950 border-neutral-900 text-neutral-400"
                        }`}
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInputChecklist(field.name, false)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${
                          respostasAtuais[field.name] === false
                            ? "bg-red-950/40 border-red-900/50 text-red-400"
                            : "bg-neutral-950 border-neutral-900 text-neutral-400"
                        }`}
                      >
                        Não
                      </button>
                    </div>
                  )}

                  {field.type === "number" && (
                    <input
                      type="number"
                      value={respostasAtuais[field.name] ?? ""}
                      onChange={(e) => handleInputChecklist(field.name, parseFloat(e.target.value))}
                      placeholder="Digite um número"
                      className="text-xs bg-neutral-950 border border-neutral-900 rounded-lg p-2.5 text-white focus:outline-none"
                    />
                  )}

                  {field.type === "text" && (
                    <input
                      type="text"
                      value={respostasAtuais[field.name] ?? ""}
                      onChange={(e) => handleInputChecklist(field.name, e.target.value)}
                      placeholder="Digite a resposta"
                      className="text-xs bg-neutral-950 border border-neutral-900 rounded-lg p-2.5 text-white focus:outline-none"
                    />
                  )}
                </div>
              ))}

              <button
                type="submit"
                disabled={btnLoading}
                className="w-full py-3 bg-amber-500 text-neutral-950 font-black text-xs rounded-xl mt-4"
              >
                {btnLoading ? "Gravando respostas..." : "Gravar Checklist"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE IMPEDIMENTO / OCORRÊNCIA */}
      {showOcorrenciaModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="bg-neutral-900 border-t border-neutral-850 rounded-t-2xl w-full max-w-md p-5 flex flex-col gap-4 animate-in slide-in-from-bottom duration-200">
            <header className="pb-2 border-b border-neutral-800 flex justify-between items-center">
              <h3 className="text-sm font-bold text-neutral-100">Registrar Impedimento no PDV</h3>
              <button onClick={() => setShowOcorrenciaModal(false)} className="text-xs text-neutral-400 hover:text-white font-bold">
                Cancelar
              </button>
            </header>

            <form onSubmit={handleRegistrarOcorrencia} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Tipo de Ocorrência</label>
                <select
                  value={tipoOcorrencia}
                  onChange={(e) => setTipoOcorrencia(e.target.value)}
                  className="text-xs bg-neutral-950 border border-neutral-900 rounded-lg p-3 text-white"
                >
                  <option value="LOJA_FECHADA">Estabelecimento Fechado (Impeditivo)</option>
                  <option value="ACESSO_NEGADO">Acesso Negado à Loja (Impeditivo)</option>
                  <option value="SEM_ESTOQUE">Sem Estoque de Café Coffee Mais</option>
                  <option value="SEM_MATERIAL_MKT">Falta de Displays / Material MKT</option>
                  <option value="RUPTURA_GRAVE">Ruptura Grave Identificada</option>
                  <option value="OUTRO">Outro Motivo</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Observações / Detalhes</label>
                <textarea
                  value={descricaoOcorrencia}
                  onChange={(e) => setDescricaoOcorrencia(e.target.value)}
                  placeholder="Descreva detalhadamente o ocorrido..."
                  rows={3}
                  className="text-xs bg-neutral-950 border border-neutral-900 rounded-lg p-2.5 text-white focus:outline-none"
                />
              </div>

              {/* Câmera da ocorrência */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Anexar Foto de Evidência</label>
                <input type="file" accept="image/*" capture="environment" ref={ocorrenciaInputRef} onChange={handleOcorrenciaFotoChange} className="hidden" />
                <div
                  onClick={() => ocorrenciaInputRef.current?.click()}
                  className="w-full h-24 rounded-xl border border-neutral-800 bg-neutral-950 flex flex-col items-center justify-center overflow-hidden cursor-pointer"
                >
                  {fotoOcorrenciaPreview ? (
                    <img src={fotoOcorrenciaPreview} alt="Foto de ocorrencia" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-neutral-500">
                      <Camera className="w-4 h-4 text-neutral-400" />
                      <span className="text-[9px] font-extrabold uppercase">Tirar Foto do Local</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={btnLoading}
                className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-black text-sm rounded-xl mt-2"
              >
                {btnLoading ? "Processando impedimento..." : "Registrar Ocorrência / Finalizar"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
