"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { History, Search, ArrowLeft, Database, Clock, User, FileJson, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeProvider";

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  
  // Modal for details
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadLogs() {
      try {
        setLoading(true);
        setError(null);

        // Fetch logs
        const { data: logsData, error: logsError } = await supabase
          .from("cm_audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);

        if (logsError) throw logsError;

        // Extract unique user IDs from logs to fetch emails if needed.
        // Wait, standard supabase client cannot read auth.users. 
        // We will call an API route to fetch user emails, or just display ID for now if API route doesn't exist.
        // Let's create an API route for this or just fetch emails via a server action. 
        // Actually, we can fetch all profiles and just show ID if no email. We can also create a server action.
        
        setLogs(logsData || []);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar os logs de auditoria.");
      } finally {
        setLoading(false);
      }
    }

    loadLogs();
  }, []);

  // Use a separate effect to try to fetch emails via API if possible
  useEffect(() => {
    async function fetchEmails() {
      try {
        const res = await fetch('/api/users/emails'); // Let's assume we can fetch or just map to what we have
        if (res.ok) {
          const map = await res.json();
          setUsersMap(map);
        }
      } catch (e) {
        // silently fail and fallback to IDs
      }
    }
    // We will just fetch directly via server component later if needed, but for now client side is fine.
    // Wait, let's just make the page a Server Component!
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch = log.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (log.user_id && log.user_id.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchTable = tableFilter === "all" || log.table_name === tableFilter;
      return matchSearch && matchTable;
    });
  }, [logs, searchTerm, tableFilter]);

  const uniqueTables = Array.from(new Set(logs.map(l => l.table_name))).sort();

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  };

  const ActionBadge = ({ action }: { action: string }) => {
    const colors: Record<string, string> = {
      INSERT: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      UPDATE: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      DELETE: "bg-red-500/10 text-red-600 border-red-500/20"
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${colors[action] || "bg-slate-100 text-slate-600"}`}>
        {action}
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-background font-sans transition-colors duration-300">
      <main className="flex-1 overflow-auto bg-[url('/noise.png')] bg-repeat opacity-95">
        <div className="p-8 max-w-6xl mx-auto space-y-8">
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link href="/" className="text-muted hover:text-foreground transition-colors flex items-center text-sm">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao Painel
                </Link>
              </div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                <History className="w-8 h-8 text-accent-gold" />
                Logs de Auditoria
              </h1>
              <p className="text-muted mt-1">Registro de todas as atividades críticas do sistema.</p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  placeholder="Buscar por ID do log ou ID do usuário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold/50"
                />
              </div>
              <div className="w-full md:w-64">
                <select
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold/50 appearance-none"
                >
                  <option value="all">Todas as Tabelas</option>
                  {uniqueTables.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-muted">Carregando logs...</div>
            ) : error ? (
              <div className="bg-red-500/10 text-red-600 p-4 rounded-xl text-center">{error}</div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted bg-background/50 rounded-xl border border-border">Nenhum log encontrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/50 text-xs uppercase text-muted tracking-wider">
                      <th className="pb-3 font-medium px-4">Data/Hora</th>
                      <th className="pb-3 font-medium px-4">Ação</th>
                      <th className="pb-3 font-medium px-4">Tabela</th>
                      <th className="pb-3 font-medium px-4">Usuário ID</th>
                      <th className="pb-3 font-medium px-4 text-right">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 text-sm">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/5 transition-colors group">
                        <td className="py-3 px-4 text-foreground/80 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted/50" />
                          {formatDate(log.created_at)}
                        </td>
                        <td className="py-3 px-4">
                          <ActionBadge action={log.action} />
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-foreground/70">
                          <span className="flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-muted" />
                            {log.table_name}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-muted truncate max-w-[150px]">
                          <span className="flex items-center gap-1.5" title={log.user_id}>
                            <User className="w-3.5 h-3.5" />
                            {usersMap[log.user_id] || (log.user_id ? log.user_id.substring(0, 8) + "..." : "Sistema")}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button 
                            onClick={() => setSelectedLog(log)}
                            className="text-xs font-medium text-accent-gold hover:text-accent-gold/80 bg-accent-gold/10 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1"
                          >
                            <FileJson className="w-3.5 h-3.5" /> Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal for Details */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Database className="w-5 h-5 text-accent-gold" />
                  Detalhes do Log
                </h3>
                <p className="text-sm text-muted mt-1">Tabela: <span className="font-mono text-foreground">{selectedLog.table_name}</span> | Ação: <ActionBadge action={selectedLog.action} /></p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-muted hover:text-foreground p-2 rounded-lg hover:bg-muted/10 transition-colors">
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-background/50">
              <div className="flex items-center gap-4 text-sm text-muted mb-6 bg-card p-3 rounded-xl border border-border">
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {formatDate(selectedLog.created_at)}</span>
                <span className="text-border">|</span>
                <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> {usersMap[selectedLog.user_id] || selectedLog.user_id || "Sistema"}</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {(selectedLog.action === "UPDATE" || selectedLog.action === "DELETE") && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-foreground/80 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span> Dados Anteriores
                    </h4>
                    <pre className="bg-slate-950 text-slate-300 p-4 rounded-xl text-xs overflow-x-auto border border-red-500/20 shadow-inner h-full max-h-[400px]">
                      {JSON.stringify(selectedLog.old_data, null, 2)}
                    </pre>
                  </div>
                )}
                
                {selectedLog.action === "UPDATE" && (
                  <div className="hidden lg:flex items-center justify-center -mx-3 z-10">
                    <div className="bg-card p-2 rounded-full border border-border shadow-sm">
                      <ArrowRight className="w-5 h-5 text-muted" />
                    </div>
                  </div>
                )}

                {(selectedLog.action === "UPDATE" || selectedLog.action === "INSERT") && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-foreground/80 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Novos Dados
                    </h4>
                    <pre className="bg-slate-950 text-emerald-300/90 p-4 rounded-xl text-xs overflow-x-auto border border-emerald-500/20 shadow-inner h-full max-h-[400px]">
                      {JSON.stringify(selectedLog.new_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
