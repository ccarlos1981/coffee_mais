"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, BarChart3, TrendingUp, Zap, Star } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeProvider";

interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  table_name: string;
  user_id: string | null;
}

// Mapa de tabelas para nomes de módulos legíveis
const TABLE_TO_MODULE: Record<string, { name: string; emoji: string; color: string }> = {
  cm_investimentos:    { name: "Investimento / Trade",    emoji: "📈", color: "from-blue-500 to-blue-700" },
  cm_boletos:          { name: "Financeiro – Boletos",    emoji: "💳", color: "from-green-500 to-green-700" },
  cm_metas:            { name: "Metas",                   emoji: "🎯", color: "from-purple-500 to-purple-700" },
  cm_clientes:         { name: "Config. Financeiro",      emoji: "🏢", color: "from-amber-500 to-amber-700" },
  cm_audit_logs:       { name: "Logs do Sistema",         emoji: "🔍", color: "from-slate-500 to-slate-700" },
  cm_usuarios:         { name: "Usuários",                emoji: "👥", color: "from-teal-500 to-teal-700" },
  cm_promotores:       { name: "Promotor",                emoji: "🚀", color: "from-orange-500 to-orange-700" },
  cm_permissoes:       { name: "Configurar Acesso",       emoji: "🔒", color: "from-red-500 to-red-700" },
  cm_products:         { name: "Produtos / SKU",          emoji: "📦", color: "from-indigo-500 to-indigo-700" },
  cm_employees:        { name: "Gente & Gestão",          emoji: "👤", color: "from-pink-500 to-pink-700" },
  cm_networks:         { name: "Redes / Matriz",          emoji: "🏪", color: "from-cyan-500 to-cyan-700" },
  cm_matriz:           { name: "Gestão de Matriz",        emoji: "🗺️", color: "from-violet-500 to-violet-700" },
};

function getModule(tableName: string) {
  return TABLE_TO_MODULE[tableName] || { name: tableName, emoji: "⚙️", color: "from-gray-500 to-gray-700" };
}

interface ModuleRank {
  table: string;
  name: string;
  emoji: string;
  color: string;
  total: number;
  today: number;
  thisWeek: number;
  uniqueUsers: number;
  topAction: string;
}

export default function RankingModulosPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("30d");

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("cm_audit_logs")
        .select("id, created_at, action, table_name, user_id")
        .order("created_at", { ascending: false })
        .limit(5000);
      setLogs(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    if (period === "7d") {
      const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return logs.filter(l => new Date(l.created_at) >= cutoff);
    }
    if (period === "30d") {
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return logs.filter(l => new Date(l.created_at) >= cutoff);
    }
    return logs;
  }, [logs, period]);

  const ranking: ModuleRank[] = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const byTable: Record<string, AuditLog[]> = {};
    for (const log of filtered) {
      const t = log.table_name || "desconhecido";
      if (!byTable[t]) byTable[t] = [];
      byTable[t].push(log);
    }
    return Object.entries(byTable)
      .map(([table, tLogs]) => {
        const mod = getModule(table);
        const today = tLogs.filter(l => l.created_at.slice(0, 10) === todayStr).length;
        const thisWeek = tLogs.filter(l => new Date(l.created_at) >= weekAgo).length;
        const uniqueUsers = new Set(tLogs.map(l => l.user_id).filter(Boolean)).size;
        const actionCount: Record<string, number> = {};
        for (const l of tLogs) actionCount[l.action] = (actionCount[l.action] || 0) + 1;
        const topAction = Object.entries(actionCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
        return { table, ...mod, total: tLogs.length, today, thisWeek, uniqueUsers, topAction };
      })
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);
  const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
  const podiumHeights = ["h-20", "h-28", "h-14"];
  const podiumEmojis = ["🥈", "🥇", "🥉"];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-xl hover:bg-elevated transition-colors text-muted hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-foreground">Ranking de Módulos</h1>
                <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Funções mais acessadas da plataforma</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-elevated border border-border rounded-xl p-1">
              {(["7d", "30d", "all"] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period === p ? "bg-blue-500 text-white shadow-sm" : "text-muted hover:text-foreground"}`}>
                  {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "Tudo"}
                </button>
              ))}
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 flex-1 w-full space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Módulos Ativos", value: ranking.length, icon: BarChart3 },
                { label: "Total de Ações", value: filtered.length.toLocaleString("pt-BR"), icon: Zap },
                { label: "Módulo Líder", value: ranking[0]?.emoji + " " + ranking[0]?.name || "—", sub: ranking[0] ? `${ranking[0].total.toLocaleString("pt-BR")} acessos` : "", icon: Star },
              ].map(({ label, value, sub, icon: Icon }) => (
                <div key={label} className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-1">{label}</p>
                    <p className="text-xl font-black text-foreground leading-tight">{value}</p>
                    {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
                  </div>
                </div>
              ))}
            </div>

            {/* Podium */}
            {top3.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-8">
                <p className="text-xs font-black uppercase tracking-wider text-muted text-center mb-8">🏆 Módulos mais acessados</p>
                <div className="flex items-end justify-center gap-6">
                  {podiumOrder.map((mod, renderIdx) => (
                    <div key={mod.table} className="flex flex-col items-center gap-3 w-40">
                      <span className="text-3xl">{mod.emoji}</span>
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${mod.color} flex items-center justify-center shadow-xl`}>
                        <span className="text-white font-black text-2xl">{podiumEmojis[renderIdx]}</span>
                      </div>
                      <div className="text-center">
                        <p className="font-black text-foreground text-sm leading-tight">{mod.name}</p>
                        <p className="text-xs text-muted">{mod.total.toLocaleString("pt-BR")} ações</p>
                        <p className="text-[10px] text-muted">{mod.uniqueUsers} usuários</p>
                      </div>
                      <div className={`w-full ${podiumHeights[renderIdx]} bg-gradient-to-b ${mod.color} rounded-t-2xl`} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full ranking list */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" /> Ranking Completo de Módulos
                </h2>
              </div>
              <div className="divide-y divide-border">
                {ranking.map((mod, idx) => {
                  const pct = ranking[0]?.total > 0 ? (mod.total / ranking[0].total) * 100 : 0;
                  const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                  return (
                    <div key={mod.table} className="px-6 py-4 flex items-center gap-4 hover:bg-elevated/40 transition-colors">
                      <div className="w-8 text-center flex-shrink-0">
                        {medal ? <span className="text-xl">{medal}</span> : <span className="text-sm font-black text-muted">#{idx + 1}</span>}
                      </div>
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${mod.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <span className="text-lg">{mod.emoji}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-black text-foreground text-sm">{mod.name}</span>
                          {mod.topAction && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-elevated border border-border text-muted uppercase">{mod.topAction}</span>
                          )}
                        </div>
                        <div className="h-1.5 bg-elevated rounded-full overflow-hidden w-full max-w-sm">
                          <div className={`h-full bg-gradient-to-r ${mod.color} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-5 text-right flex-shrink-0">
                        <div><p className="text-[10px] text-muted uppercase font-bold">Hoje</p><p className="font-black text-foreground">{mod.today}</p></div>
                        <div><p className="text-[10px] text-muted uppercase font-bold">7 dias</p><p className="font-black text-foreground">{mod.thisWeek}</p></div>
                        <div><p className="text-[10px] text-muted uppercase font-bold">Usuários</p><p className="font-black text-foreground">{mod.uniqueUsers}</p></div>
                        <div><p className="text-[10px] text-muted uppercase font-bold">Total</p><p className="font-black text-blue-500 text-base">{mod.total.toLocaleString("pt-BR")}</p></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
