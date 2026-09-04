"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  FilePlus,
  ShieldCheck,
  Search,
  Filter,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Upload,
  History,
  Ban,
  Calendar,
  Sparkles,
  RefreshCw,
  Share2,
  Download,
  Edit,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import {
  CartaAnuenciaItem,
  CompetenciaItem,
  listarCartasAnuencia,
  obterResumoDashboard,
  obterCompetencias,
  obterFiltrosGerenteUf,
  cancelarCartaAnuencia,
} from "./actions";
import { formatarDataValidade } from "./validade-helper";
import { CartaPreviewModal } from "./CartaPreviewModal";
import { NovaCartaModal } from "./NovaCartaModal";
import { EditarCartaModal } from "./EditarCartaModal";
import { UploadAssinadaModal } from "./UploadAssinadaModal";
import { TimelineModal } from "./TimelineModal";
import { GerenciarCompetenciasModal } from "./GerenciarCompetenciasModal";
import { FarolExecutivoView } from "./FarolExecutivoView";

export default function CartaAnuenciaPage() {
  // Tabs: "CARTAS" | "FAROL"
  const [activeTab, setActiveTab] = useState<"CARTAS" | "FAROL">("CARTAS");

  // Data States
  const [cartas, setCartas] = useState<CartaAnuenciaItem[]>([]);
  const [competencias, setCompetencias] = useState<CompetenciaItem[]>([]);
  const [gerentesList, setGerentesList] = useState<string[]>([]);
  const [ufsList, setUfsList] = useState<string[]>([]);
  const [cartasError, setCartasError] = useState<string | null>(null);
  const [kpis, setKpis] = useState({
    totalCartas: 0,
    emitidas: 0,
    pendentes: 0,
    assinadasVigentes: 0,
    assinadasExpiradas: 0,
    totalAssinadas: 0,
    canceladas: 0,
    tempoMedioAssinaturaDias: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("TODAS");
  const [competenciaFiltro, setCompetenciaFiltro] = useState("TODAS");
  const [gerenteFiltro, setGerenteFiltro] = useState("TODOS");
  const [ufFiltro, setUfFiltro] = useState("TODAS");

  // Modals
  const [previewCarta, setPreviewCarta] = useState<CartaAnuenciaItem | null>(null);
  const [editarCarta, setEditarCarta] = useState<CartaAnuenciaItem | null>(null);
  const [uploadCarta, setUploadCarta] = useState<CartaAnuenciaItem | null>(null);
  const [timelineCarta, setTimelineCarta] = useState<CartaAnuenciaItem | null>(null);
  const [showNovaCartaModal, setShowNovaCartaModal] = useState(false);
  const [showCompetenciasModal, setShowCompetenciasModal] = useState(false);
  const [preselectedRedeForNova, setPreselectedRedeForNova] = useState<string | undefined>(undefined);
  const [preselectedCompetenciaForNova, setPreselectedCompetenciaForNova] = useState<string | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setCartasError(null);

    try {
      const [cartasRes, kpisRes, compRes, metaRes] = await Promise.allSettled([
        listarCartasAnuencia({
          status: statusFiltro,
          competencia: competenciaFiltro !== "TODAS" ? competenciaFiltro : undefined,
          gerente: gerenteFiltro !== "TODOS" ? gerenteFiltro : undefined,
          uf: ufFiltro !== "TODAS" ? ufFiltro : undefined,
          busca: search || undefined,
        }),
        obterResumoDashboard(),
        obterCompetencias(),
        obterFiltrosGerenteUf(),
      ]);

      // 1. Processar Cartas de Anuência (Recurso Principal)
      let loadedCartas: CartaAnuenciaItem[] = [];
      if (cartasRes.status === "fulfilled") {
        loadedCartas = cartasRes.value || [];
        setCartas(loadedCartas);
        setCartasError(null);
      } else {
        console.error("Erro ao carregar lista de Cartas de Anuência:", cartasRes.reason);
        const errMsg = cartasRes.reason?.message || "";
        if (errMsg.includes("UNAUTHENTICATED") || errMsg.includes("auth")) {
          window.location.href = "/login?redirect=/investimento/carta-anuencia";
          return;
        }
        setCartasError(errMsg || "Falha na comunicação com o servidor ao obter cartas.");
        toast.error("Não foi possível carregar a lista de cartas.");
      }

      // 2. Processar KPIs (com fallback seguro derivado das cartas carregadas)
      if (kpisRes.status === "fulfilled") {
        setKpis(kpisRes.value);
      } else if (cartasRes.status === "fulfilled") {
        let emitidas = 0;
        let pendentes = 0;
        let assinadasVigentes = 0;
        let assinadasExpiradas = 0;
        let canceladas = 0;
        loadedCartas.forEach((c) => {
          if (c.status === "ASSINADA") {
            if (c.expirada) assinadasExpiradas++;
            else assinadasVigentes++;
          } else if (c.status === "EMITIDA" || c.status === "ENVIADA" || c.status === "PENDENTE") {
            pendentes++;
            emitidas++;
          } else if (c.status === "CANCELADA") {
            canceladas++;
          }
        });
        setKpis({
          totalCartas: loadedCartas.length,
          emitidas,
          pendentes,
          assinadasVigentes,
          assinadasExpiradas,
          totalAssinadas: assinadasVigentes + assinadasExpiradas,
          canceladas,
          tempoMedioAssinaturaDias: 0,
        });
      }

      // 3. Processar Competências (com fallback derivado das cartas carregadas)
      if (compRes.status === "fulfilled") {
        setCompetencias(compRes.value || []);
      } else if (cartasRes.status === "fulfilled") {
        const compsUnicas = Array.from(new Set(loadedCartas.map((c) => c.competencia).filter(Boolean)));
        setCompetencias(
          compsUnicas.map((comp, idx) => ({
            id: `comp-derived-${idx}`,
            competencia: comp,
            data_inicio: "",
            data_fim: "",
            encerrada: false,
          }))
        );
      }

      // 4. Processar Metadados de Gerentes e UFs (com fallback derivado das cartas)
      if (metaRes.status === "fulfilled") {
        setGerentesList(metaRes.value.gerentes || []);
        setUfsList(metaRes.value.ufs || []);
      } else if (cartasRes.status === "fulfilled") {
        const gerentesSet = Array.from(
          new Set(loadedCartas.map((c) => c.gerente).filter((g): g is string => !!g))
        ).sort();
        const ufsSet = Array.from(
          new Set(loadedCartas.map((c) => c.uf).filter((u): u is string => !!u))
        ).sort();
        setGerentesList(gerentesSet);
        setUfsList(ufsSet);
      }
    } catch (err: any) {
      console.error("Erro inesperado em fetchData:", err);
      setCartasError(err?.message || "Erro inesperado ao carregar dados.");
      toast.error("Erro ao carregar dados do módulo.");
    } finally {
      setLoading(false);
    }
  }, [statusFiltro, competenciaFiltro, gerenteFiltro, ufFiltro, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCancelar = async (cartaId: string) => {
    const motivo = window.prompt("Por favor, digite o motivo do cancelamento da carta:");
    if (motivo === null) return; // cancelou o prompt

    try {
      await cancelarCartaAnuencia(cartaId, motivo);
      toast.success("Carta de Anuência cancelada com sucesso.");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cancelar carta.");
    }
  };

  const handleEmitirCartaParaRede = (redeCode: string) => {
    setPreselectedRedeForNova(redeCode);
    setShowNovaCartaModal(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      
      {/* Top Header Corporativo */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/investimento"
              className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Voltar para Investimentos"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FileText className="w-5 h-5" />
            </div>

            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                Carta de Anuência
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Gestão Corporativa de Quitação
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Termos de Quitação Financeira, Farol Executivo e Controle de Versões
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCompetenciasModal(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-colors flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4 text-amber-500" />
              Competências
            </button>

            <button
              onClick={() => {
                setPreselectedRedeForNova(undefined);
                setShowNovaCartaModal(true);
              }}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm"
            >
              <FilePlus className="w-4 h-4" />
              Nova Carta
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Executive KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          
          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total de Cartas</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-foreground">{kpis.totalCartas}</span>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground">Cartas Emitidas</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-sky-600 dark:text-sky-400">{kpis.emitidas}</span>
              <Clock className="w-4 h-4 text-sky-500" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground">Pendentes de Assinatura</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{kpis.pendentes}</span>
              <AlertCircle className="w-4 h-4 text-amber-500" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground">Assinadas Vigentes</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-450">{kpis.assinadasVigentes}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground">Assinadas Expiradas</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-700 dark:text-amber-500">{kpis.assinadasExpiradas}</span>
              <Calendar className="w-4 h-4 text-amber-600" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground">Tempo Médio Assinatura</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
                {kpis.tempoMedioAssinaturaDias} <span className="text-xs font-normal text-muted-foreground">dias</span>
              </span>
              <History className="w-4 h-4 text-purple-500" />
            </div>
          </div>

        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("CARTAS")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                activeTab === "CARTAS"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card text-muted-foreground hover:text-foreground border border-border"
              }`}
            >
              <FileText className="w-4 h-4" />
              Gestão de Cartas Emitidas
            </button>

            <button
              onClick={() => setActiveTab("FAROL")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                activeTab === "FAROL"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card text-muted-foreground hover:text-foreground border border-border"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Farol Executivo (&gt; R$ 80k/mês)
            </button>
          </div>

          <button
            onClick={fetchData}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Atualizar Dados"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Tab 1: Gestão de Cartas */}
        {activeTab === "CARTAS" && (
          <div className="space-y-4">
            
            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                {/* Search */}
                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar por N° Carta (CA-2026-...), Rede ou CNPJ..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFiltro}
                  onChange={(e) => setStatusFiltro(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
                >
                  <option value="TODAS">Todos os Status</option>
                  <option value="EMITIDA">Emitidas</option>
                  <option value="ENVIADA">Enviadas</option>
                  <option value="ASSINADA">Assinadas</option>
                  <option value="CANCELADA">Canceladas</option>
                </select>

                {/* Competência Filter */}
                <select
                  value={competenciaFiltro}
                  onChange={(e) => setCompetenciaFiltro(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
                >
                  <option value="TODAS">Todas as Competências</option>
                  {competencias.map((c, idx) => (
                    <option key={`${c.id}-${idx}`} value={c.competencia}>
                      {c.competencia}
                    </option>
                  ))}
                </select>

                {/* Gerente Filter */}
                <select
                  value={gerenteFiltro}
                  onChange={(e) => setGerenteFiltro(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
                >
                  <option value="TODOS">Todos os Gerentes</option>
                  {gerentesList.map((g, idx) => (
                    <option key={`${g}-${idx}`} value={g}>
                      {g}
                    </option>
                  ))}
                </select>

                {/* UF Filter */}
                <select
                  value={ufFiltro}
                  onChange={(e) => setUfFiltro(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
                >
                  <option value="TODAS">Todas as UFs</option>
                  {ufsList.map((u, idx) => (
                    <option key={`${u}-${idx}`} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-xs text-muted-foreground font-medium shrink-0">
                {cartas.length} cartas encontradas
              </span>
            </div>

            {/* Table of Letters */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              {loading ? (
                <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                  <span>Carregando Cartas de Anuência...</span>
                </div>
              ) : cartasError ? (
                <div className="p-12 text-center text-xs text-rose-600 dark:text-rose-400 space-y-3">
                  <AlertCircle className="w-8 h-8 mx-auto text-rose-500" />
                  <p className="font-semibold text-sm">Não foi possível carregar as Cartas de Anuência.</p>
                  <p className="text-muted-foreground text-[11px] max-w-md mx-auto">
                    {cartasError}
                  </p>
                  <button
                    onClick={() => fetchData()}
                    className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Tentar Novamente
                  </button>
                </div>
              ) : cartas.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
                  <p>Nenhuma carta de anuência encontrada.</p>
                  <button
                    onClick={() => setShowNovaCartaModal(true)}
                    className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-xl"
                  >
                    Emitir Primeira Carta
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
                      <tr>
                        <th className="py-3 px-4">Número Oficial</th>
                        <th className="py-3 px-4">Rede</th>
                        <th className="py-3 px-4">Gerente / UF</th>
                        <th className="py-3 px-4">CNPJ</th>
                        <th className="py-3 px-4 text-center">Competência</th>
                        <th className="py-3 px-4 text-center">Emissão</th>
                        <th className="py-3 px-4 text-center">Validade</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {cartas.map((item, idx) => {
                        const dataEmissaoFmt = new Date(item.data_emissao).toLocaleDateString("pt-BR");
                        const dataValidadeFmt = formatarDataValidade(item.validade_ate);

                        return (
                          <tr key={`${item.id}-${idx}`} className="hover:bg-muted/30 transition-colors">
                            {/* Número Oficial & Versão */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-foreground">
                                  {item.numero_carta}
                                </span>
                                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-primary/10 text-primary border border-primary/20">
                                  v{item.versao}
                                </span>
                              </div>
                            </td>

                            {/* Rede */}
                            <td className="py-3 px-4 font-semibold text-foreground">
                              <div className="flex items-center gap-2">
                                {item.logo_rede_url && (
                                  <img
                                    src={item.logo_rede_url}
                                    alt={item.rede_nome}
                                    className="w-5 h-5 object-contain rounded"
                                  />
                                )}
                                {item.rede_nome}
                              </div>
                            </td>

                            {/* Gerente / UF */}
                            <td className="py-3 px-4 text-muted-foreground font-medium">
                              <div className="flex items-center gap-1.5">
                                <span>{item.gerente || "—"}</span>
                                {item.uf && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-muted text-foreground border border-border">
                                    {item.uf}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* CNPJ */}
                            <td className="py-3 px-4 font-mono text-muted-foreground">
                              {item.cnpj || "—"}
                            </td>

                            {/* Competência */}
                            <td className="py-3 px-4 text-center font-semibold">
                              {item.competencia}
                            </td>

                            {/* Emissão */}
                            <td className="py-3 px-4 text-center font-mono text-muted-foreground">
                              {dataEmissaoFmt}
                            </td>

                            {/* Validade */}
                            <td className="py-3 px-4 text-center font-mono">
                              <span className={item.expirada ? "text-amber-600 font-bold" : "text-muted-foreground"}>
                                {dataValidadeFmt}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.status === "ASSINADA"
                                    ? item.expirada
                                      ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                    : item.status === "CANCELADA"
                                    ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                    : "bg-sky-500/10 text-sky-600 border border-sky-500/20"
                                }`}
                              >
                                {item.status} {item.expirada ? "(Expirada)" : ""}
                              </span>
                            </td>

                             {/* Ações */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setPreviewCarta(item)}
                                  className="p-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
                                  title="Visualizar Documento A4"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {/* Botão Editar com trava visual por estado */}
                                <button
                                  onClick={() => setEditarCarta(item)}
                                  className={`p-1.5 rounded-lg border transition-colors ${
                                    item.status === "ASSINADA" || item.status === "CANCELADA"
                                      ? "border-border/60 bg-muted/30 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600"
                                      : "border-border bg-secondary hover:bg-secondary/80 text-amber-600 dark:text-amber-400"
                                  }`}
                                  title={
                                    item.status === "ASSINADA" || item.status === "CANCELADA"
                                      ? "Documento oficial. Para alterações, emita uma nova versão."
                                      : "Editar Dados da Carta"
                                  }
                                >
                                  {item.status === "ASSINADA" || item.status === "CANCELADA" ? (
                                    <Lock className="w-3.5 h-3.5" />
                                  ) : (
                                    <Edit className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                <button
                                  onClick={() => setTimelineCarta(item)}
                                  className="p-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-purple-600 dark:text-purple-400 transition-colors"
                                  title="Linha do Tempo & Rastreabilidade"
                                >
                                  <History className="w-3.5 h-3.5" />
                                </button>

                                {item.status !== "ASSINADA" && item.status !== "CANCELADA" && (
                                  <button
                                    onClick={() => setUploadCarta(item)}
                                    className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                                    title="Anexar Carta Assinada (Dar Baixa no Farol)"
                                  >
                                    <Upload className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {item.status !== "CANCELADA" && (
                                  <button
                                    onClick={() => handleCancelar(item.id)}
                                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 transition-colors"
                                    title="Cancelar Carta"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Tab 2: Farol Executivo */}
        {activeTab === "FAROL" && (
          <FarolExecutivoView
            onEmitirCarta={handleEmitirCartaParaRede}
            onUploadCarta={(c) => setUploadCarta(c)}
            onPreviewCarta={(c) => setPreviewCarta(c)}
          />
        )}

      </main>

      {/* Modals Component */}
      {previewCarta && (
        <CartaPreviewModal
          carta={previewCarta}
          onClose={() => setPreviewCarta(null)}
        />
      )}

      {editarCarta && (
        <EditarCartaModal
          carta={editarCarta}
          onClose={() => setEditarCarta(null)}
          onSuccess={() => {
            setEditarCarta(null);
            fetchData();
          }}
          onEmitirNovaVersao={(redeId, comp) => {
            setPreselectedRedeForNova(redeId);
            setPreselectedCompetenciaForNova(comp);
            setShowNovaCartaModal(true);
          }}
        />
      )}

      {showNovaCartaModal && (
        <NovaCartaModal
          preselectedRede={preselectedRedeForNova}
          preselectedCompetencia={preselectedCompetenciaForNova}
          onClose={() => {
            setShowNovaCartaModal(false);
            setPreselectedRedeForNova(undefined);
            setPreselectedCompetenciaForNova(undefined);
          }}
          onSuccess={() => {
            setShowNovaCartaModal(false);
            setPreselectedRedeForNova(undefined);
            setPreselectedCompetenciaForNova(undefined);
            fetchData();
          }}
        />
      )}

      {uploadCarta && (
        <UploadAssinadaModal
          carta={uploadCarta}
          onClose={() => setUploadCarta(null)}
          onSuccess={() => {
            setUploadCarta(null);
            fetchData();
          }}
        />
      )}

      {timelineCarta && (
        <TimelineModal
          carta={timelineCarta}
          onClose={() => setTimelineCarta(null)}
        />
      )}

      {showCompetenciasModal && (
        <GerenciarCompetenciasModal
          competencias={competencias}
          onClose={() => setShowCompetenciasModal(false)}
          onSuccess={() => {
            setShowCompetenciasModal(false);
            fetchData();
          }}
        />
      )}

    </div>
  );
}
