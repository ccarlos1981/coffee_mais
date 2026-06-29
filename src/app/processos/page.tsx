"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Layers, 
  ArrowLeft, 
  Search, 
  Plus, 
  FileText, 
  Upload, 
  Clock, 
  Edit3, 
  ExternalLink,
  ChevronRight,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { toast, Toaster } from "sonner";

interface Processo {
  id: string;
  titulo: string;
  categoria: string;
  departamento_responsavel: string;
  conteudo: string;
  versao: string;
  status: string;
  mandatory_read: boolean;
  created_at: string;
  updated_at: string;
}

const DEPARTMENTS = ["Todos", "RH", "Comercial", "Trade Marketing", "Financeiro", "Diretoria", "Jurídico"];

export default function ProcessosPage() {
  const [processes, setProcesses] = useState<Processo[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDept, setActiveDept] = useState("Todos");
  const [userRole, setUserRole] = useState<string>("Promotor");
  const [isEditor, setIsEditor] = useState(false);
  const [importing, setImporting] = useState(false);
  
  // Modals / Novo Processo
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDept, setNewDept] = useState("RH");
  const [newStatus, setNewStatus] = useState("DRAFT");
  const [newMandatoryRead, setNewMandatoryRead] = useState(false);
  const [newAllowDownload, setNewAllowDownload] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch Processes
  const fetchProcesses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/processos?search=${encodeURIComponent(searchQuery)}&dept=${encodeURIComponent(activeDept)}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setProcesses(json.data || []);
        if (json.metrics) {
          setMetrics(json.metrics);
        }
      } else {
        toast.error("Erro ao carregar processos: " + json.error);
      }
    } catch (e) {
      toast.error("Erro na comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  // Get user role on load
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const res = await fetch("/api/remuneracao-promotor", { cache: "no-store" }); // Simple route to check auth
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        
        // Let's get actual user profile
        const profileRes = await fetch("/api/coffee-ia/insight?query=quem_sou_eu", { cache: "no-store" }); // Simple query or check context
        // Instead of heavy calls, let's hit a simpler check or check user from Supabase client directly
        // We will make a simpler api call. Let's do a lightweight GET to verify auth and roles
        const authRes = await fetch("/api/processos", { cache: "no-store" });
        if (authRes.ok) {
          const authJson = await authRes.json();
          // We can deduce editors by whether POST is allowed or by fetching a quick profile
          // Let's get role from token or a simple API. We can make a route /api/user-profile
        }
      } catch (e) {}
    };

    // To be perfectly safe, let's fetch the current profile from Supabase Client Side or a quick custom fetch.
    const getProfile = async () => {
      try {
        const res = await fetch("/api/processos", { cache: "no-store" });
        // The API returns only PUBLICADO if not editor, but if we query, we can deduce if we have edit rights
        // Let's call a fast endpoint or write a small hook. 
        // For security and simplicity, we can fetch from a generic endpoint. Let's do a fetch to a small endpoint or read role from supabase.
        // We will fetch /api/remuneracao-promotor to see if it allows draft saving (requires Admin/CEO/RH).
        // Let's just make a dedicated check or check from metadata.
        const authRes = await fetch("/api/processos", { cache: "no-store" });
        const json = await authRes.json();
        // The backend processes API will automatically filter out drafts if role is not editor.
        // So we can check if any draft/review processes are returned or do a direct role fetch.
        const roleRes = await fetch("/api/coffee-ia/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Qual é o meu perfil de acesso no sistema? Responda apenas com o nome do perfil, ex: Admin, Promotor, Supervisor." })
        });
        if (roleRes.ok) {
          const roleJson = await roleRes.json();
          const roleStr = roleJson.explanation || "";
          setUserRole(roleStr);
          setIsEditor(["Admin", "CEO", "RH"].some(r => roleStr.includes(r)));
        } else {
          // Fallback check if Chat API fails
          setIsEditor(true); // Default to true to let them try edit (backend will enforce rules anyway)
        }
      } catch (e) {
        setIsEditor(true);
      }
    };
    getProfile();
  }, []);

  useEffect(() => {
    fetchProcesses();
  }, [searchQuery, activeDept]);

  // Create Process Handler
  const handleCreateProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Por favor, insira um título.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/processos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: newTitle,
          departamento_responsavel: newDept,
          categoria: newDept,
          conteudo: `<p>Este documento contém as regras oficiais de ${newTitle} da Coffee++.</p>`,
          status: newStatus,
          mandatory_read: newMandatoryRead,
          allow_download: newAllowDownload
        })
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Processo criado com sucesso!");
        setShowCreateModal(false);
        setNewTitle("");
        setNewMandatoryRead(false);
        setNewAllowDownload(true);
        fetchProcesses();
      } else {
        toast.error("Erro ao criar processo: " + json.error);
      }
    } catch (e) {
      toast.error("Erro ao conectar ao servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  // Document Import Handler
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>, type: "docx" | "pdf") => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (type === "docx" && ext !== "docx") {
      toast.error("Por favor, selecione um arquivo Word (.docx).");
      return;
    }
    if (type === "pdf" && ext !== "pdf") {
      toast.error("Por favor, selecione um arquivo PDF (.pdf).");
      return;
    }

    setImporting(true);
    const toastId = toast.loading("Processando arquivo e extraindo conteúdo...");
    
    try {
      const formData = new FormData();
      formData.append("file", file);

      const importRes = await fetch("/api/processos/import", {
        method: "POST",
        body: formData
      });
      
      const importJson = await importRes.json();
      if (!importRes.ok || !importJson.success) {
        toast.error(importJson.error || "Erro ao processar arquivo.", { id: toastId });
        return;
      }

      // Create new process from imported HTML
      const titleWithoutExt = file.name.substring(0, file.name.lastIndexOf("."));
      const finalTitle = titleWithoutExt.replace(/_/g, " ");

      const createRes = await fetch("/api/processos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: finalTitle,
          departamento_responsavel: "RH", // Default to RH
          categoria: "RH",
          conteudo: importJson.html,
          status: "DRAFT",
          file_type: importJson.file_type,
          render_mode: importJson.render_mode,
          original_file_url: importJson.original_file_url
        })
      });

      const createJson = await createRes.json();
      if (createJson.success) {
        toast.success(`Processo "${finalTitle}" importado com sucesso como Rascunho!`, { id: toastId });
        if (importJson.warning) {
          toast.warning(importJson.warning);
        }
        fetchProcesses();
      } else {
        toast.error("Erro ao salvar processo importado: " + createJson.error, { id: toastId });
      }
    } catch (err: any) {
      toast.error("Falha ao importar: " + err.message, { id: toastId });
    } finally {
      setImporting(false);
      // Clear input
      e.target.value = "";
    }
  };

  // Badges for status styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLICADO":
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">🟢 Publicado</span>;
      case "EM_REVISAO":
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">🟡 Em Revisão</span>;
      case "AGUARDANDO_APROVACAO_CEO":
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">🟣 Aguardando CEO</span>;
      case "OBSOLETO":
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">🔴 Obsoleto</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-neutral-500/10 text-neutral-400 border border-neutral-800">⚪ Rascunho</span>;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col font-sans">
      <Toaster theme="dark" position="bottom-right" />

      {/* Header */}
      <header className="p-5 border-b border-neutral-900 bg-neutral-900/40 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Link 
            href="/"
            className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-all flex items-center justify-center border border-transparent hover:border-neutral-700/50"
            title="Voltar ao Painel"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-extrabold uppercase tracking-wide text-amber-500">
              Processos Coffee++
            </h1>
            <p className="text-[10px] text-neutral-400 mt-0.5">
              Central oficial de políticas, normas e procedimentos internos.
            </p>
          </div>
        </div>

        {/* Action buttons (only for Admin/CEO/RH) */}
        {isEditor && (
          <div className="flex items-center gap-2">
            {/* Hidden inputs for imports */}
            <input 
              type="file" 
              id="word-import" 
              accept=".docx" 
              className="hidden" 
              onChange={(e) => handleImportFile(e, "docx")}
            />
            <input 
              type="file" 
              id="pdf-import" 
              accept=".pdf" 
              className="hidden" 
              onChange={(e) => handleImportFile(e, "pdf")}
            />

            <button
              onClick={() => document.getElementById("word-import")?.click()}
              disabled={importing}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs font-bold text-neutral-300 flex items-center gap-1.5 transition disabled:opacity-50"
              title="Formato Recomendado: preserva formatação estruturada de cabeçalhos e tabelas"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              Importar Word
            </button>

            <button
              onClick={() => document.getElementById("pdf-import")?.click()}
              disabled={importing}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs font-bold text-neutral-300 flex items-center gap-1.5 transition disabled:opacity-50"
              title="Fallback: importação com análise inteligente via Inteligência Artificial"
            >
              <Upload className="w-3.5 h-3.5 text-red-400" />
              Importar PDF
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-950 font-black rounded-lg text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/10 transition"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              Novo Processo
            </button>
          </div>
        )}
      </header>

      {/* Main Grid */}
      <main className="max-w-6xl mx-auto w-full p-6 lg:p-10 flex flex-col gap-8 flex-1">
        
        {/* Warning Note for PDF */}
        {isEditor && (
          <div className="p-4 bg-blue-950/20 border border-blue-900/40 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-300 leading-relaxed font-medium">
              <span className="font-bold text-white">Dica de Importação:</span> Para melhores resultados com tópicos, tabelas ou listas complexas, utilize arquivos do Microsoft Word (<strong className="text-white">.docx</strong>). O formato PDF será lido como texto bruto e formatado automaticamente por Inteligência Artificial (Gemini), o que pode ter variações pontuais de design.
            </div>
          </div>
        )}

        {/* Métricas do Módulo (Only for editors) */}
        {isEditor && metrics && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-neutral-900/30 border border-neutral-900 rounded-xl p-4 text-center">
              <span className="text-[10px] text-neutral-500 font-bold uppercase block">Total de Processos</span>
              <span className="text-xl font-black text-neutral-200 mt-1 block">{metrics.total_processes}</span>
            </div>
            <div className="bg-neutral-900/30 border border-neutral-900 rounded-xl p-4 text-center">
              <span className="text-[10px] text-neutral-500 font-bold uppercase block">Publicados</span>
              <span className="text-xl font-black text-emerald-500 mt-1 block">{metrics.published}</span>
            </div>
            <div className="bg-neutral-900/30 border border-neutral-900 rounded-xl p-4 text-center">
              <span className="text-[10px] text-neutral-500 font-bold uppercase block">Em Revisão</span>
              <span className="text-xl font-black text-amber-500 mt-1 block">{metrics.in_review}</span>
            </div>
            <div className="bg-neutral-900/30 border border-neutral-900 rounded-xl p-4 text-center">
              <span className="text-[10px] text-neutral-500 font-bold uppercase block">Leitura Média</span>
              <span className="text-xl font-black text-blue-400 mt-1 block">{metrics.average_adhesion}%</span>
            </div>
            <div className="bg-neutral-900/30 border border-neutral-900 rounded-xl p-4 text-center">
              <span className="text-[10px] text-neutral-500 font-bold uppercase block">Pendentes Críticos</span>
              <span className={`text-xl font-black mt-1 block ${metrics.critical_pending > 0 ? 'text-red-500' : 'text-neutral-400'}`}>{metrics.critical_pending}</span>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between pb-2">
          {/* Search */}
          <div className="relative w-full md:max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Buscar processo por nome ou conteúdo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-850 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>

          {/* Department Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
            {DEPARTMENTS.map(dept => (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${
                  activeDept === dept
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                    : "bg-neutral-900/30 border-neutral-900 text-neutral-400 hover:text-white hover:border-neutral-800"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        {/* Processes Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-xs font-semibold">Buscando diretórios de processos...</span>
          </div>
        ) : processes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-neutral-900 bg-neutral-900/10 rounded-2xl p-8 gap-4">
            <div className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-850 flex items-center justify-center text-neutral-500">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-200">Nenhum processo encontrado</h3>
              <p className="text-xs text-neutral-500 max-w-sm mt-1 leading-relaxed">
                {searchQuery || activeDept !== "Todos" 
                  ? "Tente mudar os filtros de departamento ou o termo buscado." 
                  : "Nenhum documento cadastrado neste departamento ainda."}
              </p>
            </div>
            {isEditor && (searchQuery || activeDept !== "Todos") === false && (
              <button 
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-bold text-amber-500 transition"
              >
                Criar Primeiro Processo
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {processes.map(p => (
              <div
                key={p.id}
                className="group bg-neutral-900/20 border border-neutral-900 rounded-2xl p-5 hover:border-amber-500/20 transition-all duration-300 flex flex-col justify-between gap-5 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-amber-600/0 via-amber-500/10 to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="p-2.5 bg-neutral-900 border border-neutral-850 rounded-xl w-fit flex items-center justify-center text-purple-400 group-hover:border-purple-500/20 transition-colors">
                      <FileText className="w-5 h-5" />
                    </span>
                    <div className="flex items-center gap-1.5">
                      {p.mandatory_read && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse">
                          ⚠️ OBRIGATÓRIO
                        </span>
                      )}
                      {getStatusBadge(p.status)}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-extrabold text-neutral-100 group-hover:text-amber-500 transition-colors line-clamp-1">
                      {p.titulo}
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed font-semibold">
                      Departamento: <span className="text-neutral-300">{p.departamento_responsavel}</span>
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 mt-3 font-medium">
                      <Clock className="w-3 h-3" />
                      <span>Atal. {new Date(p.updated_at).toLocaleDateString("pt-BR")}</span>
                      <span className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-850 text-neutral-400 font-bold uppercase tracking-wider">{p.versao}</span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] border-t border-neutral-900/60 pt-3 flex justify-end items-center gap-2">
                  <Link
                    href={`/processos/${p.id}`}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-850 rounded-lg text-[10px] font-bold text-neutral-300 hover:text-white flex items-center gap-1 transition-all"
                  >
                    Abrir Documento
                    <ExternalLink className="w-3 h-3" />
                  </Link>

                  {isEditor && (
                    <Link
                      href={`/processos/${p.id}?edit=true`}
                      className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg text-[10px] font-black text-amber-500 flex items-center gap-1 transition-all"
                    >
                      Editar
                      <Edit3 className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create New Process Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-850 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h2 className="text-sm font-black uppercase text-amber-500 tracking-wider mb-4">Novo Processo Interno</h2>
            
            <form onSubmit={handleCreateProcess} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-neutral-400 mb-1.5">Título do Processo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Regulamento de Reembolso Corporativo"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-neutral-400 mb-1.5">Departamento</label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                  >
                    {DEPARTMENTS.filter(d => d !== "Todos").map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-neutral-400 mb-1.5">Status Inicial</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="DRAFT">Rascunho (Draft)</option>
                    <option value="EM_REVISAO">Em Revisão</option>
                    <option value="AGUARDANDO_APROVACAO_CEO">Aguardando CEO</option>
                    <option value="PUBLICADO">Publicado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newMandatoryRead}
                    onChange={(e) => setNewMandatoryRead(e.target.checked)}
                    className="w-4 h-4 bg-neutral-950 border border-neutral-850 rounded focus:ring-0 text-amber-500"
                  />
                  <span className="text-[10px] font-black uppercase text-neutral-400">Obrigatório?</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newAllowDownload}
                    onChange={(e) => setNewAllowDownload(e.target.checked)}
                    className="w-4 h-4 bg-neutral-950 border border-neutral-850 rounded focus:ring-0 text-amber-500"
                  />
                  <span className="text-[10px] font-black uppercase text-neutral-400">Permitir Download?</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-neutral-850">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-850 rounded-xl text-xs font-bold text-neutral-400 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-950 font-black rounded-xl text-xs transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Criar Processo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
