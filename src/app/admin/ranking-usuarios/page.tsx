"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Trophy, TrendingUp, Users, Activity, Crown, Medal, Award } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeProvider";

interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  table_name: string;
  user_id: string | null;
}

interface UserRank {
  userId: string;
  email: string;
  name: string;
  total: number;
  today: number;
  thisWeek: number;
  avgPerDay: number;
  topAction: string;
}

export default function RankingUsuariosPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
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
    async function loadEmails() {
      try {
        const res = await fetch("/api/users/emails");
        if (res.ok) setUsersMap(await res.json());
      } catch {}
    }
    load();
    loadEmails();
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

  const ranking: UserRank[] = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const byUser: Record<string, AuditLog[]> = {};
    for (const log of filtered) {
      const uid = log.user_id || "sistema";
      if (!byUser[uid]) byUser[uid] = [];
      byUser[uid].push(log);
    }
    return Object.entries(byUser)
      .filter(([uid]) => uid !== "sistema")
      .map(([userId, userLogs]) => {
        const email = usersMap[userId] || userId;
        const rawName = email.includes("@") ? email.split("@")[0] : email;
        const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        const today = userLogs.filter(l => l.created_at.slice(0, 10) === todayStr).length;
        const thisWeek = userLogs.filter(l => new Date(l.created_at) >= weekAgo).length;
        const days = new Set(userLogs.map(l => l.created_at.slice(0, 10))).size;
        const avgPerDay = days > 0 ? Math.round(userLogs.length / days) : 0;
        const actionCount: Record<string, number> = {};
        for (const l of userLogs) actionCount[l.action] = (actionCount[l.action] || 0) + 1;
        const topAction = Object.entries(actionCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
        return { userId, email, name, total: userLogs.length, today, thisWeek, avgPerDay, topAction };
      })
      .sort((a, b) => b.total - a.total);
  }, [filtered, usersMap]);

  const podiumColors = [
    { bg: "from-amber-400 to-yellow-600", border: "border-amber-400/40", icon: Crown, emoji: "🥇" },
    { bg: "from-slate-300 to-slate-500", border: "border-slate-400/40", icon: Medal, emoji: "🥈" },
    { bg: "from-orange-400 to-orange-600", border: "border-orange-400/40", icon: Award, emoji: "🥉" },
  ];

  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-xl hover:bg-elevated transition-colors text-muted hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-foreground">Ranking de Usuários</h1>
                <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Quem mais acessa a plataforma</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-elevated border border-border rounded-xl p-1">
              {(["7d", "30d", "all"] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period === p ? "bg-amber-500 text-white shadow-sm" : "text-muted hover:text-foreground"}`}>
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
            <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Usuários Ativos", value: ranking.length, icon: Users },
                { label: "Total de Ações", value: filtered.length.toLocaleString("pt-BR"), icon: Activity },
                { label: "Líder do Período", value: ranking[0]?.name || "—", sub: ranking[0] ? `${ranking[0].total.toLocaleString("pt-BR")} ações` : "", icon: Crown },
              ].map(({ label, value, sub, icon: Icon }) => (
                <div key={label} className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-amber-500" />
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
                <p className="text-xs font-black uppercase tracking-wider text-muted text-center mb-8">🏆 Pódio dos mais ativos</p>
                <div className="flex items-end justify-center gap-6">
                  {[1, 0, 2].filter(i => top3[i]).map((origIdx, renderIdx) => {
                    const user = top3[origIdx];
                    const color = podiumColors[origIdx];
                    const heights = ["h-20", "h-28", "h-14"];
                    const h = heights[renderIdx];
                    const IconComp = color.icon;
                    return (
                      <div key={user.userId} className="flex flex-col items-center gap-3 w-36">
                        <span className="text-2xl">{color.emoji}</span>
                        <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${color.bg} flex items-center justify-center shadow-xl border-2 ${color.border}`}>
                          <span className="text-white font-black text-2xl">{user.name.charAt(0)}</span>
                        </div>
                        <div className="text-center">
                          <p className="font-black text-foreground text-sm leading-tight">{user.name}</p>
                          <p className="text-xs text-muted">{user.total.toLocaleString("pt-BR")} ações</p>
                          <p className="text-[10px] text-muted">~{user.avgPerDay}/dia</p>
                        </div>
                        <div className={`w-full ${h} bg-gradient-to-b ${color.bg} rounded-t-2xl flex items-start justify-center pt-2`}>
                          <IconComp className="w-5 h-5 text-white/70" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Full list */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-500" /> Ranking Completo
                </h2>
              </div>
              <div className="divide-y divide-border">
                {ranking.map((user, idx) => {
                  const pct = ranking[0]?.total > 0 ? (user.total / ranking[0].total) * 100 : 0;
                  const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                  return (
                    <div key={user.userId} className="px-6 py-4 flex items-center gap-4 hover:bg-elevated/40 transition-colors">
                      <div className="w-8 text-center flex-shrink-0">
                        {medal ? <span className="text-xl">{medal}</span> : <span className="text-sm font-black text-muted">#{idx + 1}</span>}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="font-black text-amber-600">{user.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-black text-foreground text-sm">{user.name}</span>
                          {user.topAction && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-elevated border border-border text-muted uppercase">{user.topAction}</span>
                          )}
                        </div>
                        <div className="h-1.5 bg-elevated rounded-full overflow-hidden w-full max-w-sm">
                          <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-5 text-right flex-shrink-0">
                        <div><p className="text-[10px] text-muted uppercase font-bold">Hoje</p><p className="font-black text-foreground">{user.today}</p></div>
                        <div><p className="text-[10px] text-muted uppercase font-bold">7 dias</p><p className="font-black text-foreground">{user.thisWeek}</p></div>
                        <div><p className="text-[10px] text-muted uppercase font-bold">Média/dia</p><p className="font-black text-foreground">{user.avgPerDay}</p></div>
                        <div><p className="text-[10px] text-muted uppercase font-bold">Total</p><p className="font-black text-amber-500 text-base">{user.total.toLocaleString("pt-BR")}</p></div>
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
