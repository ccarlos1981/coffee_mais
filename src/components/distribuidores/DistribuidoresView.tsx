"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  OFFICIAL_COMMERCIAL_ROLES,
  getDrilldownLabel,
  isDistributorClient
} from "@/lib/domain/commercial-structure";
import { ExportButton } from "@/components/ExportButton";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  DollarSign,
  Search,
  Building2,
  ChevronRight,
  ChevronDown,
  MapPin,
  RefreshCw,
  Filter,
  Calendar,
  ShieldCheck
} from "lucide-react";
import { DistribuidoresRedeDrawer } from "./DistribuidoresRedeDrawer";
import { NewFollowUpModal, FollowUpInitialContext } from "@/app/processo-comercial/follow-up/components/NewFollowUpModal";

interface DistributorClient {
  cod_parceiro?: string;
  client: string;
  rede?: string;
  nome_parceiro?: string;
  uf?: string;
  cidade?: string;
  fat: number;
  qty: number;
  maco: number;
  prevMonthFat?: number;
  prevYearFat?: number;
}

interface DistributorRow {
  key: string;
  managerId: string;
  managerName: string;
  role: string;
  label: string;
  distributorName: string;
  fat: number;
  qty: number;
  maco: number;
  macoPercent: number;
  prevFat: number;
  growthPercent: number;
  topClients: DistributorClient[];
}

export default function DistribuidoresView() {
  const [startMonth, setStartMonth] = useState("2026-01");
  const [endMonth, setEndMonth] = useState("2026-07");
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DistributorRow[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Wave B.19: Distribuidores 360° Drawer & Follow-Up State
  const [selectedDistributor360, setSelectedDistributor360] = useState<any | null>(null);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpInitialContext, setFollowUpInitialContext] = useState<FollowUpInitialContext | null>(null);
  const [followUpToast, setFollowUpToast] = useState<string | null>(null);

  // Carregar dados da AnalyticsEngine
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          startMonth,
          endMonth,
        });

        const res = await fetch(`/api/dashboard/matriz?${queryParams.toString()}`);
        if (!res.ok) throw new Error("Falha ao carregar dados de distribuição");
        const data = await res.json();

        const distRoles = OFFICIAL_COMMERCIAL_ROLES.filter(r => r.role === "DIST");
        const parsedRows: DistributorRow[] = [];

        for (const distRole of distRoles) {
          const matchDef = distRole.match || { partnerCodes: [], matrizCodes: [], cnpjs: [], aliases: [] };

          const rawClients: any[] = data.rowsCurClient || data.matrizes || [];
          const matchedClients: DistributorClient[] = rawClients
            .filter((c: any) => {
              const codeMatch = c.cod_parceiro && matchDef.partnerCodes.includes(String(c.cod_parceiro));
              const nameMatch = isDistributorClient(
                { rede: c.rede, nome_parceiro: c.nome_parceiro || c.client, client: c.client, cod_parceiro: c.cod_parceiro, channel: c.channel },
                distRole.managerId
              );
              return codeMatch || nameMatch;
            })
            .map((c: any) => ({
              cod_parceiro: c.cod_parceiro || c.codigo || "",
              client: c.client || c.nome_parceiro || c.rede || "PDV Não Identificado",
              rede: c.rede || c.client || "",
              nome_parceiro: c.nome_parceiro || c.client || "",
              uf: c.uf || "SP",
              cidade: c.cidade || c.municipio || "São Paulo",
              fat: Number(c.fat) || 0,
              qty: Number(c.qty) || 0,
              maco: Number(c.maco) || 0,
              prevMonthFat: Number(c.prevMonthFat || c.fat_anterior) || 0,
              prevYearFat: Number(c.prevYearFat || c.fat_ano_anterior) || 0
            }));

          const totalFat = matchedClients.reduce((acc, c) => acc + c.fat, 0);
          const totalQty = matchedClients.reduce((acc, c) => acc + c.qty, 0);
          const totalMaco = matchedClients.reduce((acc, c) => acc + c.maco, 0);
          const macoPercent = totalFat > 0 ? (totalMaco / totalFat) * 100 : 0;
          const prevFat = matchedClients.reduce((acc, c) => acc + (c.prevMonthFat || 0), 0);
          const growthPercent = prevFat > 0 ? ((totalFat - prevFat) / prevFat) * 100 : 0;

          const primaryName = matchDef.aliases[0] || distRole.label.replace(" (Dist)", "");

          parsedRows.push({
            key: distRole.id,
            managerId: distRole.managerId,
            managerName: distRole.managerName,
            role: distRole.role,
            label: distRole.label,
            distributorName: primaryName,
            fat: totalFat,
            qty: totalQty,
            maco: totalMaco,
            macoPercent,
            prevFat,
            growthPercent,
            topClients: matchedClients.sort((a, b) => b.fat - a.fat)
          });
        }

        setRows(parsedRows.sort((a, b) => b.fat - a.fat));
      } catch (err) {
        console.error("Erro ao carregar Gestão de Distribuidores:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [startMonth, endMonth]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (selectedRoleKey !== "all" && r.key !== selectedRoleKey && r.managerId !== selectedRoleKey) {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = r.distributorName.toLowerCase().includes(query);
        const matchesManager = r.managerName.toLowerCase().includes(query);
        const matchesClient = r.topClients.some(c =>
          c.client.toLowerCase().includes(query) || (c.cod_parceiro && c.cod_parceiro.includes(query))
        );
        return matchesName || matchesManager || matchesClient;
      }
      return true;
    });
  }, [rows, selectedRoleKey, searchTerm]);

  const totals = useMemo(() => {
    const totalFat = filteredRows.reduce((a, r) => a + r.fat, 0);
    const totalQty = filteredRows.reduce((a, r) => a + r.qty, 0);
    const totalMaco = filteredRows.reduce((a, r) => a + r.maco, 0);
    const totalPrev = filteredRows.reduce((a, r) => a + r.prevFat, 0);
    const macoPercent = totalFat > 0 ? (totalMaco / totalFat) * 100 : 0;
    const growthPercent = totalPrev > 0 ? ((totalFat - totalPrev) / totalPrev) * 100 : 0;
    const activeCount = filteredRows.filter(r => r.fat > 0).length;
    const totalPdvs = filteredRows.reduce((a, r) => a + r.topClients.length, 0);

    return {
      fat: totalFat,
      qty: totalQty,
      maco: totalMaco,
      macoPercent,
      growthPercent,
      activeCount,
      totalPdvs
    };
  }, [filteredRows]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage]);

  const toggleRowExpand = (key: string) => {
    setExpandedRows(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1400, margin: "0 auto", color: "var(--foreground)" }}>
      {/* CABEÇALHO */}
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ fontSize: "0.85rem", color: "var(--foreground-dim)", marginBottom: 4 }}>
            Análise &gt; Gestão de Distribuidores
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, color: "var(--foreground)" }}>
            Gestão de Distribuidores
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--foreground-dim)", margin: 0 }}>
            Visão 360º de faturamento, metas, margem MACO e cobertura por distribuidor
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          {/* PERÍODO DE MESES */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--card-bg)", padding: "0.4rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color)" }}>
            <Calendar size={16} style={{ color: "var(--foreground-dim)" }} />
            <input
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              style={{ background: "transparent", border: "none", color: "var(--foreground)", fontSize: "0.85rem" }}
            />
            <span style={{ color: "var(--foreground-dim)" }}>até</span>
            <input
              type="month"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              style={{ background: "transparent", border: "none", color: "var(--foreground)", fontSize: "0.85rem" }}
            />
          </div>

          <ExportButton
            data={filteredRows.map(r => ({
              Distribuidor: r.distributorName,
              Gerente: r.managerName,
              Role: r.role,
              "Faturamento (R$)": r.fat,
              "Volume (UN)": r.qty,
              "MACO (R$)": r.maco,
              "MACO (%)": r.macoPercent,
              "PDVs Atendidos": r.topClients.length
            }))}
            filename="gestao_distribuidores"
          />
        </div>
      </div>

      {/* FILTROS E PESQUISA */}
      <div className="glass-card" style={{ padding: "1rem", borderRadius: 12, marginBottom: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 260 }}>
          <Search size={18} style={{ color: "var(--foreground-dim)" }} />
          <input
            type="text"
            placeholder="Buscar distribuidor, gerente, código parceiro ou PDV..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: "100%",
              background: "transparent",
              border: "1px solid var(--border-color)",
              padding: "0.5rem 0.75rem",
              borderRadius: 8,
              color: "var(--foreground)",
              fontSize: "0.875rem"
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Filter size={16} style={{ color: "var(--foreground-dim)" }} />
          <select
            value={selectedRoleKey}
            onChange={(e) => {
              setSelectedRoleKey(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border-color)",
              padding: "0.5rem 0.75rem",
              borderRadius: 8,
              color: "var(--foreground)",
              fontSize: "0.875rem"
            }}
          >
            <option value="all">Todos os Gerentes (Dist)</option>
            {OFFICIAL_COMMERCIAL_ROLES.filter(r => r.role === "DIST").map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* BLOCO DE KPIS EXECUTIVOS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {/* KPI 1: Faturamento */}
        <div className="glass-card" style={{ padding: "1.25rem", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--foreground-dim)", fontSize: "0.8rem", marginBottom: 8 }}>
            <span>Faturamento Líquido</span>
            <DollarSign size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--foreground)" }}>
            {formatCurrency(totals.fat)}
          </div>
          <div style={{ fontSize: "0.75rem", color: totals.growthPercent >= 0 ? "#10b981" : "#ef4444", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
            {totals.growthPercent >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{totals.growthPercent >= 0 ? "+" : ""}{totals.growthPercent.toFixed(1)}% vs Mês Anterior</span>
          </div>
        </div>

        {/* KPI 2: Volume */}
        <div className="glass-card" style={{ padding: "1.25rem", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--foreground-dim)", fontSize: "0.8rem", marginBottom: 8 }}>
            <span>Volume Físico</span>
            <Package size={18} style={{ color: "#3b82f6" }} />
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--foreground)" }}>
            {formatNumber(totals.qty)} un
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--foreground-dim)", marginTop: 4 }}>
            Média {totals.qty > 0 ? (totals.fat / totals.qty).toFixed(2) : "0,00"} R$/un
          </div>
        </div>

        {/* KPI 3: MACO */}
        <div className="glass-card" style={{ padding: "1.25rem", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--foreground-dim)", fontSize: "0.8rem", marginBottom: 8 }}>
            <span>Margem MACO</span>
            <TrendingUp size={18} style={{ color: "#10b981" }} />
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--foreground)" }}>
            {formatCurrency(totals.maco)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#10b981", marginTop: 4, fontWeight: 600 }}>
            {totals.macoPercent.toFixed(1)}% sobre faturamento
          </div>
        </div>

        {/* KPI 4: Distribuidores Ativos */}
        <div className="glass-card" style={{ padding: "1.25rem", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--foreground-dim)", fontSize: "0.8rem", marginBottom: 8 }}>
            <span>Distribuidores Ativos</span>
            <Building2 size={18} style={{ color: "#8b5cf6" }} />
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--foreground)" }}>
            {totals.activeCount}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--foreground-dim)", marginTop: 4 }}>
            Operações em Distribuição
          </div>
        </div>

        {/* KPI 5: Alcance & PDVs */}
        <div className="glass-card" style={{ padding: "1.25rem", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--foreground-dim)", fontSize: "0.8rem", marginBottom: 8 }}>
            <span>PDVs Positivados</span>
            <Users size={18} style={{ color: "#f59e0b" }} />
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--foreground)" }}>
            {totals.totalPdvs} PDVs
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--foreground-dim)", marginTop: 4 }}>
            Alcance de Venda Indireta
          </div>
        </div>
      </div>

      {/* TABELA PRINCIPAL DE PERFORMANCE E DRILLDOWN DE 4 NÍVEIS */}
      <div className="glass-card" style={{ borderRadius: 12, overflow: "hidden", marginBottom: "1.5rem" }}>
        <div style={{ padding: "1.25rem", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>Performance por Distribuidor</h3>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--foreground-dim)" }}>
              Hierarquia: Gerente (Dist) ➔ Distribuidor ➔ Carteira / Rede ➔ PDV Final (Cidade/UF)
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--foreground-dim)" }}>
            <RefreshCw size={24} className="animate-spin" style={{ marginBottom: 8 }} />
            <p>Carregando indicadores de distribuição...</p>
          </div>
        ) : paginatedRows.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--foreground-dim)" }}>
            Sem vendas de distribuidor registradas para os filtros selecionados.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--border-color)", color: "var(--foreground-dim)" }}>
                  <th style={{ padding: "0.75rem 1rem", width: 40 }}>#</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Gerente / Distribuidor</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Role</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Faturamento</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Volume (UN)</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>MACO (R$)</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>MACO (%)</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>PDVs</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, index) => {
                  const isExpanded = !!expandedRows[row.key];
                  return (
                    <React.Fragment key={row.key}>
                      {/* NÍVEL 1 & 2: GERENTE E DISTRIBUIDOR */}
                      <tr
                        onClick={() => toggleRowExpand(row.key)}
                        style={{
                          borderBottom: "1px solid var(--border-color)",
                          cursor: "pointer",
                          background: isExpanded ? "rgba(255,255,255,0.05)" : "transparent"
                        }}
                      >
                        <td style={{ padding: "1rem" }}>
                          {(currentPage - 1) * pageSize + index + 1}
                        </td>
                        <td style={{ padding: "1rem" }}>
                          <div style={{ fontWeight: 600, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 8 }}>
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <Building2 size={16} style={{ color: "var(--accent)" }} />
                            <span>{row.distributorName}</span>
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--foreground-dim)", paddingLeft: 24 }}>
                            Gerente Responsável: {row.managerName}
                          </div>
                        </td>
                        <td style={{ padding: "1rem" }}>
                          <span style={{
                            background: "rgba(59, 130, 246, 0.15)",
                            color: "#60a5fa",
                            padding: "0.2rem 0.5rem",
                            borderRadius: 4,
                            fontSize: "0.75rem",
                            fontWeight: 600
                          }}>
                            {row.role}
                          </span>
                        </td>
                        <td style={{ padding: "1rem", textAlign: "right", fontWeight: 600 }}>
                          {formatCurrency(row.fat)}
                        </td>
                        <td style={{ padding: "1rem", textAlign: "right" }}>
                          {formatNumber(row.qty)}
                        </td>
                        <td style={{ padding: "1rem", textAlign: "right", color: "#10b981" }}>
                          {formatCurrency(row.maco)}
                        </td>
                        <td style={{ padding: "1rem", textAlign: "right", color: "#10b981", fontWeight: 600 }}>
                          {row.macoPercent.toFixed(1)}%
                        </td>
                        <td style={{ padding: "1rem", textAlign: "center" }}>
                          {row.topClients.length}
                        </td>
                        <td style={{ padding: "1rem", textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDistributor360({
                                  distribuidorNome: row.distributorName,
                                  distribuidorId: row.managerId,
                                  codigoMatriz: row.key,
                                  gerenteNome: row.managerName,
                                  uf: null,
                                  cidade: null,
                                  faturamentoReal: row.fat,
                                  volumeReal: row.qty,
                                  maco: row.maco,
                                  macoPct: row.macoPercent,
                                  pdvsAtendidos: row.topClients.length,
                                  dataStr: `${startMonth} até ${endMonth}`,
                                });
                              }}
                              className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                              title="Diagnóstico 360° do Distribuidor"
                            >
                              <ShieldCheck className="w-3 h-3 text-amber-500" />
                              <span>360°</span>
                            </button>
                            <span style={{ color: "var(--accent)", fontSize: "0.8rem" }}>
                              {isExpanded ? "Ocultar" : "Ver Detalhes"}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* DRILLDOWN: NÍVEL 3 & 4 (CARTEIRA E PDVS DESTE DISTRIBUIDOR) */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} style={{ padding: "1rem 1.5rem", background: "rgba(0,0,0,0.2)" }}>
                            <div style={{
                              fontSize: "0.8rem",
                              color: "var(--accent)",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              marginBottom: 12,
                              display: "flex",
                              alignItems: "center",
                              gap: 6
                            }}>
                              <MapPin size={14} />
                              <span>{getDrilldownLabel("DIST", row.distributorName)} — Carteira de PDVs e Redes Atendidas</span>
                            </div>

                            {row.topClients.length === 0 ? (
                              <div style={{ fontSize: "0.8rem", color: "var(--foreground-dim)" }}>
                                Sem detalhamento de PDV individual para este distribuidor no período.
                              </div>
                            ) : (
                              <div style={{ maxHeight: 300, overflowY: "auto", borderRadius: 8, border: "1px solid var(--border-color)" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                                  <thead>
                                    <tr style={{ background: "rgba(255,255,255,0.05)", color: "var(--foreground-dim)" }}>
                                      <th style={{ padding: "0.5rem 0.75rem", width: 30 }}>#</th>
                                      <th style={{ padding: "0.5rem 0.75rem" }}>PDV / Cliente Faturado</th>
                                      <th style={{ padding: "0.5rem 0.75rem" }}>Cód. Parceiro</th>
                                      <th style={{ padding: "0.5rem 0.75rem" }}>Cidade / UF</th>
                                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Faturamento</th>
                                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Volume (UN)</th>
                                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>MACO</th>
                                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>360°</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.topClients.map((client, cIdx) => (
                                      <tr key={cIdx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                        <td style={{ padding: "0.5rem 0.75rem", color: "var(--foreground-dim)" }}>{cIdx + 1}</td>
                                        <td style={{ padding: "0.5rem 0.75rem", fontWeight: 500 }}>{client.client}</td>
                                        <td style={{ padding: "0.5rem 0.75rem", color: "var(--foreground-dim)" }}>{client.cod_parceiro || "—"}</td>
                                        <td style={{ padding: "0.5rem 0.75rem", color: "var(--foreground-dim)" }}>
                                          {client.cidade} / {client.uf}
                                        </td>
                                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 600 }}>{formatCurrency(client.fat)}</td>
                                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>{formatNumber(client.qty)}</td>
                                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "#10b981" }}>{formatCurrency(client.maco)}</td>
                                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedDistributor360({
                                                distribuidorNome: `${client.client} (${row.distributorName})`,
                                                distribuidorId: client.cod_parceiro || null,
                                                codigoMatriz: client.cod_parceiro || null,
                                                gerenteNome: row.managerName,
                                                uf: client.uf || null,
                                                cidade: client.cidade || null,
                                                faturamentoReal: client.fat,
                                                volumeReal: client.qty,
                                                maco: client.maco,
                                                macoPct: client.fat > 0 ? (client.maco / client.fat) * 100 : 0,
                                                pdvsAtendidos: 1,
                                                dataStr: `${startMonth} até ${endMonth}`,
                                              });
                                            }}
                                            className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                            title="Diagnóstico 360° do Cliente / PDV"
                                          >
                                            <ShieldCheck className="w-2.5 h-2.5 text-amber-500" />
                                            <span>360°</span>
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* CONTROLES DE PAGINAÇÃO DE ESCALABILIDADE */}
        {filteredRows.length > pageSize && (
          <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem" }}>
            <span style={{ color: "var(--foreground-dim)" }}>
              Exibindo {(currentPage - 1) * pageSize + 1} até {Math.min(currentPage * pageSize, filteredRows.length)} de {filteredRows.length} distribuidores
            </span>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border-color)",
                  padding: "0.4rem 0.75rem",
                  borderRadius: 6,
                  color: currentPage === 1 ? "var(--foreground-dim)" : "var(--foreground)",
                  cursor: currentPage === 1 ? "not-allowed" : "pointer"
                }}
              >
                Anterior
              </button>
              <span style={{ padding: "0.4rem 0.75rem" }}>Página {currentPage} de {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border-color)",
                  padding: "0.4rem 0.75rem",
                  borderRadius: 6,
                  color: currentPage === totalPages ? "var(--foreground-dim)" : "var(--foreground)",
                  cursor: currentPage === totalPages ? "not-allowed" : "pointer"
                }}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Drawer Distribuidores 360° (Wave B.19) ── */}
      {selectedDistributor360 && (
        <DistribuidoresRedeDrawer
          isOpen={Boolean(selectedDistributor360)}
          onClose={() => setSelectedDistributor360(null)}
          context={selectedDistributor360}
          onOpenFollowUp={(ctx) => {
            setFollowUpInitialContext(ctx);
            setIsFollowUpModalOpen(true);
          }}
        />
      )}

      {/* ── Modal Canônica de Criação de Follow-up (Wave B.12) ── */}
      {isFollowUpModalOpen && (
        <NewFollowUpModal
          isOpen={isFollowUpModalOpen}
          onClose={() => setIsFollowUpModalOpen(false)}
          onCreated={() => {
            setIsFollowUpModalOpen(false);
            setFollowUpToast("Ação de Follow-up (Distribuição) registrada com sucesso!");
            setTimeout(() => setFollowUpToast(null), 4000);
          }}
          initialContext={followUpInitialContext}
        />
      )}

      {/* ── Toast Feedback ── */}
      {followUpToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-emerald-500/90 text-white font-bold text-xs shadow-2xl animate-in slide-in-from-bottom-5 duration-200">
          {followUpToast}
        </div>
      )}
    </div>
  );
}
