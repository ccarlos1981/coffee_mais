import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { AnalyticsEngine, parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";
import { OpportunityRecommendationService, OpportunityRecommendation } from "@/lib/services/opportunity-recommendation-service";
import { CommercialDomainService } from "@/lib/domain";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { searchParams } = new URL(request.url);
    const filters = parseAnalyticsFiltersFromParams(searchParams);

    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const riskFilter = searchParams.get("risk") || "ALL";
    const sortBy = (searchParams.get("sortBy") || "scoreOportunidade") as keyof OpportunityRecommendation;
    const sortDir = (searchParams.get("sortDir") || "desc") as "asc" | "desc";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));

    // 1. Provedor de Dados Analíticos (AnalyticsEngine SSOT)
    const crmData = await AnalyticsEngine.getCrmComercial(filters);

    // 2. Mapear dados analíticos brutos obtidos da AnalyticsEngine (sem valores sintéticos/fictícios)
    const rawList = crmData.oportunidades.map((op: any) => ({
      clienteId: op.clienteId,
      nomeParceiro: op.clienteNome,
      cnpj: op.cnpj || "",
      rede: op.matrizNome || null,
      gerenteNome: op.gerenteNome || "",
      canal: op.canal || "",
      uf: op.uf || "",
      diasSemComprar: Number(op.diasSemComprar) || 0,
      dataUltimaCompra: op.dataUltimaCompra || null,
      valorUltimaCompra: Number(op.valorUltimaCompra) || Number(op.valorImpactoPotencial) || 0,
      valorFaturadoPeriodo: Number(op.valorImpactoPotencial) || 0,
      valorFaturado12m: Number(op.valorFaturado12m) || Number(op.valorImpactoPotencial) || 0,
      frequenciaHistoricaDias: Number(op.frequenciaHistoricaDias) || 0,
    }));

    // 3. Processar Lógica Prescritiva no OpportunityRecommendationService Desacoplado
    const recommendations = OpportunityRecommendationService.processRecommendations(rawList);

    // 4. Filtragem e Pesquisa no Backend
    const filtered = recommendations.filter((rec) => {
      const matchSearch =
        !search ||
        rec.nomeParceiro.toLowerCase().includes(search) ||
        rec.gerenteNome.toLowerCase().includes(search) ||
        rec.canal.toLowerCase().includes(search) ||
        rec.uf.toLowerCase().includes(search);

      const matchRisk = riskFilter === "ALL" || rec.classificacaoRisco === riskFilter;

      return matchSearch && matchRisk;
    });

    // 5. Ordenação no Backend
    filtered.sort((a, b) => {
      const valA = a[sortBy] ?? 0;
      const valB = b[sortBy] ?? 0;
      if (typeof valA === "number" && typeof valB === "number") {
        return sortDir === "desc" ? valB - valA : valA - valB;
      }
      return sortDir === "desc"
        ? String(valB).localeCompare(String(valA))
        : String(valA).localeCompare(String(valB));
    });

    // 6. Resumo Executivo Unificado (KPI Cards alinhados sem divergência com a Grid)
    const totalReceitaRepresada = filtered.reduce((acc, r) => acc + r.faturamentoPerdidoEstimado, 0);
    const clientesAtrasoCritico = filtered.filter((r) => r.classificacaoRisco === "CRITICO").length;
    const clientesEmRisco = filtered.filter((r) => r.classificacaoRisco === "ALTO").length;
    const totalImpacto = filtered.reduce((acc, r) => acc + r.impactoFinanceiroTotal, 0);
    const ticketMedioReposicao = filtered.length > 0 ? Math.round(totalImpacto / filtered.length) : 0;

    // 7. Paginação no Backend
    const totalRecords = filtered.length;
    const totalPages = Math.ceil(totalRecords / limit);
    const startIndex = (page - 1) * limit;
    const paginatedItems = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      resumoExecutivo: {
        totalReceitaRepresada,
        clientesAtrasoCritico,
        clientesEmRisco,
        ticketMedioReposicao,
        totalOportunidades: totalRecords,
      },
      oportunidades: paginatedItems,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
      },
      // Opções de Filtro Oficiais do Domínio Comercial
      filterOptions: CommercialDomainService.getFilterOptions(),
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
