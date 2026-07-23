"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Filter, Search, ShieldCheck, AlertCircle, CheckCircle2, FilePlus, Upload, Eye, Loader2, Sparkles, Building2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { FarolItem, obterDadosFarolExecutivo, CartaAnuenciaItem } from "./actions";

interface FarolExecutivoViewProps {
  onEmitirCarta: (redeCode: string, competencia?: string) => void;
  onUploadCarta: (carta: CartaAnuenciaItem) => void;
  onPreviewCarta: (carta: CartaAnuenciaItem) => void;
  competenciaFiltroDefault?: string;
}

export function FarolExecutivoView({
  onEmitirCarta,
  onUploadCarta,
  onPreviewCarta,
  competenciaFiltroDefault,
}: FarolExecutivoViewProps) {
  const [farolItems, setFarolItems] = useState<FarolItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterManager, setFilterManager] = useState("TODOS");
  const [filterUf, setFilterUf] = useState("TODAS");
  const [filterFarolStatus, setFilterFarolStatus] = useState("TODOS");
  const [search, setSearch] = useState("");

  const loadFarolData = async () => {
    setLoading(true);
    try {
      const data = await obterDadosFarolExecutivo({
        manager: filterManager !== "TODOS" ? filterManager : undefined,
        uf: filterUf !== "TODAS" ? filterUf : undefined,
        competencia: competenciaFiltroDefault,
      });
      setFarolItems(data);
    } catch (err) {
      console.error("Erro ao carregar Farol Executivo:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFarolData();
  }, [filterManager, filterUf, competenciaFiltroDefault]);

  // Filters lists
  const managersList = useMemo(() => {
    const setM = new Set(farolItems.map((f) => f.manager).filter(Boolean) as string[]);
    return Array.from(setM).sort();
  }, [farolItems]);

  const ufsList = useMemo(() => {
    const setU = new Set(farolItems.map((f) => f.uf).filter(Boolean) as string[]);
    return Array.from(setU).sort();
  }, [farolItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return farolItems.filter((item) => {
      if (filterFarolStatus !== "TODOS" && item.farol_status !== filterFarolStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        const redeMatch = item.rede.toLowerCase().includes(s);
        const mgrMatch = item.manager ? item.manager.toLowerCase().includes(s) : false;
        const numMatch = item.carta_atual ? item.carta_atual.numero_carta.toLowerCase().includes(s) : false;
        if (!redeMatch && !mgrMatch && !numMatch) return false;
      }
      return true;
    });
  }, [farolItems, filterFarolStatus, search]);

  // Counts
  const stats = useMemo(() => {
    let verdes = 0;
    let amarelos = 0;
    let vermelhos = 0;
    farolItems.forEach((item) => {
      if (item.farol_status === "VERDE") verdes++;
      else if (item.farol_status === "AMARELO") amarelos++;
      else vermelhos++;
    });
    return { total: farolItems.length, verdes, amarelos, vermelhos };
  }, [farolItems]);

  return (
    <div className="space-y-6">
      
      {/* Banner Explicativo do Farol Executivo */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-primary/5 to-purple-500/10 border border-amber-500/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              Farol Executivo de Anuência — Redes Notáveis (&gt; R$ 80.000 / mês)
            </h3>
            <p className="text-xs text-muted-foreground">
              Monitoramento automático baseado no faturamento real dos últimos 12 meses (Governança Financeira V1).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Assinada e Vigente ({stats.verdes})
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Pendente / Expirada ({stats.amarelos})
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Sem Carta ({stats.vermelhos})
          </div>
        </div>
      </div>

      {/* Barra de Filtros Multidimensionais */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Busca */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar Rede ou Gerente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Filtro Gerente / GRV */}
          <select
            value={filterManager}
            onChange={(e) => setFilterManager(e.target.value)}
            className="h-9 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
          >
            <option value="TODOS">Todos os Gerentes (GRV)</option>
            {managersList.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Filtro UF */}
          <select
            value={filterUf}
            onChange={(e) => setFilterUf(e.target.value)}
            className="h-9 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
          >
            <option value="TODAS">Todas as UFs</option>
            {ufsList.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          {/* Filtro Status Farol */}
          <select
            value={filterFarolStatus}
            onChange={(e) => setFilterFarolStatus(e.target.value)}
            className="h-9 px-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary"
          >
            <option value="TODOS">Todos os Faróis</option>
            <option value="VERDE">🟢 Verde (Assinada & Vigente)</option>
            <option value="AMARELO">🟡 Amarelo (Pendente / Expirada)</option>
            <option value="VERMELHO">🔴 Vermelho (Sem Carta)</option>
          </select>
        </div>

        <button
          onClick={loadFarolData}
          className="px-3 py-1.5 text-xs font-medium rounded-xl border border-border bg-secondary hover:bg-secondary/80 transition-colors"
        >
          Atualizar Farol
        </button>
      </div>

      {/* Tabela do Farol Executivo */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">
              Consultando faturamento oficial L12M e status das cartas...
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-xs">
            Nenhuma rede encontrada com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="py-3 px-4">Indicador</th>
                  <th className="py-3 px-4">Rede</th>
                  <th className="py-3 px-4">Gerente (GRV)</th>
                  <th className="py-3 px-4 text-center">UF</th>
                  <th className="py-3 px-4 text-right">Média Mensal (L12M)</th>
                  <th className="py-3 px-4 text-center">Última Carta</th>
                  <th className="py-3 px-4 text-center">Status Carta</th>
                  <th className="py-3 px-4 text-center">Carta Assinada?</th>
                  <th className="py-3 px-4 text-right">Ações Aconselhadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((item, idx) => {
                  const carta = item.carta_atual;

                  return (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      {/* Farol Indicator Bullet */}
                      <td className="py-3 px-4 text-center">
                        {item.farol_status === "VERDE" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 text-[10px]">
                            🟢 Vigente
                          </span>
                        )}
                        {item.farol_status === "AMARELO" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20 text-[10px]">
                            🟡 Pendente
                          </span>
                        )}
                        {item.farol_status === "VERMELHO" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/20 text-[10px]">
                            🔴 Sem Carta
                          </span>
                        )}
                      </td>

                      {/* Nome da Rede */}
                      <td className="py-3 px-4 font-bold text-foreground">
                        {item.rede}
                      </td>

                      {/* Gerente / GRV */}
                      <td className="py-3 px-4 text-muted-foreground">
                        {item.manager || "Sem Gerente"}
                      </td>

                      {/* UF */}
                      <td className="py-3 px-4 text-center font-mono font-medium">
                        {item.uf || "BR"}
                      </td>

                      {/* Média Mensal L12M */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-450">
                        {formatCurrency(item.media_mensal)}
                      </td>

                      {/* Última Carta */}
                      <td className="py-3 px-4 text-center font-mono text-[11px]">
                        {carta ? (
                          <span className="text-foreground font-semibold">
                            {carta.numero_carta} (v{carta.versao})
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">Nenhuma</span>
                        )}
                      </td>

                      {/* Status Carta */}
                      <td className="py-3 px-4 text-center">
                        {carta ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              carta.status === "ASSINADA"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : carta.status === "CANCELADA"
                                ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                            }`}
                          >
                            {carta.status} {carta.expirada ? "(Expirada)" : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Possui Carta Assinada */}
                      <td className="py-3 px-4 text-center font-bold">
                        {item.possui_carta_assinada ? (
                          <span className="text-emerald-600 dark:text-emerald-400">SIM</span>
                        ) : (
                          <span className="text-rose-500">NÃO</span>
                        )}
                      </td>

                      {/* Ações Aconselhadas */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {carta && (
                            <button
                              onClick={() => onPreviewCarta(carta)}
                              className="p-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
                              title="Visualizar Carta A4"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {carta && carta.status !== "ASSINADA" && (
                            <button
                              onClick={() => onUploadCarta(carta)}
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                              title="Upload da Carta Assinada (Baixa no Farol)"
                            >
                              <Upload className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onEmitirCarta(item.rede)}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center gap-1"
                          >
                            <FilePlus className="w-3 h-3" />
                            {carta ? "Emitir Nova Via" : "Emitir Carta"}
                          </button>
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
  );
}
