"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export interface RedeData {
  codigo: string;
  nome: string;
  canal: string;
  manager_id: string | null;
  manager: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManagerProfile {
  id: string;
  name: string;
  role: string;
}

export interface FilialData {
  codigo: number;
  nome_parceiro: string;
  uf: string;
  codigo_matriz: string | null;
  responsavel: string | null;
  status: string;
  cnpj: string | null;
  cidade: string | null;
}

export interface WorkflowRequest {
  id: string;
  cliente_codigo: number;
  uf_proposta: string | null;
  codigo_matriz_proposto: string | null;
  responsavel_proposto: string | null;
  status: string;
  versao: number;
  justificativa: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  request_id: string | null;
  action_type: string;
  old_value: string | null;
  new_value: string | null;
  justificativa: string;
  created_at: string;
  executed_by: string;
}

export interface TerritoryMapping {
  uf: string;
  manager: string;
  updated_at: string;
}

export interface RegionalRule {
  id: string;
  cliente_matriz_id: string;
  estado: string;
  gerente_responsavel_id: string;
  regional: string;
  ativo: boolean;
  created_at: string;
  cm_redes_matrizes?: {
    nome: string;
  } | null;
  cm_user_profiles?: {
    name: string;
  } | null;
}

export interface UnifiedSearchResult {
  rede: RedeData | null;
  filiais: FilialData[];
  workflows: WorkflowRequest[];
  auditLogs: AuditLog[];
  kpis: {
    totalFiliais: number;
    activeWorkflows: number;
    iqcScore: number;
  };
}

interface CadastroMestreContextType {
  loading: boolean;
  error: string | null;
  redes: RedeData[];
  managers: ManagerProfile[];
  territories: TerritoryMapping[];
  regionals: RegionalRule[];
  searchResults: UnifiedSearchResult | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  triggerSearch: (query: string) => Promise<void>;
  createRede: (payload: any) => Promise<boolean>;
  updateRede: (payload: any) => Promise<boolean>;
  updateTerritory: (uf: string, manager: string) => Promise<boolean>;
  createRegional: (cliente_matriz_id: string, estado: string, gerente_responsavel_id: string) => Promise<boolean>;
  deleteRegional: (id: string) => Promise<boolean>;
  reloadRedes: () => Promise<void>;
  reloadTerritoryAndRegional: () => Promise<void>;
}

const CadastroMestreContext = createContext<CadastroMestreContextType | undefined>(undefined);

export function CadastroMestreProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redes, setRedes] = useState<RedeData[]>([]);
  const [managers, setManagers] = useState<ManagerProfile[]>([]);
  const [territories, setTerritories] = useState<TerritoryMapping[]>([]);
  const [regionals, setRegionals] = useState<RegionalRule[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UnifiedSearchResult | null>(null);

  const supabase = createClient();

  const fetchBaseData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch official redes
      const { data: redesData, error: redesErr } = await supabase
        .from("cm_redes_matrizes")
        .select("*")
        .order("nome", { ascending: true });

      if (redesErr) throw redesErr;
      setRedes(redesData || []);

      // 2. Fetch approved managers
      const { data: managersData, error: managersErr } = await supabase
        .from("cm_user_profiles")
        .select("id, name, role")
        .eq("approved", true)
        .order("name", { ascending: true });

      if (managersErr) throw managersErr;
      setManagers(managersData || []);

    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados cadastrais básicos.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTerritoryAndRegional = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch territories mapping
      const resTerr = await fetch("/api/governance/master/territory");
      const jsonTerr = await resTerr.json();
      if (jsonTerr.success) {
        setTerritories(jsonTerr.data);
      } else {
        throw new Error(jsonTerr.errors?.[0]?.message || "Erro ao carregar territórios.");
      }

      // 2. Fetch regional rules
      const resReg = await fetch("/api/governance/master/regional");
      const jsonReg = await resReg.json();
      if (jsonReg.success) {
        setRegionals(jsonReg.data);
      } else {
        throw new Error(jsonReg.errors?.[0]?.message || "Erro ao carregar regionalização.");
      }

    } catch (err: any) {
      setError(err.message || "Erro ao carregar mapeamentos de UFs e regionais.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBaseData();
    fetchTerritoryAndRegional();
  }, []);

  const triggerSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let targetMatrixCode: string | null = null;
      let matchedRede: RedeData | null = null;

      // 1. Resolve matrix code from Rede name or filial code
      if (isNaN(Number(query))) {
        // Try finding rede by name
        const { data: matchedRedes } = await supabase
          .from("cm_redes_matrizes")
          .select("*")
          .ilike("nome", `%${query}%`)
          .limit(1);

        if (matchedRedes && matchedRedes.length > 0) {
          matchedRede = matchedRedes[0];
          targetMatrixCode = matchedRedes[0].codigo;
        }
      } else {
        // Try finding filial by client code
        const { data: matchedClient } = await supabase
          .from("cm_clientes")
          .select("codigo_matriz")
          .eq("codigo", Number(query))
          .maybeSingle();

        if (matchedClient?.codigo_matriz) {
          targetMatrixCode = matchedClient.codigo_matriz;
          const { data: matchedRedes } = await supabase
            .from("cm_redes_matrizes")
            .select("*")
            .eq("codigo", targetMatrixCode)
            .maybeSingle();

          if (matchedRedes) {
            matchedRede = matchedRedes;
          }
        }
      }

      if (!targetMatrixCode) {
        setSearchResults({
          rede: null,
          filiais: [],
          workflows: [],
          auditLogs: [],
          kpis: { totalFiliais: 0, activeWorkflows: 0, iqcScore: 0 }
        });
        return;
      }

      // 2. Fetch all filiais under this matrix
      const { data: filiais } = await supabase
        .from("cm_clientes")
        .select("codigo, nome_parceiro, uf, codigo_matriz, responsavel, status, cnpj, cidade")
        .eq("codigo_matriz", targetMatrixCode)
        .order("nome_parceiro", { ascending: true });

      const filialCodes = (filiais || []).map((f) => f.codigo);

      // 3. Fetch workflows for these filiais
      let workflows: WorkflowRequest[] = [];
      if (filialCodes.length > 0) {
        const { data: wfData } = await supabase
          .from("cm_ownership_requests")
          .select("id, cliente_codigo, uf_proposta, codigo_matriz_proposto, responsavel_proposto, status, versao, justificativa, created_at")
          .in("cliente_codigo", filialCodes)
          .order("created_at", { ascending: false });
        workflows = wfData || [];
      }

      // 4. Fetch audit logs for these filiais
      let auditLogs: AuditLog[] = [];
      if (filialCodes.length > 0) {
        const { data: auditData } = await supabase
          .from("cm_audit_ownership_log")
          .select("id, request_id, action_type, old_value, new_value, justificativa, created_at, executed_by")
          .in("request_id", workflows.map(w => w.id)) // Logs linked to workflows
          .order("created_at", { ascending: false })
          .limit(10);
        auditLogs = auditData || [];
      }

      // 5. Query inconsistencies for IQC calculation
      const { data: inconsistencies } = await supabase
        .from("mv_cadastros_inconsistentes")
        .select("cliente_codigo")
        .in("cliente_codigo", filialCodes);

      const inconsistentCodes = new Set((inconsistencies || []).map(i => i.cliente_codigo));
      const totalFiliaisCount = filiais?.length || 0;
      const cleanFiliaisCount = totalFiliaisCount - inconsistentCodes.size;
      const iqcScore = totalFiliaisCount > 0 ? Math.round((cleanFiliaisCount / totalFiliaisCount) * 100) : 100;

      setSearchResults({
        rede: matchedRede,
        filiais: filiais || [],
        workflows,
        auditLogs,
        kpis: {
          totalFiliais: totalFiliaisCount,
          activeWorkflows: workflows.filter(w => w.status === "PENDENTE_APROVACAO").length,
          iqcScore
        }
      });

    } catch (err: any) {
      setError(err.message || "Erro ao realizar busca unificada.");
    } finally {
      setLoading(false);
    }
  };

  const createRede = async (payload: any): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/governance/master/redes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.errors?.[0]?.message || "Falha ao criar rede.");
      }

      await fetchBaseData();
      return true;

    } catch (err: any) {
      setError(err.message || "Erro ao salvar rede.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateRede = async (payload: any): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/governance/master/redes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.errors?.[0]?.message || "Falha ao atualizar rede.");
      }

      await fetchBaseData();
      return true;

    } catch (err: any) {
      setError(err.message || "Erro ao atualizar rede.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateTerritory = async (uf: string, manager: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/governance/master/territory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uf, manager }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.errors?.[0]?.message || "Falha ao atualizar território.");
      }

      await fetchTerritoryAndRegional();
      return true;

    } catch (err: any) {
      setError(err.message || "Erro ao atualizar território.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const createRegional = async (cliente_matriz_id: string, estado: string, gerente_responsavel_id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/governance/master/regional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_matriz_id, estado, gerente_responsavel_id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.errors?.[0]?.message || "Falha ao criar regionalização.");
      }

      await fetchTerritoryAndRegional();
      return true;

    } catch (err: any) {
      setError(err.message || "Erro ao criar regionalização.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteRegional = async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/governance/master/regional?id=${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.errors?.[0]?.message || "Falha ao remover regionalização.");
      }

      await fetchTerritoryAndRegional();
      return true;

    } catch (err: any) {
      setError(err.message || "Erro ao remover regionalização.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <CadastroMestreContext.Provider
      value={{
        loading,
        error,
        redes,
        managers,
        territories,
        regionals,
        searchResults,
        searchQuery,
        setSearchQuery,
        triggerSearch,
        createRede,
        updateRede,
        updateTerritory,
        createRegional,
        deleteRegional,
        reloadRedes: fetchBaseData,
        reloadTerritoryAndRegional: fetchTerritoryAndRegional
      }}
    >
      {children}
    </CadastroMestreContext.Provider>
  );
}

export function useCadastroMestre() {
  const context = useContext(CadastroMestreContext);
  if (context === undefined) {
    throw new Error("useCadastroMestre must be used within a CadastroMestreProvider");
  }
  return context;
}
