"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  FilePlus,
  RotateCcw,
  Sparkles,
  TrendingUp,
  ShieldAlert,
  Share2,
  Copy,
  RefreshCw,
  Trophy,
  Users,
  ChevronUp,
  Plus,
  Trash2,
  Settings,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  obterDadosFarolGerencial,
  excluirRedeDoFarol,
  incluirRedeNoFarol,
  reativarRedeNoFarol,
  listarOverridesFarol,
  listarRedesDisponiveisParaInclusaoFarol,
  FarolGerencialResumo,
  FarolGerencialGerenteItem,
  FarolGerencialRedeItem,
  CartaAnuenciaItem,
} from "./actions";
import { formatarDataValidade } from "./validade-helper";

interface FarolGerencialViewProps {
  onEmitirCarta: (redeCode: string, competencia?: string) => void;
  onPreviewCarta: (carta: CartaAnuenciaItem) => void;
  onUploadCarta?: (carta: CartaAnuenciaItem) => void;
  competenciaDefault?: string;
}

export function FarolGerencialView({
  onEmitirCarta,
  onPreviewCarta,
  onUploadCarta,
  competenciaDefault,
}: FarolGerencialViewProps) {
  const [resumo, setResumo] = useState<FarolGerencialResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState<string>(competenciaDefault || "Junho/2026");
  const [filterRegional, setFilterRegional] = useState<string>("TODAS");
  const [filterGerente, setFilterGerente] = useState<string>("TODOS");
  const [filterUf, setFilterUf] = useState<string>("TODAS");
  const [filterStatusCarta, setFilterStatusCarta] = useState<string>("TODOS");
  const [search, setSearch] = useState<string>("");

  // Expansão de gerentes e toggle de ranking
  const [expandedGerentes, setExpandedGerentes] = useState<Record<string, boolean>>({});
  const [showRanking, setShowRanking] = useState<boolean>(true);

  // Estados Administrativos (Apenas Admin)
  const [modalExcluirOpen, setModalExcluirOpen] = useState(false);
  const [redeParaExcluir, setRedeParaExcluir] = useState<FarolGerencialRedeItem | null>(null);
  const [motivoExclusao, setMotivoExclusao] = useState("");
  const [salvandoExclusao, setSalvandoExclusao] = useState(false);

  const [modalIncluirOpen, setModalIncluirOpen] = useState(false);
  const [buscaClientesInclusao, setBuscaClientesInclusao] = useState("");
  const [clientesDisponiveis, setClientesDisponiveis] = useState<any[]>([]);
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  const [clienteSelecionadoParaInclusao, setClienteSelecionadoParaInclusao] = useState<any | null>(null);
  const [observacaoInclusao, setObservacaoInclusao] = useState("");
  const [salvandoInclusao, setSalvandoInclusao] = useState(false);

  const [modalOverridesOpen, setModalOverridesOpen] = useState(false);
  const [overridesList, setOverridesList] = useState<any[]>([]);
  const [carregandoOverrides, setCarregandoOverrides] = useState(false);

  const formatarMoeda = (val?: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);
  };

  const carregarClientesParaInclusao = async (termo: string) => {
    setCarregandoClientes(true);
    try {
      const data = await listarRedesDisponiveisParaInclusaoFarol(termo);
      setClientesDisponiveis(data);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar operações de clientes.");
    } finally {
      setCarregandoClientes(false);
    }
  };

  const carregarListaOverrides = async () => {
    setCarregandoOverrides(true);
    try {
      const data = await listarOverridesFarol();
      setOverridesList(data);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar lista de ajustes.");
    } finally {
      setCarregandoOverrides(false);
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!redeParaExcluir) return;
    if (!motivoExclusao.trim()) {
      toast.error("O motivo da exclusão é obrigatório.");
      return;
    }

    setSalvandoExclusao(true);
    try {
      await excluirRedeDoFarol({
        rede_nome: redeParaExcluir.rede,
        codigo_matriz: redeParaExcluir.codigo_matriz,
        gerente: redeParaExcluir.manager,
        motivo: motivoExclusao.trim(),
      });
      toast.success(`Rede "${redeParaExcluir.rede}" excluída do Farol com sucesso!`);
      setModalExcluirOpen(false);
      setRedeParaExcluir(null);
      setMotivoExclusao("");
      await carregarDados();
    } catch (err: any) {
      console.error("Erro ao excluir rede do Farol:", err);
      toast.error(err.message || "Erro ao excluir rede.");
    } finally {
      setSalvandoExclusao(false);
    }
  };

  const handleConfirmarInclusao = async () => {
    if (!clienteSelecionadoParaInclusao) {
      toast.error("Selecione uma operação para incluir.");
      return;
    }

    setSalvandoInclusao(true);
    try {
      await incluirRedeNoFarol({
        rede_nome: clienteSelecionadoParaInclusao.rede_nome,
        codigo_matriz: clienteSelecionadoParaInclusao.codigo_matriz,
        gerente: clienteSelecionadoParaInclusao.gerente,
        observacao: observacaoInclusao.trim() || undefined,
      });
      toast.success(`Rede "${clienteSelecionadoParaInclusao.rede_nome}" incluída no Farol com sucesso!`);
      setModalIncluirOpen(false);
      setClienteSelecionadoParaInclusao(null);
      setObservacaoInclusao("");
      await carregarDados();
    } catch (err: any) {
      console.error("Erro ao incluir rede no Farol:", err);
      toast.error(err.message || "Erro ao incluir rede.");
    } finally {
      setSalvandoInclusao(false);
    }
  };

  const handleReativarOverride = async (configId: string, nomeRede: string) => {
    try {
      await reativarRedeNoFarol(configId);
      toast.success(`Rede "${nomeRede}" restaurada ao universo oficial!`);
      await carregarListaOverrides();
      await carregarDados();
    } catch (err: any) {
      console.error("Erro ao reativar rede:", err);
      toast.error(err.message || "Erro ao reativar rede.");
    }
  };

  const carregarDados = async (comp?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await obterDadosFarolGerencial({
        competencia: comp || competenciaSelecionada,
      });
      setResumo(data);
      if (data.competencia && data.competencia !== competenciaSelecionada) {
        setCompetenciaSelecionada(data.competencia);
      }
      // Inicializar todos os gerentes expandidos por padrão
      const expandMap: Record<string, boolean> = {};
      (data.gerentes || []).forEach((g) => {
        expandMap[g.id] = true;
      });
      setExpandedGerentes(expandMap);
    } catch (err: any) {
      console.error("Erro ao carregar Farol Gerencial:", err);
      setError(err.message || "Erro ao carregar dados do Farol Executivo Gerencial.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados(competenciaSelecionada);
  }, [competenciaSelecionada]);

  const toggleExpand = (gerenteId: string) => {
    setExpandedGerentes((prev) => ({
      ...prev,
      [gerenteId]: !prev[gerenteId],
    }));
  };

  const expandAll = () => {
    if (!resumo) return;
    const expandMap: Record<string, boolean> = {};
    (resumo.gerentes || []).forEach((g) => {
      expandMap[g.id] = true;
    });
    setExpandedGerentes(expandMap);
  };

  const collapseAll = () => {
    setExpandedGerentes({});
  };

  const limparFiltros = () => {
    setFilterRegional("TODAS");
    setFilterGerente("TODOS");
    setFilterUf("TODAS");
    setFilterStatusCarta("TODOS");
    setSearch("");
  };

  // Lista dinâmica de UFs disponíveis
  const ufsDisponiveis = useMemo(() => {
    if (!resumo) return [];
    const setUfs = new Set<string>();
    (resumo.gerentes || []).forEach((g) => {
      g.redes.forEach((rede) => {
        if (rede.uf) setUfs.add(rede.uf.toUpperCase());
      });
    });
    return Array.from(setUfs).sort();
  }, [resumo]);

  // Lista dinâmica de gerentes disponíveis para o filtro
  const gerentesDisponiveis = useMemo(() => {
    if (!resumo) return [];
    return Array.from(new Set((resumo.gerentes || []).map((g) => g.gerente))).sort();
  }, [resumo]);

  // Lista dinâmica de regionais disponíveis para o filtro
  const regionaisDisponiveis = useMemo(() => {
    if (!resumo) return [];
    return Array.from(new Set((resumo.gerentes || []).map((g) => g.regional))).sort();
  }, [resumo]);

  // Filtragem e recalculo local de visibilidade em AND
  const gerentesFiltrados = useMemo(() => {
    if (!resumo) return [];

    return (resumo.gerentes || [])
      .filter((g) => {
        if (filterGerente !== "TODOS" && g.gerente !== filterGerente) return false;
        if (filterRegional !== "TODAS" && g.regional !== filterRegional) return false;
        return true;
      })
      .map((g) => {
        const redesFiltradas = g.redes.filter((r) => {
          if (filterUf !== "TODAS" && (r.uf || "").toUpperCase() !== filterUf.toUpperCase()) {
            return false;
          }
          if (filterStatusCarta === "COM_CARTA" && !r.possui_carta) return false;
          if (filterStatusCarta === "SEM_CARTA" && r.possui_carta) return false;
          if (filterStatusCarta === "ASSINADA" && (!r.carta || (r.carta.status !== "ASSINADA" && !r.carta.arquivo_assinado_url))) return false;
          if (filterStatusCarta === "EMITIDA" && (!r.carta || r.carta.status === "ASSINADA" || Boolean(r.carta.arquivo_assinado_url))) return false;

          if (search) {
            const s = search.toLowerCase().trim();
            const matchNome = r.rede.toLowerCase().includes(s);
            const matchCod = r.codigo_matriz.toLowerCase().includes(s);
            const matchCarta = (r.carta?.numero_carta || "").toLowerCase().includes(s);
            const matchGerente = r.manager.toLowerCase().includes(s);
            const matchUf = (r.uf || "").toLowerCase().includes(s);
            if (!matchNome && !matchCod && !matchCarta && !matchGerente && !matchUf) return false;
          }
          return true;
        });

        return {
          ...g,
          redesFiltradas,
        };
      })
      .filter((g) => {
        // Se houver busca, filtro de UF ou status, ocultar gerentes sem redes correspondentes
        if (search || filterUf !== "TODAS" || filterStatusCarta !== "TODOS") {
          return g.redesFiltradas.length > 0;
        }
        return true;
      });
  }, [resumo, filterGerente, filterRegional, filterUf, filterStatusCarta, search]);

  // Ranking dinâmico recalculado sobre o contexto filtrado em AND
  const rankingFiltrado = useMemo(() => {
    if (!gerentesFiltrados || gerentesFiltrados.length === 0) return [];

    const items = gerentesFiltrados.map((g) => {
      const redesComCarta = g.redesFiltradas.filter((r) => r.possui_carta && r.carta);
      
      // ASSINADA = somente se status === 'ASSINADA' ou possui arquivo_assinado_url
      const assinadas = redesComCarta.filter(
        (r) => r.carta!.status === "ASSINADA" || Boolean(r.carta!.arquivo_assinado_url)
      ).length;

      // PARA ASSINAR = carta existe mas ainda não está assinada
      const paraAssinar = redesComCarta.filter(
        (r) => r.carta!.status !== "ASSINADA" && !r.carta!.arquivo_assinado_url
      ).length;

      const total = assinadas + paraAssinar;
      const pct = total > 0 ? Number(((assinadas / total) * 100).toFixed(1)) : 0;

      return {
        gerente: g.gerente,
        total_cartas: total,
        cartas_para_assinar: paraAssinar,
        cartas_assinadas: assinadas,
        pct_cartas_assinadas: pct,
      };
    });

    // Ordenação do ranking (Seção 6):
    // 1. % de Cartas assinadas (DESC)
    // 2. Cartas assinadas (DESC)
    // 3. Gerente alfabético (ASC)
    return items
      .sort((a, b) => {
        if (b.pct_cartas_assinadas !== a.pct_cartas_assinadas) {
          return b.pct_cartas_assinadas - a.pct_cartas_assinadas;
        }
        if (b.cartas_assinadas !== a.cartas_assinadas) {
          return b.cartas_assinadas - a.cartas_assinadas;
        }
        return a.gerente.localeCompare(b.gerente, "pt-BR");
      })
      .map((item, idx) => ({
        posicao: idx + 1,
        ...item,
      }));
  }, [gerentesFiltrados]);

  // 7. Copiar Ranking para WhatsApp
  const handleCopiarRankingWhatsApp = async () => {
    if (!rankingFiltrado || rankingFiltrado.length === 0) {
      toast.error("Nenhum dado no ranking para copiar.");
      return;
    }

    let texto = "📊 RANKING DE ASSINATURA — CARTAS DE ANUÊNCIA\n\n";
    let totalCartas = 0;
    let totalParaAssinar = 0;
    let totalAssinadas = 0;

    rankingFiltrado.forEach((item) => {
      const totalItem = item.total_cartas;
      totalCartas += totalItem;
      totalParaAssinar += item.cartas_para_assinar;
      totalAssinadas += item.cartas_assinadas;
      const pctFmt = item.pct_cartas_assinadas.toFixed(1).replace(".", ",");
      texto += `${item.posicao}. ${item.gerente} — ${totalItem} cartas | ${item.cartas_para_assinar} para assinar | ${item.cartas_assinadas} assinadas | ${pctFmt}%\n`;
    });

    const pctTotal = totalCartas > 0 ? (totalAssinadas / totalCartas) * 100 : 0;
    const pctTotalFmt = pctTotal.toFixed(1).replace(".", ",");
    texto += `\nTotal: ${totalCartas} cartas | ${totalParaAssinar} para assinar | ${totalAssinadas} assinadas | ${pctTotalFmt}%`;

    try {
      await navigator.clipboard.writeText(texto.trim());
      toast.success("Ranking copiado!");
    } catch (err) {
      console.error("Erro ao copiar ranking para WhatsApp:", err);
      toast.error("Não foi possível copiar para a área de transferência.");
    }
  };

  // Helpers de Badge de Status Farol
  const getBadgeFarol = (status: "VERDE" | "AMARELO" | "LARANJA" | "VERMELHO", pct: number) => {
    switch (status) {
      case "VERDE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {pct >= 100 ? "Completa (100%)" : `Alta (${pct}%)`}
          </span>
        );
      case "AMARELO":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Atenção ({pct}%)
          </span>
        );
      case "LARANJA":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            Baixa ({pct}%)
          </span>
        );
      case "VERMELHO":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Crítico ({pct}%)
          </span>
        );
    }
  };

  const getBadgeStatusCarta = (carta: FarolGerencialRedeItem["carta"]) => {
    if (!carta) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
          <AlertCircle className="w-3 h-3" />
          🔴 SEM CARTA
        </span>
      );
    }

    if (carta.status === "ASSINADA" || carta.arquivo_assinado_url) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" />
          Assinada
        </span>
      );
    }

    if (carta.status === "ENVIADA") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30">
          <Clock className="w-3 h-3" />
          Enviada
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
        <Clock className="w-3 h-3" />
        Emitida
      </span>
    );
  };

  const isGerenteRegional = Boolean(resumo?.is_gerente_regional);

  return (
    <div className="space-y-6">
      
      {/* 1. Header Informativo Corporativo */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-primary/10 via-amber-500/5 to-purple-500/10 border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start md:items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black tracking-tight text-foreground">
                {isGerenteRegional ? "FAROL EXECUTIVO — MINHA CARTEIRA" : "Farol Executivo Gerencial — Cobertura por Gerente"}
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-primary/20 text-primary border border-primary/30">
                {isGerenteRegional ? "Carteira Regional" : "100% Auditado"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isGerenteRegional
                ? `Gestão e acompanhamento das Cartas de Anuência da carteira de ${resumo?.gerente_logado || "Gerente Regional"}`
                : "Acompanhamento determinístico da cobertura documental das Redes Oficiais Planejáveis por Gerente de Contas"}
            </p>
          </div>
        </div>

        {/* Ações de Topo: Competência e Administração */}
        <div className="flex items-center gap-2.5 self-end md:self-auto flex-wrap">
          {/* Seletor de Competência */}
          <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-2xl border border-border shadow-sm">
            <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
              Competência:
            </span>
            <select
              value={competenciaSelecionada}
              onChange={(e) => setCompetenciaSelecionada(e.target.value)}
              disabled={loading}
              className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer"
            >
              {resumo?.competencias_disponiveis.map((c) => (
                <option key={c.id} value={c.competencia} className="bg-popover text-popover-foreground">
                  {c.competencia} {c.encerrada ? "(Encerrada)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Ações de Inclusão/Exclusão Administrativa (Apenas Admin) */}
          {resumo?.is_admin && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setClienteSelecionadoParaInclusao(null);
                  setObservacaoInclusao("");
                  setModalIncluirOpen(true);
                  carregarClientesParaInclusao("");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl shadow-sm transition-all"
                title="Incluir rede existente no módulo Clientes ao universo do Farol"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Incluir Rede</span>
              </button>

              <button
                onClick={() => {
                  setModalOverridesOpen(true);
                  carregarListaOverrides();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-card border border-border hover:bg-muted text-foreground rounded-2xl shadow-sm transition-all"
                title="Gerenciar ajustes manuais (inclusões e exclusões)"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Ajustes</span>
                {resumo.total_overrides_ativos && resumo.total_overrides_ativos > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                    {resumo.total_overrides_ativos}
                  </span>
                ) : null}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Cards Consolidados no Topo */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-card border border-border animate-pulse p-4" />
          ))}
        </div>
      ) : resumo ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Redes Esperadas */}
          <div
            onClick={() => setFilterStatusCarta("TODOS")}
            className={`p-5 rounded-2xl bg-card border transition-all cursor-pointer shadow-sm hover:shadow-md ${
              filterStatusCarta === "TODOS"
                ? "border-primary ring-2 ring-primary/20"
                : "border-border hover:border-border/80"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isGerenteRegional ? "Minhas Redes" : "Redes Esperadas"}
              </span>
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black text-foreground tracking-tight">
                {resumo.total_esperadas}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                {isGerenteRegional ? "Planejáveis" : "Universo Oficial"}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
              <span>{isGerenteRegional ? "Total de Redes na Carteira" : "View Oficial de Redes Planejáveis"}</span>
            </div>
          </div>

          {/* Card 2: No Sistema */}
          <div
            onClick={() => setFilterStatusCarta(filterStatusCarta === "COM_CARTA" ? "TODOS" : "COM_CARTA")}
            className={`p-5 rounded-2xl bg-card border transition-all cursor-pointer shadow-sm hover:shadow-md ${
              filterStatusCarta === "COM_CARTA"
                ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5"
                : "border-border hover:border-emerald-500/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isGerenteRegional ? "Minhas Cartas" : "No Sistema"}
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                {resumo.total_no_sistema}
              </span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                Cartas Ativas
              </span>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground flex items-center justify-between">
              <span>Clique para filtrar com carta</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Filtrar</span>
            </div>
          </div>

          {/* Card 3: Faltantes */}
          <div
            onClick={() => setFilterStatusCarta(filterStatusCarta === "SEM_CARTA" ? "TODOS" : "SEM_CARTA")}
            className={`p-5 rounded-2xl bg-card border transition-all cursor-pointer shadow-sm hover:shadow-md ${
              filterStatusCarta === "SEM_CARTA"
                ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/5"
                : "border-border hover:border-rose-500/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isGerenteRegional ? "Minhas Pendências" : "Faltantes"}
              </span>
              <AlertCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                {resumo.total_faltantes}
              </span>
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                Sem Carta
              </span>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground flex items-center justify-between">
              <span>Clique para ver pendências</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">Filtrar</span>
            </div>
          </div>

          {/* Card 4: Cobertura Geral */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isGerenteRegional ? "Minha Cobertura" : "Cobertura Geral"}
              </span>
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black text-foreground tracking-tight">
                {resumo.cobertura_geral_pct}%
              </span>
              {getBadgeFarol(resumo.status_farol_geral, resumo.cobertura_geral_pct)}
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              <span>Meta Corporativa: 100% de quitação</span>
            </div>
          </div>

        </div>
      ) : null}

      {/* 3. Seção: Ranking de Assinatura (Exibir / Ocultar + Copiar WhatsApp) */}
      <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                {isGerenteRegional ? "Ranking da Minha Carteira" : "Ranking de Assinatura — Cartas de Anuência"}
                <span className="text-[11px] font-semibold text-muted-foreground">
                  ({rankingFiltrado.length} {rankingFiltrado.length === 1 ? "gerente" : "gerentes"})
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cartas para assinar vs. Cartas assinadas (exclusivo para cartas existentes no sistema)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopiarRankingWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-colors shadow-sm"
              title="Copiar texto estruturado do ranking para o WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              Copiar para WhatsApp
            </button>

            <button
              onClick={() => setShowRanking(!showRanking)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
            >
              {showRanking ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Ocultar Ranking
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Exibir Ranking
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tabela do Ranking (Visível somente se showRanking === true) */}
        {showRanking && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Gerente</th>
                  <th className="py-3 px-4 text-center">Total de Cartas</th>
                  <th className="py-3 px-4 text-center">Cartas para assinar</th>
                  <th className="py-3 px-4 text-center">Cartas assinadas</th>
                  <th className="py-3 px-4 text-right">% de Cartas assinadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rankingFiltrado.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      Nenhum dado de ranking para os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  rankingFiltrado.map((item) => {
                    const isTop1 = item.posicao === 1 && item.pct_cartas_assinadas > 0;
                    return (
                      <tr
                        key={item.gerente}
                        className={`hover:bg-muted/30 transition-colors ${
                          isTop1 ? "bg-amber-500/5 font-semibold" : ""
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          {isTop1 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-amber-950 font-black text-xs shadow-sm">
                              1º
                            </span>
                          ) : (
                            <span className="font-bold text-muted-foreground">
                              {item.posicao}º
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-foreground font-bold">
                          {item.gerente}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-foreground">
                          {item.total_cartas}
                        </td>
                        <td className="py-3 px-4 text-center text-amber-600 dark:text-amber-400 font-semibold">
                          {item.cartas_para_assinar}
                        </td>
                        <td className="py-3 px-4 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                          {item.cartas_assinadas}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-foreground">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-lg text-xs ${
                              item.pct_cartas_assinadas >= 50
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold"
                                : item.pct_cartas_assinadas > 0
                                ? "bg-amber-500/10 text-amber-600 font-bold"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {item.pct_cartas_assinadas.toFixed(1).replace(".", ",")}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {rankingFiltrado.length > 0 && (
                <tfoot className="border-t-2 border-border bg-muted/30 font-bold text-xs">
                  <tr>
                    <td className="py-3 px-4 text-center text-muted-foreground">—</td>
                    <td className="py-3 px-4 text-foreground uppercase tracking-wider">
                      {isGerenteRegional ? "Total Minha Carteira" : "Total Brasil"}
                    </td>
                    <td className="py-3 px-4 text-center text-foreground font-extrabold">
                      {rankingFiltrado.reduce((acc, i) => acc + i.total_cartas, 0)}
                    </td>
                    <td className="py-3 px-4 text-center text-amber-600 dark:text-amber-400 font-extrabold">
                      {rankingFiltrado.reduce((acc, i) => acc + i.cartas_para_assinar, 0)}
                    </td>
                    <td className="py-3 px-4 text-center text-emerald-600 dark:text-emerald-400 font-extrabold">
                      {rankingFiltrado.reduce((acc, i) => acc + i.cartas_assinadas, 0)}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-foreground">
                      {(() => {
                        const totCartas = rankingFiltrado.reduce((acc, i) => acc + i.total_cartas, 0);
                        const totAssinadas = rankingFiltrado.reduce((acc, i) => acc + i.cartas_assinadas, 0);
                        const pctTot = totCartas > 0 ? (totAssinadas / totCartas) * 100 : 0;
                        return `${pctTot.toFixed(1).replace(".", ",")}%`;
                      })()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* 4. Toolbar de Filtros Combinados em AND */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span>Filtros do Farol Gerencial</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
            >
              Expandir Todos
            </button>
            <span className="text-border">|</span>
            <button
              onClick={collapseAll}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
            >
              Recolher Todos
            </button>
            <span className="text-border">|</span>
            <button
              onClick={limparFiltros}
              className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:opacity-80 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Limpar Filtros
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Busca Textual */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar rede, cód. ou carta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-muted/40 rounded-xl border border-border focus:border-primary focus:outline-none transition-colors"
            />
          </div>

          {/* Filtro Gerente */}
          <div>
            <select
              value={filterGerente}
              onChange={(e) => setFilterGerente(e.target.value)}
              disabled={isGerenteRegional}
              className="w-full px-3 py-2 text-xs bg-muted/40 rounded-xl border border-border focus:border-primary focus:outline-none transition-colors cursor-pointer disabled:opacity-60"
            >
              <option value="TODOS">Gerente: Todos</option>
              {gerentesDisponiveis.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Regional */}
          <div>
            <select
              value={filterRegional}
              onChange={(e) => setFilterRegional(e.target.value)}
              disabled={isGerenteRegional}
              className="w-full px-3 py-2 text-xs bg-muted/40 rounded-xl border border-border focus:border-primary focus:outline-none transition-colors cursor-pointer disabled:opacity-60"
            >
              <option value="TODAS">Regional: Todas</option>
              {regionaisDisponiveis.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro UF */}
          <div>
            <select
              value={filterUf}
              onChange={(e) => setFilterUf(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-muted/40 rounded-xl border border-border focus:border-primary focus:outline-none transition-colors cursor-pointer"
            >
              <option value="TODAS">UF: Todas</option>
              {ufsDisponiveis.map((uf) => (
                <option key={uf} value={uf}>
                  UF: {uf}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Status da Carta */}
          <div>
            <select
              value={filterStatusCarta}
              onChange={(e) => setFilterStatusCarta(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-muted/40 rounded-xl border border-border focus:border-primary focus:outline-none transition-colors cursor-pointer"
            >
              <option value="TODOS">Status: Todos</option>
              <option value="COM_CARTA">🟢 Com Carta (No Sistema)</option>
              <option value="SEM_CARTA">🔴 Sem Carta (Faltantes)</option>
              <option value="ASSINADA">Assinadas</option>
              <option value="EMITIDA">Emitidas / Em Andamento</option>
            </select>
          </div>

        </div>
      </div>

      {/* 5. Tabela Gerencial e Detalhamento Agrupado por Gerente Responsável */}
      {loading ? (
        <div className="p-12 text-center text-xs text-muted-foreground bg-card rounded-2xl border border-border shadow-sm">
          <Building2 className="w-8 h-8 animate-pulse mx-auto mb-2 text-primary" />
          <span>Carregando Farol Executivo Gerencial...</span>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-xs text-rose-600 dark:text-rose-400 bg-card rounded-2xl border border-rose-500/20 shadow-sm space-y-3">
          <ShieldAlert className="w-8 h-8 mx-auto text-rose-500" />
          <p className="font-bold text-sm">Erro ao carregar dados do Farol Gerencial</p>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => carregarDados()}
            className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            Tentar Novamente
          </button>
        </div>
      ) : gerentesFiltrados.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted-foreground bg-card rounded-2xl border border-border shadow-sm space-y-2">
          <p>Nenhuma rede ou gerente encontrado com os filtros selecionados.</p>
          <button
            onClick={limparFiltros}
            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-xl"
          >
            Limpar Filtros
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {gerentesFiltrados.map((g) => {
            const isExpanded = expandedGerentes[g.id] ?? false;

            return (
              <div
                key={g.id}
                className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden transition-all"
              >
                {/* Cabeçalho do Gerente Responsável (Acordeão) */}
                <div
                  onClick={() => toggleExpand(g.id)}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/30 transition-colors border-b border-border/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      className="p-1.5 rounded-xl bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                      title={isExpanded ? "Recolher" : "Expandir"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-black text-foreground">
                          GERENTE: {g.gerente.toUpperCase()}
                        </h3>
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-muted text-muted-foreground">
                          Regional: {g.regional}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {g.redesFiltradas.length} de {g.esperadas} redes exibidas
                      </p>
                    </div>
                  </div>

                  {/* KPIs do Gerente */}
                  <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-end">
                    
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                        Esperadas
                      </span>
                      <span className="text-sm font-extrabold text-foreground">
                        {g.esperadas}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                        No Sistema
                      </span>
                      <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                        {g.no_sistema}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                        Faltantes
                      </span>
                      <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
                        {g.faltantes}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                        Cobertura
                      </span>
                      <span className="text-sm font-extrabold text-foreground">
                        {g.cobertura_pct}%
                      </span>
                    </div>

                    <div className="hidden md:block">
                      {getBadgeFarol(g.status_farol, g.cobertura_pct)}
                    </div>

                  </div>
                </div>

                {/* Detalhamento das Redes do Gerente */}
                {isExpanded && (
                  <div className="overflow-x-auto border-t border-border/40">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border/60 bg-muted/20 text-muted-foreground font-semibold text-[11px]">
                          <th className="py-2.5 px-4">Rede Operacional</th>
                          <th className="py-2.5 px-3">Cód. Matriz</th>
                          <th className="py-2.5 px-3">UF</th>
                          <th className="py-2.5 px-3">Carta no Sistema?</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Número da Carta</th>
                          <th className="py-2.5 px-3">Competência</th>
                          <th className="py-2.5 px-3">Validade</th>
                          <th className="py-2.5 px-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {g.redesFiltradas.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-6 text-center text-muted-foreground text-xs">
                              Nenhuma rede encontrada para os filtros ativos deste gerente.
                            </td>
                          </tr>
                        ) : (
                          g.redesFiltradas.map((r) => {
                            const temCarta = r.possui_carta;
                            const isAssinada = Boolean(r.carta?.status === "ASSINADA" || r.carta?.arquivo_assinado_url);

                            return (
                              <tr
                                key={`${r.manager}-${r.rede}-${r.codigo_matriz}`}
                                className={`hover:bg-muted/40 transition-colors ${
                                  !temCarta ? "bg-rose-500/[0.02]" : ""
                                }`}
                              >
                                {/* Rede e Faturamento Médio 3M */}
                                <td className="py-3 px-4 text-foreground">
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold">{r.rede}</span>
                                      {!temCarta && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" title="Sem Carta de Anuência" />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px]">
                                      {r.faturamento_medio_3m && r.faturamento_medio_3m > 0 ? (
                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                          {formatarMoeda(r.faturamento_medio_3m)}/mês
                                        </span>
                                      ) : (
                                        <span
                                          className="text-muted-foreground italic cursor-help"
                                          title="Sem faturamento nos últimos 3 meses fechados"
                                        >
                                          R$ 0,00/mês
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Código Matriz */}
                                <td className="py-3 px-3 font-mono text-muted-foreground text-[11px]">
                                  {r.codigo_matriz}
                                </td>

                                {/* UF */}
                                <td className="py-3 px-3 font-semibold text-foreground">
                                  {r.uf || "—"}
                                </td>

                                {/* Carta no Sistema? */}
                                <td className="py-3 px-3">
                                  {temCarta ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Sim
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                      <AlertCircle className="w-3.5 h-3.5" /> Não
                                    </span>
                                  )}
                                </td>

                                {/* Status da Carta */}
                                <td className="py-3 px-3">
                                  {getBadgeStatusCarta(r.carta)}
                                </td>

                                {/* Número da Carta */}
                                <td className="py-3 px-3 font-mono text-[11px] font-semibold text-foreground">
                                  {r.carta?.numero_carta || "—"}
                                </td>

                                {/* Competência */}
                                <td className="py-3 px-3 text-muted-foreground">
                                  {r.carta?.competencia || competenciaSelecionada}
                                </td>

                                {/* Validade */}
                                <td className="py-3 px-3 text-muted-foreground text-[11px]">
                                  {r.carta?.validade_ate
                                    ? formatarDataValidade(r.carta.validade_ate)
                                    : "—"}
                                </td>

                                {/* Ações Rápidas */}
                                <td className="py-3 px-4 text-right space-x-1.5">
                                  {temCarta && r.carta ? (
                                    <>
                                      <button
                                        onClick={() =>
                                          onPreviewCarta({
                                            ...r.carta!,
                                            rede_nome: r.carta!.rede_nome || r.rede,
                                          })
                                        }
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-primary hover:text-primary-foreground hover:bg-primary rounded-lg border border-primary/30 transition-colors"
                                        title="Visualizar Carta de Anuência"
                                      >
                                        <Eye className="w-3 h-3" />
                                        Visualizar
                                      </button>

                                      {onUploadCarta && (
                                        <button
                                          onClick={() =>
                                            onUploadCarta({
                                              ...r.carta!,
                                              rede_nome: r.carta!.rede_nome || r.rede,
                                            })
                                          }
                                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors ${
                                            isAssinada
                                              ? "text-amber-600 dark:text-amber-400 hover:text-white hover:bg-amber-600 border-amber-500/30"
                                              : "text-emerald-600 dark:text-emerald-400 hover:text-white hover:bg-emerald-600 border-emerald-500/30"
                                          }`}
                                          title={
                                            isAssinada
                                              ? "Substituir arquivo assinado desta carta"
                                              : "Anexar arquivo assinado pela rede"
                                          }
                                        >
                                          <RefreshCw className="w-3 h-3" />
                                          {isAssinada ? "Trocar Assinada" : "Anexar Assinada"}
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => onEmitirCarta(r.codigo_matriz, competenciaSelecionada)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:text-white hover:bg-rose-600 rounded-lg border border-rose-500/30 transition-colors shadow-sm"
                                      title="Emitir Carta de Anuência para esta rede"
                                    >
                                      <FilePlus className="w-3 h-3" />
                                      Emitir Carta
                                    </button>
                                  )}

                                  {/* Excluir do Farol (Apenas Admin) */}
                                  {resumo?.is_admin && (
                                    <button
                                      onClick={() => {
                                        setRedeParaExcluir(r);
                                        setMotivoExclusao("");
                                        setModalExcluirOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:text-white hover:bg-rose-600 rounded-lg border border-rose-500/20 transition-colors"
                                      title="Excluir esta rede do Farol (Apenas Admin)"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Excluir
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Excluir Rede do Farol (Apenas Admin) */}
      {modalExcluirOpen && redeParaExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card w-full max-w-lg rounded-3xl border border-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base">Excluir Rede do Farol</h3>
              </div>
              <button
                onClick={() => setModalExcluirOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-muted/40 rounded-2xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Rede:</span>
                <span className="font-bold text-foreground">{redeParaExcluir.rede}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Gerente Responsável:</span>
                <span className="font-bold text-foreground">{redeParaExcluir.manager}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Cód. Matriz:</span>
                <span className="font-mono text-foreground">{redeParaExcluir.codigo_matriz}</span>
              </div>
              {redeParaExcluir.faturamento_medio_3m ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium">Faturamento Médio 3M:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatarMoeda(redeParaExcluir.faturamento_medio_3m)}/mês
                  </span>
                </div>
              ) : null}
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
              <strong>Atenção:</strong> A exclusão afeta apenas a participação desta rede no universo do Farol (deixa de ser esperada e de contar como faltante). Nenhuma Carta existente, faturamento histórico ou cadastro em Clientes será alterado.
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Motivo da Exclusão <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={motivoExclusao}
                onChange={(e) => setMotivoExclusao(e.target.value)}
                placeholder="Informe a justificativa administrativa para exclusão desta rede do Farol..."
                rows={3}
                className="w-full p-3 text-xs bg-muted/40 rounded-xl border border-border focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => setModalExcluirOpen(false)}
                disabled={salvandoExclusao}
                className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarExclusao}
                disabled={salvandoExclusao || !motivoExclusao.trim()}
                className="px-4 py-2 text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors"
              >
                {salvandoExclusao ? "Salvando..." : "Confirmar Exclusão"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Incluir Rede no Farol (Apenas Admin) */}
      {modalIncluirOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card w-full max-w-xl rounded-3xl border border-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-primary font-bold">
                <Plus className="w-5 h-5" />
                <h3 className="text-base">Incluir Rede no Farol</h3>
              </div>
              <button
                onClick={() => setModalIncluirOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-muted/40 text-[11px] text-muted-foreground leading-relaxed">
              Busque uma operação existente no módulo Clientes (<code>cm_clientes</code>). Operações classificadas oficialmente como <strong>Distribuidor</strong> não podem ser incluídas no Farol.
            </div>

            {/* Campo de Busca */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por rede, gerente ou código da matriz..."
                value={buscaClientesInclusao}
                onChange={(e) => {
                  setBuscaClientesInclusao(e.target.value);
                  carregarClientesParaInclusao(e.target.value);
                }}
                className="w-full pl-9 pr-3 py-2 text-xs bg-muted/40 rounded-xl border border-border focus:border-primary focus:outline-none"
              />
            </div>

            {/* Lista de Clientes */}
            <div className="max-h-48 overflow-y-auto border border-border/60 rounded-xl divide-y divide-border/40">
              {carregandoClientes ? (
                <div className="p-4 text-center text-xs text-muted-foreground">Buscando operações...</div>
              ) : clientesDisponiveis.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">Nenhuma operação encontrada.</div>
              ) : (
                clientesDisponiveis.map((c) => {
                  const isSelected =
                    clienteSelecionadoParaInclusao?.codigo_matriz === c.codigo_matriz &&
                    clienteSelecionadoParaInclusao?.gerente === c.gerente;

                  return (
                    <div
                      key={`${c.gerente}-${c.rede_nome}-${c.codigo_matriz}`}
                      onClick={() => setClienteSelecionadoParaInclusao(c)}
                      className={`p-2.5 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected ? "bg-primary/10 border-l-4 border-primary" : "hover:bg-muted/40"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-foreground">{c.rede_nome}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span>Gerente: {c.gerente}</span>
                          <span>•</span>
                          <span>Cód: {c.codigo_matriz}</span>
                          {c.regional && (
                            <>
                              <span>•</span>
                              <span>{c.regional}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                        {c.canal}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {clienteSelecionadoParaInclusao && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Observação / Justificativa (opcional)
                </label>
                <textarea
                  value={observacaoInclusao}
                  onChange={(e) => setObservacaoInclusao(e.target.value)}
                  placeholder="Justificativa da inclusão manual..."
                  rows={2}
                  className="w-full p-2.5 text-xs bg-muted/40 rounded-xl border border-border focus:border-primary focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => setModalIncluirOpen(false)}
                disabled={salvandoInclusao}
                className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarInclusao}
                disabled={salvandoInclusao || !clienteSelecionadoParaInclusao}
                className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-xl shadow-sm transition-colors"
              >
                {salvandoInclusao ? "Incluindo..." : "Confirmar Inclusão"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Gerenciar Overrides / Ajustes do Farol (Apenas Admin) */}
      {modalOverridesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card w-full max-w-2xl rounded-3xl border border-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-foreground font-bold">
                <Settings className="w-5 h-5 text-primary" />
                <h3 className="text-base">Ajustes Administrativos do Farol</h3>
              </div>
              <button
                onClick={() => setModalOverridesOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Histórico de inclusões e exclusões de redes no Farol Executivo Gerencial. Você pode restaurar qualquer operação ao comportamento oficial clicando em "Reativar".
            </p>

            <div className="max-h-80 overflow-y-auto border border-border/60 rounded-2xl divide-y divide-border/40">
              {carregandoOverrides ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Carregando ajustes...</div>
              ) : overridesList.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Nenhum ajuste administrativo registrado.</div>
              ) : (
                overridesList.map((ov) => (
                  <div key={ov.id} className="p-3 text-xs flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            ov.tipo_acao === "EXCLUSAO"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {ov.tipo_acao}
                        </span>
                        <span className="font-bold text-foreground">{ov.rede_nome}</span>
                        <span className="text-muted-foreground font-mono text-[11px]">({ov.codigo_matriz})</span>
                        {!ov.is_ativo && (
                          <span className="text-[10px] text-muted-foreground italic">(Inativo)</span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Gerente: <strong>{ov.gerente}</strong> • Por: {ov.usuario_nome || ov.usuario_email || "Admin"} • Motivo: {ov.motivo || "—"}
                      </div>
                    </div>

                    <div>
                      {ov.is_ativo ? (
                        <button
                          onClick={() => handleReativarOverride(ov.id, ov.rede_nome)}
                          className="px-2.5 py-1 text-[11px] font-bold text-primary border border-primary/30 hover:bg-primary hover:text-primary-foreground rounded-lg transition-colors"
                        >
                          Restaurar
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Desativado</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <button
                onClick={() => setModalOverridesOpen(false)}
                className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

