"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  TrendingUp,
  Clock,
  ShieldCheck,
  Percent,
  CheckCircle,
  AlertTriangle,
  RotateCw,
  MapPin,
  Camera,
  Calendar,
  Building,
  User,
  ArrowLeft
} from "lucide-react";

export default function TradeDashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<any>({
    planejadas: 0,
    realizadas: 0,
    taxaExecucao: 0,
    tempoMedioLoja: 0,
    tempoMedioDeslocamento: 0,
    bloqueiosGps: 0,
    bloqueiosTeleporte: 0,
    missoesAtivas: 0,
    missoesExecutadas: 0
  });

  const [tentativasBloqueadas, setTentativasBloqueadas] = useState<any[]>([]);
  const [ocorrenciasRecentes, setOcorrenciasRecentes] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // 1. Carregar Visitas do Dia
      const hoje = new Date().toISOString().split("T")[0];
      const { data: visitas, error: vError } = await supabase
        .from("cm_promotor_visita")
        .select(`
          *,
          agenda:cm_promotor_agenda_diaria(promotor_id, data_agenda)
        `);

      if (vError) throw vError;

      // Filtrar apenas do dia de hoje (ou geral no dev se não houver dados hoje)
      const visitasHoje = visitas?.filter(v => v.agenda?.data_agenda === hoje) || [];
      const visitasDoCalculo = visitasHoje.length > 0 ? visitasHoje : (visitas || []);

      const planejadas = visitasDoCalculo.length;
      const realizadas = visitasDoCalculo.filter(v => v.status === "CONCLUIDA").length;
      const taxaExecucao = planejadas > 0 ? Math.round((realizadas / planejadas) * 100) : 0;

      // Calcular Tempos Médios
      const visitasComTempo = visitasDoCalculo.filter(v => v.duracao_real_min !== null);
      const tempoMedioLoja = visitasComTempo.length > 0 
        ? Math.round(visitasComTempo.reduce((acc, curr) => acc + (curr.duracao_real_min || 0), 0) / visitasComTempo.length)
        : 0;

      const visitasComDeslocamento = visitasDoCalculo.filter(v => v.checkin_servidor && v.em_rota_at);
      const tempoMedioDeslocamento = visitasComDeslocamento.length > 0
        ? Math.round(
            visitasComDeslocamento.reduce((acc, curr) => {
              const diffMs = new Date(curr.checkin_servidor).getTime() - new Date(curr.em_rota_at).getTime();
              return acc + diffMs / 1000 / 60;
            }, 0) / visitasComDeslocamento.length
          )
        : 0;

      // 2. Carregar Logs de Tentativas Bloqueadas (Compliance)
      const { data: tentativas, error: tError } = await supabase
        .from("cm_promotor_visita_tentativa_bloqueada")
        .select(`
          *,
          promotor:cm_employees(nome_completo),
          pdv:base_atendimento(nome_fantasia)
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (tError) throw tError;

      const bloqueiosGps = tentativas?.filter(t => t.tipo_bloqueio === "GPS_FORA_CERCA").length || 0;
      const bloqueiosTeleporte = tentativas?.filter(t => t.tipo_bloqueio === "VELOCIDADE_IMPOSSIVEL").length || 0;
      setTentativasBloqueadas(tentativas || []);

      // 3. Carregar Ocorrências de Execução Recentes
      const { data: ocorrencias, error: oError } = await supabase
        .from("cm_promotor_visita_ocorrencia")
        .select(`
          *,
          visita:cm_promotor_visita(
            cod_parceiro,
            pdv:base_atendimento(nome_fantasia),
            agenda:cm_promotor_agenda_diaria(promotor:cm_employees(nome_completo))
          )
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (oError) throw oError;
      setOcorrenciasRecentes(ocorrencias || []);

      // 4. Carregar Missões
      const { data: missoes } = await supabase.from("cm_trade_missao").select("id");
      const { data: execucoes } = await supabase.from("cm_trade_missao_pdv").select("status");

      const missoesAtivas = missoes?.length || 0;
      const missoesExecutadas = execucoes?.filter(e => e.status === "EXECUTADA").length || 0;

      setKpis({
        planejadas,
        realizadas,
        taxaExecucao,
        tempoMedioLoja,
        tempoMedioDeslocamento,
        bloqueiosGps,
        bloqueiosTeleporte,
        missoesAtivas,
        missoesExecutadas
      });

    } catch (err: any) {
      console.error("Erro ao carregar dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <RotateCw className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        
        {/* Back Button */}
        <Link 
          href="/" 
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors font-medium text-sm w-fit cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Painel
        </Link>

        {/* Top Header */}
        <div className="flex justify-between items-center bg-neutral-900/40 p-6 rounded-2xl border border-neutral-900">
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-amber-500 to-amber-200 bg-clip-text text-transparent">
              Dashboard de Trade & Compliance
            </h1>
            <p className="text-xs text-neutral-400 mt-1">Análise de produtividade do campo, eficiência logística e conformidade antifraude.</p>
          </div>
          <button
            onClick={loadDashboardData}
            className="p-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-850 rounded-xl transition text-neutral-300 hover:text-white"
            title="Atualizar Dados"
          >
            <RotateCw className="w-5 h-5" />
          </button>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Produtividade */}
          <div className="p-5 bg-gradient-to-br from-neutral-900 to-neutral-900/40 border border-neutral-900 rounded-2xl flex flex-col gap-3">
            <span className="p-2 bg-amber-500/10 text-amber-500 rounded-xl w-fit">
              <Percent className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Taxa de Execução</h3>
              <p className="text-2xl font-black mt-1 text-neutral-100">{kpis.taxaExecucao}%</p>
              <p className="text-[10px] text-neutral-500 mt-1">
                {kpis.realizadas} de {kpis.planejadas} visitas concluídas
              </p>
            </div>
          </div>

          {/* Card 2: Tempo em Loja */}
          <div className="p-5 bg-gradient-to-br from-neutral-900 to-neutral-900/40 border border-neutral-900 rounded-2xl flex flex-col gap-3">
            <span className="p-2 bg-blue-500/10 text-blue-400 rounded-xl w-fit">
              <Clock className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Tempo Médio em Loja</h3>
              <p className="text-2xl font-black mt-1 text-neutral-100">{kpis.tempoMedioLoja} min</p>
              <p className="text-[10px] text-neutral-500 mt-1">
                Tempo de deslocamento: {kpis.tempoMedioDeslocamento} min
              </p>
            </div>
          </div>

          {/* Card 3: Compliance/Antifraude */}
          <div className="p-5 bg-gradient-to-br from-neutral-900 to-neutral-900/40 border border-neutral-900 rounded-2xl flex flex-col gap-3">
            <span className="p-2 bg-red-500/10 text-red-400 rounded-xl w-fit">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Check-ins Bloqueados</h3>
              <p className="text-2xl font-black mt-1 text-neutral-100">{tentativasBloqueadas.length}</p>
              <p className="text-[10px] text-neutral-500 mt-1">
                Cerca GPS: {kpis.bloqueiosGps} • Teleporte: {kpis.bloqueiosTeleporte}
              </p>
            </div>
          </div>

          {/* Card 4: Trade Marketing */}
          <div className="p-5 bg-gradient-to-br from-neutral-900 to-neutral-900/40 border border-neutral-900 rounded-2xl flex flex-col gap-3">
            <span className="p-2 bg-purple-500/10 text-purple-400 rounded-xl w-fit">
              <CheckCircle className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Missões de Trade</h3>
              <p className="text-2xl font-black mt-1 text-neutral-100">{kpis.missoesExecutadas}</p>
              <p className="text-[10px] text-neutral-500 mt-1">
                {kpis.missoesAtivas} missões dinâmicas cadastradas
              </p>
            </div>
          </div>
        </div>

        {/* Auditoria de Compliance e Ocorrências */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
          
          {/* Coluna 1: Auditoria de Fraudes de GPS e Biometria */}
          <div className="lg:col-span-7 bg-neutral-900/20 border border-neutral-900 rounded-2xl p-5 flex flex-col gap-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-red-500" />
              Auditoria de Compliance (Tentativas Bloqueadas)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-900 text-neutral-500 font-semibold">
                    <th className="py-2.5">Promotor</th>
                    <th className="py-2.5">PDV</th>
                    <th className="py-2.5">Bloqueio</th>
                    <th className="py-2.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {tentativasBloqueadas.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-neutral-500 text-center">Nenhum bloqueio registrado.</td>
                    </tr>
                  ) : (
                    tentativasBloqueadas.map(t => {
                      const badgeMap: Record<string, { label: string; className: string }> = {
                        GPS_FORA_CERCA: { label: "Cerca GPS", className: "bg-red-500/10 text-red-400 border border-red-900/20" },
                        VELOCIDADE_IMPOSSIVEL: { label: "Teleporte", className: "bg-purple-500/10 text-purple-400 border border-purple-900/20" },
                        GPS_INVALIDO: { label: "GPS Falso", className: "bg-amber-500/10 text-amber-400 border border-amber-900/20" },
                        LOCALIZACAO_INDISPONIVEL: { label: "Sem GPS", className: "bg-yellow-500/10 text-yellow-400 border border-yellow-900/20" },
                        FORA_AGENDA: { label: "Fora Agenda", className: "bg-blue-500/10 text-blue-400 border border-blue-900/20" },
                      };
                      const badge = badgeMap[t.tipo_bloqueio] || { label: t.tipo_bloqueio, className: "bg-neutral-500/10 text-neutral-400 border border-neutral-900/20" };

                      return (
                        <tr key={t.id} className="border-b border-neutral-900/60 hover:bg-neutral-900/20">
                          <td className="py-3 font-semibold text-neutral-300">
                            <div>{t.promotor?.nome_completo?.split(" ")[0] || "Promotor"}</div>
                            <div className="text-[10px] text-neutral-500 font-normal">
                              {new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </td>
                          <td className="py-3 text-neutral-400 truncate max-w-[150px]">
                            {t.pdv?.nome_fantasia || "PDV"}
                          </td>
                          <td className="py-3">
                            <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase ${badge.className}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {t.foto_tentada_url ? (
                              <a
                                href={`https://ncncazbhpoxjlyvcbvqa.supabase.co/storage/v1/object/public/promotor-ponto/${t.foto_tentada_url}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-amber-500 hover:text-amber-400 font-bold flex items-center gap-1 justify-end"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                Ver Foto
                              </a>
                            ) : t.distancia_calculada_metros ? (
                              <span className="text-[10px] text-neutral-400 font-mono">
                                {t.tipo_bloqueio === "VELOCIDADE_IMPOSSIVEL" ? "Teleporte: " : "+"}
                                {t.distancia_calculada_metros >= 1000 
                                  ? `${(t.distancia_calculada_metros / 1000).toFixed(1)} km` 
                                  : `${t.distancia_calculada_metros} m`}
                              </span>
                            ) : (
                              <span className="text-[10px] text-neutral-600">Sem detalhes</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Coluna 2: Ocorrências de Execução Recentes */}
          <div className="lg:col-span-5 bg-neutral-900/20 border border-neutral-900 rounded-2xl p-5 flex flex-col gap-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Ocorrências em Campo (PDVs)
            </h3>

            <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
              {ocorrenciasRecentes.length === 0 ? (
                <p className="text-xs text-neutral-500 py-6 text-center">Nenhuma ocorrência reportada.</p>
              ) : (
                ocorrenciasRecentes.map(o => (
                  <div key={o.id} className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-xl flex flex-col gap-1.5">
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-900/30 px-2 py-0.5 rounded font-black">
                        {o.tipo_ocorrencia.replace("_", " ")}
                      </span>
                      <span className="text-[9px] text-neutral-500 font-mono">
                        {new Date(o.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    
                    <p className="text-xs text-neutral-200 font-semibold truncate">
                      {o.visita?.pdv?.nome_fantasia || "Loja"}
                    </p>
                    
                    <p className="text-[10px] text-neutral-400 italic leading-relaxed line-clamp-2">
                      "{o.descricao || "Sem observações detalhadas."}"
                    </p>
                    
                    <p className="text-[9px] text-neutral-500 mt-1 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-amber-500/70" />
                      Promotor: {o.visita?.agenda?.promotor?.nome_completo || "Desconhecido"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
