"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, Target, ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react";
import { CrmComercialData } from "@/lib/governance/analytics/engine";
import { OpportunityRecommendation, OpportunityRecommendationService } from "@/lib/services/opportunity-recommendation-service";
import { CrmFilterBar, CrmFiltersState } from "./components/CrmFilterBar";
import { CrmResumoExecutivo } from "./components/CrmResumoExecutivo";
import { CrmRecomendacoes } from "./components/CrmRecomendacoes";
import { CrmScoreCard } from "./components/CrmScoreCard";
import { CrmOportunidadesGrid } from "./components/CrmOportunidadesGrid";
import { CrmClienteDrawer } from "./components/CrmClienteDrawer";

export default function CrmComercialPage() {
  const defaultFilters: CrmFiltersState = {
    startMonth: "2026-06",
    endMonth: "2026-06",
    manager: "all",
    uf: "all",
    channel: "all",
    matriz: "all",
  };

  const [filters, setFilters] = useState<CrmFiltersState>(defaultFilters);
  const [crmData, setCrmData] = useState<CrmComercialData | null>(null);
  const [selectedOportunidade, setSelectedOportunidade] = useState<OpportunityRecommendation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCrmData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.startMonth) params.set("startMonth", filters.startMonth);
      if (filters.endMonth) params.set("endMonth", filters.endMonth);
      if (filters.manager && filters.manager !== "all") params.set("manager", filters.manager);
      if (filters.uf && filters.uf !== "all") params.set("uf", filters.uf);
      if (filters.channel && filters.channel !== "all") params.set("channel", filters.channel);
      if (filters.matriz && filters.matriz !== "all") params.set("matriz", filters.matriz);

      const res = await fetch(`/api/inovacoes/crm?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Erro na requisição (${res.status})`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Falha ao carregar dados do CRM Comercial.");
      }

      // Se a API retornar oportunidades processadas pelo OpportunityRecommendationService
      if (json.oportunidades) {
        setCrmData({
          resumo: json.resumoExecutivo || {
            totalClientesCarteira: json.oportunidades.length,
            totalClientesAtivos: json.oportunidades.length,
            totalClientesEmRisco: 0,
            totalClientesInativos: 0,
            potencialRecuperacaoMaco: json.resumoExecutivo?.totalReceitaRepresada || 0,
            scoreSaudeGlobal: 85,
          },
          oportunidades: json.oportunidades.map((op: any) => ({
            id: op.clienteId,
            clienteId: op.clienteId,
            clienteNome: op.nomeParceiro,
            matrizNome: op.rede || "Cliente Direto",
            gerenteNome: op.gerenteNome,
            canal: op.canal,
            uf: op.uf,
            tipoRecomendacao: op.classificacaoRisco,
            titulo: `Oportunidade Comercial: ${op.nomeParceiro}`,
            descricao: op.justificativaRecomendacao,
            prioridade: op.classificacaoRisco === "CRITICO" ? "ALTA" : op.classificacaoRisco === "ALTO" ? "MEDIA" : "BAIXA",
            scoreImpacto: op.scoreOportunidade,
            valorImpactoPotencial: op.faturamentoPerdidoEstimado,
            margemMacoAtual: 24.5,
            diasSemComprar: op.diasSemCompra,
            _rawRecommendation: op,
          })),
          rankingGerentesScore: [],
        });
      } else {
        setCrmData(json.data);
      }
    } catch (err: any) {
      console.error("Erro ao carregar CRM Comercial:", err);
      setError(err.message || "Erro de conexão com a API do CRM Comercial.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCrmData();
  }, [fetchCrmData]);

  const handleResetFilters = () => {
    setFilters(defaultFilters);
  };

  const handleSelectOportunidade = (op: any) => {
    if (op._rawRecommendation) {
      setSelectedOportunidade(op._rawRecommendation);
    } else {
      const recommendations = OpportunityRecommendationService.processRecommendations([
        {
          clienteId: op.clienteId || op.id,
          nomeParceiro: op.clienteNome,
          rede: op.matrizNome,
          gerenteNome: op.gerenteNome,
          canal: op.canal,
          uf: op.uf,
          diasSemComprar: op.diasSemComprar,
          valorFaturadoPeriodo: op.valorImpactoPotencial,
          valorFaturado12m: op.valorImpactoPotencial * 4,
          frequenciaHistoricaDias: 20,
        },
      ]);
      setSelectedOportunidade(recommendations[0]);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Cabeçalho Executivo & Governança */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-gold" />
            <Link href="/inovacoes/cockpit" className="hover:text-foreground transition-colors">
              Inovações
            </Link>
            <ChevronRight className="w-3 h-3 text-gold" />
            <span className="text-foreground font-semibold">CRM Comercial</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gold/10 text-gold border border-gold/20 shadow-sm">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                CRM Comercial — Central de Decisão & Inteligência Prescritiva
              </h1>
              <p className="text-xs text-muted-foreground">
                Recomendações de Ação Comercial Priorizadas pelo Score Oficial (0 a 100)
              </p>
            </div>
          </div>
        </div>

        {/* Badge de Governança Financeira */}
        <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-2xl text-xs shadow-sm self-start md:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="font-mono text-[11px] font-bold text-foreground">
            ANALYTICS_ENGINE_V1 = LOCKED
          </span>
        </div>
      </div>

      {/* 2. Barra de Filtros */}
      <CrmFilterBar
        filters={filters}
        onFilterChange={setFilters}
        onReset={handleResetFilters}
        loading={loading}
      />

      {/* Mensagem de Erro se houver */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchCrmData}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-xl transition-all font-semibold flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* 3. Cards de Resumo Executivo */}
      <CrmResumoExecutivo
        resumo={
          crmData?.resumo || {
            totalClientesCarteira: 0,
            totalClientesAtivos: 0,
            totalClientesEmRisco: 0,
            totalClientesInativos: 0,
            potencialRecuperacaoMaco: 0,
            scoreSaudeGlobal: 0,
          }
        }
        totalOportunidades={crmData?.oportunidades.length || 0}
        loading={loading}
      />

      {/* 4. Top Recomendações Prescritivas */}
      <CrmRecomendacoes
        oportunidades={crmData?.oportunidades || []}
        onSelectOportunidade={handleSelectOportunidade}
        loading={loading}
      />

      {/* 5. Score de Saúde por Gerente */}
      <CrmScoreCard
        rankingGerentesScore={crmData?.rankingGerentesScore || []}
        loading={loading}
      />

      {/* 6. Central de Oportunidades Grid */}
      <CrmOportunidadesGrid
        oportunidades={crmData?.oportunidades || []}
        onSelectOportunidade={handleSelectOportunidade}
        loading={loading}
      />

      {/* 7. Central de Decisão Comercial Drawer (Read-Only) */}
      <CrmClienteDrawer
        oportunidade={selectedOportunidade}
        onClose={() => setSelectedOportunidade(null)}
      />
    </div>
  );
}
