"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { TipoInconsistencia } from "@/lib/governance/constants";

export interface MetricData {
  current_metrics: {
    total_clientes: number;
    sem_responsavel: number;
    sem_uf: number;
    sem_matriz: number;
    total_inconsistencias: number;
    iqc_score: string;
    cobertura_score: string;
    baseline_version: string;
  } | null;
  history: Array<{
    snapshot_date: string;
    iqc_score: string;
    cobertura_score: string;
    baseline_version: string;
    audit_rules_version: string;
  }>;
}

export interface SettingData {
  key: string;
  value: any;
  description: string;
  updated_at: string;
}

export interface InconsistencyData {
  cliente_codigo: number;
  nome_parceiro: string;
  uf: string;
  codigo_matriz: string | null;
  responsavel: string | null;
  tipo_inconsistencia: TipoInconsistencia;
}

export interface Pagination {
  page: number;
  limit: number;
  total_records: number;
  total_pages: number;
}

export interface RequestData {
  id: string;
  cliente_codigo: number;
  uf_proposta: string | null;
  codigo_matriz_proposto: string | null;
  responsavel_proposto: string | null;
  justificativa: string;
  status: "RASCUNHO" | "PENDENTE_APROVACAO" | "APROVADO" | "REJEITADO" | "CANCELADO";
  versao: number;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  cm_clientes?: {
    nome_parceiro: string;
    uf: string;
    codigo_matriz: string | null;
    responsavel: string | null;
  } | null;
}

interface QualityContextType {
  metrics: { loading: boolean; error: string | null; data: MetricData | null; refresh: () => Promise<void> };
  settings: {
    loading: boolean;
    error: string | null;
    data: SettingData[] | null;
    refresh: () => Promise<void>;
    updateSetting: (key: string, value: any) => Promise<boolean>;
  };
  inconsistencies: {
    loading: boolean;
    error: string | null;
    data: InconsistencyData[] | null;
    pagination: Pagination | null;
    page: number;
    limit: number;
    search: string;
    tipo: string;
    sortBy: string;
    sortDesc: boolean;
    setPage: (p: number) => void;
    setLimit: (l: number) => void;
    setSearch: (s: string) => void;
    setTipo: (t: string) => void;
    setSorting: (field: string) => void;
    refresh: () => Promise<void>;
  };
  requests: {
    loading: boolean;
    error: string | null;
    data: RequestData[] | null;
    pagination: Pagination | null;
    page: number;
    limit: number;
    search: string;
    status: string;
    setPage: (p: number) => void;
    setLimit: (l: number) => void;
    setSearch: (s: string) => void;
    setStatus: (st: string) => void;
    createRequest: (body: any) => Promise<any>;
    updateRequest: (id: string, body: any) => Promise<boolean>;
    transitionRequest: (id: string, next_status: string, notes?: string) => Promise<boolean>;
    refresh: () => Promise<void>;
  };
}

export const QualityContext = createContext<QualityContextType | null>(null);

export function QualityProvider({ children }: { children: React.ReactNode }) {
  // Metrics State
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsData, setMetricsData] = useState<MetricData | null>(null);

  // Settings State
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsData, setSettingsData] = useState<SettingData[] | null>(null);

  // Inconsistencies State & Filters
  const [inconsLoading, setInconsLoading] = useState(true);
  const [inconsError, setInconsError] = useState<string | null>(null);
  const [inconsistencies, setInconsistencies] = useState<InconsistencyData[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("");
  
  // Sort State
  const [sortBy, setSortBy] = useState("cliente_codigo");
  const [sortDesc, setSortDesc] = useState(false);

  // Requests State
  const [reqsLoading, setReqsLoading] = useState(true);
  const [reqsError, setReqsError] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestData[] | null>(null);
  const [reqsPagination, setReqsPagination] = useState<Pagination | null>(null);

  const [reqPage, setReqPage] = useState(1);
  const [reqLimit, setReqLimit] = useState(20);
  const [reqSearch, setReqSearch] = useState("");
  const [reqStatus, setReqStatus] = useState("");

  // API Call: Metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/governance/quality/metrics");
      if (!res.ok) throw new Error("Erro ao carregar métricas de qualidade.");
      const json = await res.json();
      if (json.success) {
        setMetricsData(json.data);
        setMetricsError(null);
      } else {
        throw new Error(json.errors?.[0]?.message || "Erro desconhecido.");
      }
    } catch (err: any) {
      setMetricsError(err.message || "Falha de comunicação.");
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  // API Call: Settings
  const fetchSettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const res = await fetch("/api/governance/settings");
      if (!res.ok) throw new Error("Erro ao carregar configurações.");
      const json = await res.json();
      if (json.success) {
        setSettingsData(json.data);
        setSettingsError(null);
      } else {
        throw new Error(json.errors?.[0]?.message || "Erro desconhecido.");
      }
    } catch (err: any) {
      setSettingsError(err.message || "Falha de comunicação.");
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // API Call: Update Setting
  const updateSetting = useCallback(async (key: string, value: any): Promise<boolean> => {
    try {
      const res = await fetch("/api/governance/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchSettings();
        await Promise.all([fetchMetrics(), fetchInconsistencies()]);
        return true;
      } else {
        alert(`Erro ao atualizar: ${json.errors?.[0]?.message || "Verifique as permissões."}`);
        return false;
      }
    } catch (err: any) {
      alert(`Falha ao conectar com o servidor: ${err.message}`);
      return false;
    }
  }, [fetchSettings, fetchMetrics]);

  // API Call: Inconsistencies
  const fetchInconsistencies = useCallback(async () => {
    try {
      let url = `/api/governance/quality/inconsistencies?page=${page}&limit=${limit}`;
      if (tipo) url += `&tipo_inconsistencia=${encodeURIComponent(tipo)}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao carregar inconsistências cadastrais.");
      const json = await res.json();
      if (json.success) {
        setInconsistencies(json.data);
        setPagination(json.meta.pagination);
        setInconsError(null);
      } else {
        throw new Error(json.errors?.[0]?.message || "Erro desconhecido.");
      }
    } catch (err: any) {
      setInconsError(err.message || "Falha de comunicação.");
    } finally {
      setInconsLoading(false);
    }
  }, [page, limit, tipo, search]);

  // API Call: Fetch Requests
  const fetchRequests = useCallback(async () => {
    try {
      let url = `/api/governance/requests?page=${reqPage}&limit=${reqLimit}`;
      if (reqStatus) url += `&status=${encodeURIComponent(reqStatus)}`;
      if (reqSearch) url += `&search=${encodeURIComponent(reqSearch)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao carregar solicitações.");
      const json = await res.json();
      if (json.success) {
        setRequests(json.data);
        setReqsPagination(json.meta.pagination);
        setReqsError(null);
      } else {
        throw new Error(json.errors?.[0]?.message || "Erro desconhecido.");
      }
    } catch (err: any) {
      setReqsError(err.message || "Falha de comunicação.");
    } finally {
      setReqsLoading(false);
    }
  }, [reqPage, reqLimit, reqStatus, reqSearch]);

  // API Call: Create Request
  const createRequest = useCallback(async (body: any): Promise<any> => {
    try {
      const res = await fetch("/api/governance/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (json.success) {
        await fetchRequests();
        return json.data;
      } else {
        alert(`Erro ao criar solicitação: ${json.errors?.[0]?.message || "Verifique os dados."}`);
        return null;
      }
    } catch (err: any) {
      alert(`Falha ao conectar com o servidor: ${err.message}`);
      return null;
    }
  }, [fetchRequests]);

  // API Call: Update Request (Draft)
  const updateRequest = useCallback(async (id: string, body: any): Promise<boolean> => {
    try {
      const res = await fetch(`/api/governance/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (json.success) {
        await fetchRequests();
        return true;
      } else {
        alert(`Erro ao editar rascunho: ${json.errors?.[0]?.message || "Verifique os dados."}`);
        return false;
      }
    } catch (err: any) {
      alert(`Falha ao conectar com o servidor: ${err.message}`);
      return false;
    }
  }, [fetchRequests]);

  // API Call: Transition Request Status
  const transitionRequest = useCallback(async (id: string, next_status: string, notes?: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/governance/requests/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next_status, notes })
      });
      const json = await res.json();
      if (json.success) {
        // Trigger all refreshes immediately for absolute consistency
        await Promise.all([fetchRequests(), fetchMetrics(), fetchInconsistencies()]);
        return true;
      } else {
        alert(`Erro na transição: ${json.errors?.[0]?.message || "Permissão negada."}`);
        return false;
      }
    } catch (err: any) {
      alert(`Falha ao conectar com o servidor: ${err.message}`);
      return false;
    }
  }, [fetchRequests, fetchMetrics, fetchInconsistencies]);

  // Sorting Helper for Inconsistencies
  const setSorting = (field: string) => {
    if (sortBy === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(field);
      setSortDesc(false);
    }
  };

  // Sort client-side
  const sortedInconsistencies = React.useMemo(() => {
    if (!inconsistencies) return null;
    return [...inconsistencies].sort((a: any, b: any) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (valA === null || valA === undefined) valA = "";
      if (valB === null || valB === undefined) valB = "";

      if (typeof valA === "string" && typeof valB === "string") {
        return sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      return sortDesc ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
    });
  }, [inconsistencies, sortBy, sortDesc]);

  // Polling management: 60 seconds auto-refresh (only for KPIs/Alerts/Requests)
  useEffect(() => {
    fetchMetrics();
    fetchSettings();
  }, [fetchMetrics]);

  useEffect(() => {
    fetchInconsistencies();
  }, [fetchInconsistencies]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchMetrics();
      fetchInconsistencies();
      fetchRequests();
    }, 60000); // 60s auto refresh

    return () => clearInterval(timer);
  }, [fetchMetrics, fetchInconsistencies, fetchRequests]);

  const value = {
    metrics: { loading: metricsLoading, error: metricsError, data: metricsData, refresh: fetchMetrics },
    settings: { loading: settingsLoading, error: settingsError, data: settingsData, refresh: fetchSettings, updateSetting },
    inconsistencies: {
      loading: inconsLoading,
      error: inconsError,
      data: sortedInconsistencies,
      pagination,
      page,
      limit,
      search,
      tipo,
      sortBy,
      sortDesc,
      setPage,
      setLimit,
      setSearch,
      setTipo,
      setSorting,
      refresh: fetchInconsistencies,
    },
    requests: {
      loading: reqsLoading,
      error: reqsError,
      data: requests,
      pagination: reqsPagination,
      page: reqPage,
      limit: reqLimit,
      search: reqSearch,
      status: reqStatus,
      setPage: setReqPage,
      setLimit: setReqLimit,
      setSearch: setReqSearch,
      setStatus: setReqStatus,
      createRequest,
      updateRequest,
      transitionRequest,
      refresh: fetchRequests
    }
  };

  return <QualityContext.Provider value={value}>{children}</QualityContext.Provider>;
}

export function useGovernanceMetrics() {
  const ctx = useContext(QualityContext);
  if (!ctx) throw new Error("useGovernanceMetrics must be used within a QualityProvider");
  return ctx.metrics;
}

export function useGovernanceSettings() {
  const ctx = useContext(QualityContext);
  if (!ctx) throw new Error("useGovernanceSettings must be used within a QualityProvider");
  return ctx.settings;
}

export function useGovernanceInconsistencies() {
  const ctx = useContext(QualityContext);
  if (!ctx) throw new Error("useGovernanceInconsistencies must be used within a QualityProvider");
  return ctx.inconsistencies;
}

export function useGovernanceRequests() {
  const ctx = useContext(QualityContext);
  if (!ctx) throw new Error("useGovernanceRequests must be used within a QualityProvider");
  return ctx.requests;
}
