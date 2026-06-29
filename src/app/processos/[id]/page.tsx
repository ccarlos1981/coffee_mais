"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Save, 
  Clock, 
  User, 
  Calendar, 
  ChevronDown, 
  Layers,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Loader2,
  AlertCircle,
  Eye,
  FileText,
  Copy,
  CheckCircle,
  BarChart2,
  Users
} from "lucide-react";
import { toast, Toaster } from "sonner";
import PdfViewer from "@/components/PdfViewer";

interface HistoryRecord {
  id: string;
  versao: string;
  conteudo_snapshot: string;
  change_log: string;
  created_at: string;
  updated_by_name: string;
}

interface ProcessDetails {
  id: string;
  titulo: string;
  categoria: string;
  departamento_responsavel: string;
  conteudo: string;
  versao: string;
  status: string;
  creator_name: string;
  created_at: string;
  updated_at: string;
  history: HistoryRecord[];
  is_editor: boolean;
  file_type?: string;
  render_mode?: string;
  original_file_url?: string;
  signed_file_url?: string;
  mandatory_read?: boolean;
  allow_download?: boolean;
}

interface ReaderStats {
  total_users: number;
  total_read: number;
  adhesion_percent: number;
  read_list: any[];
  pending_list: any[];
}

const DEPARTMENTS = ["RH", "Comercial", "Trade Marketing", "Financeiro", "Diretoria", "Jurídico"];

export default function ProcessDetailsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [data, setData] = useState<ProcessDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  // Edited values
  const [title, setTitle] = useState("");
  const [dept, setDept] = useState("RH");
  const [status, setStatus] = useState("DRAFT");
  const [mandatoryRead, setMandatoryRead] = useState(false);
  const [allowDownload, setAllowDownload] = useState(true);
  const [newPdfFile, setNewPdfFile] = useState<File | null>(null);
  const [changeLog, setChangeLog] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Read stats and confirmations
  const [readStats, setReadStats] = useState<ReaderStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [hasConfirmedRead, setHasConfirmedRead] = useState(false);
  const [confirmingRead, setConfirmingRead] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [pdfReadComplete, setPdfReadComplete] = useState(false);

  // Content ref for contentEditable
  const editorRef = useRef<HTMLDivElement>(null);

  // Fetch read statistics
  const fetchReadStats = async (versionStr: string) => {
    setLoadingStats(true);
    try {
      const res = await fetch(`/api/processos/${id}/leitura?version=${versionStr}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setReadStats(json.stats);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch process details
  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/processos/${id}`, { cache: "no-store" });
      if (!res.ok) {
        toast.error("Processo não encontrado ou acesso negado.");
        router.push("/processos");
        return;
      }
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setTitle(json.data.titulo);
        setDept(json.data.departamento_responsavel);
        setStatus(json.data.status);
        setMandatoryRead(!!json.data.mandatory_read);
        setAllowDownload(json.data.allow_download !== false);
        
        // If edit URL parameter is present and user is editor, turn on editMode
        const forceEdit = searchParams.get("edit") === "true";
        if (forceEdit && json.data.is_editor) {
          setEditMode(true);
        }

        // Fetch read statistics for this version
        fetchReadStats(json.data.versao);

        // Fetch current user id to check read state
        const chatRes = await fetch("/api/coffee-ia/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Qual é o meu ID de usuário? Responda apenas com o UUID, ex: 123e4567-e89b-12d3-a456-426614174000." })
        });
        if (chatRes.ok) {
          const chatJson = await chatRes.json();
          const myUuid = (chatJson.explanation || "").trim();
          
          // Fetch stats to see if user has already read
          const statsRes = await fetch(`/api/processos/${id}/leitura?version=${json.data.versao}`, { cache: "no-store" });
          const statsJson = await statsRes.json();
          if (statsJson.success) {
            const hasRead = (statsJson.stats.read_list || []).some((r: any) => myUuid.includes(r.user_id));
            setHasConfirmedRead(hasRead);
          }
        }
      }
    } catch (e) {
      toast.error("Erro ao carregar detalhes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  // Set initial content in contentEditable once data loads or editMode changes
  useEffect(() => {
    if (editorRef.current && data) {
      editorRef.current.innerHTML = data.conteudo || "<p>Comece a escrever aqui...</p>";
    }
  }, [data, editMode, loading]);

  // Format command helper for Rich Text Formatting
  const format = (command: string, value: string = "") => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  // Save process changes
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    if (!title.trim()) {
      toast.error("Título do processo é obrigatório.");
      return;
    }
    const htmlContent = data.render_mode === "PDF_VIEWER" ? data.conteudo : (editorRef.current?.innerHTML || "");
    if (!htmlContent.trim() && data.render_mode !== "PDF_VIEWER") {
      toast.error("O conteúdo do processo não pode estar vazio.");
      return;
    }

    setSaving(true);
    try {
      let res;
      if (data.render_mode === "PDF_VIEWER") {
        const formData = new FormData();
        formData.append("titulo", title);
        formData.append("categoria", dept);
        formData.append("departamento_responsavel", dept);
        formData.append("conteudo", htmlContent);
        formData.append("status", status);
        formData.append("mandatory_read", String(mandatoryRead));
        formData.append("allow_download", String(allowDownload));
        formData.append("change_log", changeLog || "Atualização de processo");
        if (newPdfFile) {
          formData.append("file", newPdfFile);
        }
        res = await fetch(`/api/processos/${id}`, {
          method: "PUT",
          body: formData
        });
      } else {
        res = await fetch(`/api/processos/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titulo: title,
            categoria: dept,
            departamento_responsavel: dept,
            conteudo: htmlContent,
            status,
            mandatory_read: mandatoryRead,
            allow_download: allowDownload,
            change_log: changeLog || "Atualização de processo"
          })
        });
      }

      const json = await res.json();
      if (json.success) {
        toast.success("Processo atualizado com sucesso!");
        setShowSaveModal(false);
        setChangeLog("");
        setNewPdfFile(null);
        setEditMode(false);
        fetchDetails();
      } else {
        toast.error("Erro ao salvar: " + json.error);
      }
    } catch (e) {
      toast.error("Erro ao conectar com o servidor.");
    } finally {
      setSaving(false);
    }
  };

  // Confirm reading current version
  const handleConfirmRead = async () => {
    if (!data) return;
    setConfirmingRead(true);
    try {
      const res = await fetch(`/api/processos/${id}/leitura`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: data.versao })
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Leitura confirmada com sucesso!");
        setHasConfirmedRead(true);
        fetchReadStats(data.versao);
      } else {
        toast.error("Erro ao confirmar leitura: " + json.error);
      }
    } catch (e) {
      toast.error("Erro ao conectar com o servidor.");
    } finally {
      setConfirmingRead(false);
    }
  };

  // Duplicate current process
  const handleDuplicate = async () => {
    if (!data) return;
    setDuplicating(true);
    const toastId = toast.loading("Duplicando processo...");
    try {
      const res = await fetch("/api/processos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: `${data.titulo} (Cópia)`,
          categoria: data.categoria || data.departamento_responsavel,
          departamento_responsavel: data.departamento_responsavel,
          conteudo: editorRef.current?.innerHTML || data.conteudo,
          status: "DRAFT",
          mandatory_read: data.mandatory_read,
          allow_download: data.allow_download !== false,
          file_type: data.file_type || "docx",
          render_mode: data.render_mode || "HTML",
          original_file_url: data.original_file_url || null
        })
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Processo duplicado como "${data.titulo} (Cópia)"!`, { id: toastId });
        router.push(`/processos/${json.data.id}`);
      } else {
        toast.error("Erro ao duplicar: " + json.error, { id: toastId });
      }
    } catch (e) {
      toast.error("Erro na comunicação com o servidor.", { id: toastId });
    } finally {
      setDuplicating(false);
    }
  };

  // View older version content
  const handleViewVersion = (versionContent: string, versionTag: string) => {
    if (editMode) {
      toast.warning("Desative o modo de edição para visualizar versões históricas.");
      return;
    }
    if (editorRef.current) {
      editorRef.current.innerHTML = versionContent;
      toast.info(`Exibindo versão histórica ${versionTag}. Recarregue a página para voltar à versão atual.`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <span className="text-xs font-semibold text-neutral-400">Carregando processo corporativo...</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col font-sans">
      <Toaster theme="dark" position="bottom-right" />

      {/* Header */}
      <header className="p-4 border-b border-neutral-900 bg-neutral-900/40 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Link 
            href="/processos"
            className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-all flex items-center justify-center border border-transparent hover:border-neutral-700/50"
            title="Voltar para a Lista"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xs font-extrabold text-amber-500 uppercase tracking-wider">
              {editMode ? "Modo Edição" : "Leitura de Processo"}
            </h1>
            <p className="text-[10px] text-neutral-400">Coffee Mais AI Platform — Governança Corporativa</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {data.is_editor && (
            <>
              {editMode ? (
                <>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      fetchDetails(); // reset changes
                    }}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs font-bold text-neutral-400 transition"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={() => setShowSaveModal(true)}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-950 font-black rounded-lg text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/10 transition cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    {data.render_mode === "PDF_VIEWER" && !newPdfFile ? "Salvar Alterações" : "Salvar Nova Versão"}
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDuplicate}
                    disabled={duplicating}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs font-bold text-neutral-300 flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Duplicar Processo
                  </button>

                  <button
                    onClick={() => setEditMode(true)}
                    className="px-4 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-500 rounded-lg text-xs font-black transition-all cursor-pointer"
                  >
                    {data.render_mode === "PDF_VIEWER" ? "Editar Configurações" : "Editar Documento"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </header>

      {/* Workspace Grid */}
      <div className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        
        {/* Document Frame (Left/Middle Area) */}
        <main className="lg:col-span-9 flex flex-col gap-4">
          
          {/* Metadata Header Card */}
          <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-5 flex flex-col md:flex-row justify-between gap-4">
            <div className="space-y-3">
              {editMode ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-lg font-black uppercase text-amber-500 bg-transparent border-b border-neutral-800 focus:outline-none focus:border-amber-500 pb-1"
                />
              ) : (
                <h2 className="text-base font-extrabold text-neutral-100 uppercase tracking-wide flex items-center gap-2">
                  📄 {data.titulo}
                </h2>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-neutral-400 font-semibold">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3 text-neutral-500" />
                  <span>Autor: {data.creator_name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Layers className="w-3 h-3 text-neutral-500" />
                  <span>Depto: </span>
                  {editMode ? (
                    <select
                      value={dept}
                      onChange={(e) => setDept(e.target.value)}
                      className="bg-neutral-950 border border-neutral-850 rounded px-1.5 py-0.5 text-neutral-200 focus:outline-none"
                    >
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-neutral-200">{data.departamento_responsavel}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-neutral-500" />
                  <span>Atualizado: {new Date(data.updated_at).toLocaleDateString("pt-BR")}</span>
                </div>
                {editMode && (
                  <div className="flex items-center gap-3 border-l border-neutral-800 pl-4 ml-1">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={mandatoryRead}
                        onChange={(e) => setMandatoryRead(e.target.checked)}
                        className="w-3.5 h-3.5 bg-neutral-950 border border-neutral-850 rounded text-amber-500 focus:ring-0"
                      />
                      <span>Obrigatório</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={allowDownload}
                        onChange={(e) => setAllowDownload(e.target.checked)}
                        className="w-3.5 h-3.5 bg-neutral-950 border border-neutral-850 rounded text-amber-500 focus:ring-0"
                      />
                      <span>Permitir Download</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between items-end gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-500 uppercase">Versão</span>
                <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                  {data.versao}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-500 uppercase">Status</span>
                {editMode ? (
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="bg-neutral-950 border border-neutral-850 rounded-lg text-xs px-2.5 py-1 text-neutral-200 focus:outline-none"
                  >
                    <option value="DRAFT">Rascunho (Draft)</option>
                    <option value="EM_REVISAO">Em Revisão</option>
                    <option value="AGUARDANDO_APROVACAO_CEO">Aguardando CEO</option>
                    <option value="PUBLICADO">Publicado</option>
                    <option value="OBSOLETO">Obsoleto</option>
                  </select>
                ) : (
                  <span className="px-2.5 py-1 rounded bg-neutral-950 border border-neutral-850 text-xs font-bold text-neutral-300 uppercase tracking-wider">
                    {data.status.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Formatting Toolbar (Only in editMode and NOT PDF) */}
          {editMode && data.render_mode !== "PDF_VIEWER" && (
            <div className="bg-neutral-900/50 border border-neutral-850 rounded-xl p-2 flex flex-wrap gap-1 items-center">
              <button onClick={() => format("bold")} className="p-2 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white" title="Negrito"><Bold className="w-3.5 h-3.5" /></button>
              <button onClick={() => format("italic")} className="p-2 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white" title="Itálico"><Italic className="w-3.5 h-3.5" /></button>
              <div className="w-px h-4 bg-neutral-800 mx-1" />
              <button onClick={() => format("insertUnorderedList")} className="p-2 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white" title="Lista Marcada"><List className="w-3.5 h-3.5" /></button>
              <button onClick={() => format("insertOrderedList")} className="p-2 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white" title="Lista Numerada"><ListOrdered className="w-3.5 h-3.5" /></button>
              <div className="w-px h-4 bg-neutral-800 mx-1" />
              <button onClick={() => format("formatBlock", "<h1>")} className="p-1.5 hover:bg-neutral-800 rounded text-xs font-bold text-neutral-300 hover:text-white" title="Título Principal"><Heading1 className="w-3.5 h-3.5" /></button>
              <button onClick={() => format("formatBlock", "<h2>")} className="p-1.5 hover:bg-neutral-800 rounded text-xs font-bold text-neutral-300 hover:text-white" title="Subtítulo"><Heading2 className="w-3.5 h-3.5" /></button>
              <button onClick={() => format("formatBlock", "<h3>")} className="p-1.5 hover:bg-neutral-800 rounded text-xs font-bold text-neutral-300 hover:text-white" title="Seção"><Heading3 className="w-3.5 h-3.5" /></button>
              <button onClick={() => format("formatBlock", "<p>")} className="p-1.5 hover:bg-neutral-800 rounded text-xs font-bold text-neutral-300 hover:text-white" title="Parágrafo normal">P</button>
            </div>
          )}

          {/* Borderless Rich Text Document Body or PDF Viewer */}
          {data.render_mode === "PDF_VIEWER" ? (
            <div className="space-y-4">
              {editMode && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
                  <div className="flex items-center gap-2 text-amber-500">
                    <Layers className="w-5 h-5" />
                    <h4 className="text-sm font-black uppercase tracking-wider">Substituir Arquivo PDF (Nova Versão)</h4>
                  </div>
                  <p className="text-xs text-neutral-450 leading-relaxed">
                    Processos com renderização visual (PDF) são atualizados enviando um novo arquivo. Faça as alterações necessárias no seu documento original (ex: no Word), exporte como PDF e envie o arquivo atualizado abaixo.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-neutral-950/60 p-4 rounded-xl border border-neutral-900">
                    <label className="relative flex items-center justify-center px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-black uppercase rounded-lg cursor-pointer transition shadow-lg shadow-amber-500/10 shrink-0">
                      <span>Selecionar Arquivo PDF</span>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setNewPdfFile(file);
                            toast.success(`PDF "${file.name}" selecionado.`);
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </label>
                    
                    <div className="flex-1 min-w-0">
                      {newPdfFile ? (
                        <div className="text-xs font-bold text-amber-500 truncate">
                          ✓ {newPdfFile.name} ({(newPdfFile.size / 1024).toFixed(1)} KB)
                        </div>
                      ) : (
                        <div className="text-xs text-neutral-500 italic">
                          Nenhum novo arquivo selecionado. O PDF atual será mantido.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <PdfViewer
                url={newPdfFile ? URL.createObjectURL(newPdfFile) : (data.signed_file_url || "")}
                allowDownload={data.allow_download !== false}
                isEditor={data.is_editor}
                onReadComplete={() => setPdfReadComplete(true)}
              />
            </div>
          ) : (
            <div className="bg-white text-neutral-900 rounded-2xl shadow-xl p-8 lg:p-14 min-h-[600px] prose prose-sm max-w-none prose-headings:text-neutral-950 prose-headings:font-black prose-p:text-neutral-700 prose-p:leading-relaxed prose-li:text-neutral-700">
              <div
                ref={editorRef}
                contentEditable={editMode}
                suppressContentEditableWarning
                className="min-h-[500px] w-full focus:outline-none select-text borderless-editor"
                style={{ caretColor: "#d97706" }}
              />
            </div>
          )}
          
          <div className="flex justify-between items-center text-[10px] text-neutral-600 px-2">
            <span>Coffee Mais S/A — Confidencial</span>
            <span>ID: {data.id}</span>
          </div>

        </main>

        {/* Sidebar History & Confirmations (Right Area) */}
        <aside className="lg:col-span-3 flex flex-col gap-4">
          
          {/* Confirmação de Leitura Card */}
          <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider pb-2 border-b border-neutral-900 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Confirmação de Leitura
            </h3>
            
            {hasConfirmedRead ? (
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-[10px] text-emerald-300 leading-relaxed font-semibold">
                  Você já confirmou a leitura desta versão atual ({data.versao}) deste documento.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] text-neutral-400 leading-relaxed font-semibold">
                  A leitura deste documento é importante para fins de compliance e regulamento interno da empresa. Confirme abaixo que tomou ciência dos termos.
                </p>
                <button
                  onClick={handleConfirmRead}
                  disabled={confirmingRead || editMode || (data.render_mode === "PDF_VIEWER" && data.mandatory_read && !pdfReadComplete)}
                  className="w-full py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-neutral-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                >
                  {confirmingRead ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Confirmar Leitura
                </button>
                {data.render_mode === "PDF_VIEWER" && data.mandatory_read && !pdfReadComplete && (
                  <p className="text-[9px] text-amber-500/80 animate-pulse font-bold uppercase mt-1 text-center select-none">
                    Role até o fim do PDF para liberar a confirmação
                  </p>
                )}
              </div>
            )}

            {/* Read Stats button for managers (Admin/CEO/RH) */}
            {data.is_editor && readStats && (
              <div className="border-t border-neutral-900/60 pt-3">
                <div className="flex justify-between items-center text-[10px] text-neutral-400 mb-2 font-semibold">
                  <span>Adesão do Time:</span>
                  <span className="font-bold text-white">{readStats.adhesion_percent}%</span>
                </div>
                <div className="w-full bg-neutral-950 border border-neutral-900 rounded-full h-1.5 mb-3 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                    style={{ width: `${readStats.adhesion_percent}%` }}
                  />
                </div>
                
                <button
                  onClick={() => setShowStatsModal(true)}
                  className="w-full py-1.5 bg-neutral-950 hover:bg-neutral-900 border border-neutral-850 rounded-xl text-[10px] font-bold text-neutral-300 flex items-center justify-center gap-1.5 transition"
                >
                  <BarChart2 className="w-3.5 h-3.5 text-amber-500" />
                  Ver Relatório de Leitura
                </button>
              </div>
            )}
          </div>

          {/* Histórico de Versões Card */}
          <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider pb-2 border-b border-neutral-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500/80" />
              {data.render_mode === "PDF_VIEWER" ? "Histórico de Importação" : "Histórico de Versões"}
            </h3>
            
            <div className="flex flex-col gap-3.5 max-h-[300px] overflow-y-auto pr-1">
              {data.history.length === 0 ? (
                <span className="text-[10px] text-neutral-500 italic">Nenhum histórico registrado.</span>
              ) : (
                data.history.map((hist, idx) => (
                  <div 
                    key={hist.id} 
                    className="flex flex-col gap-1.5 p-3 rounded-xl bg-neutral-900 border border-neutral-850 hover:border-neutral-800 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-bold uppercase tracking-wider">{hist.versao}</span>
                      <span className="text-[9px] text-neutral-500" title={new Date(hist.created_at).toLocaleString("pt-BR")}>
                        {new Date(hist.created_at).toLocaleDateString("pt-BR")} às {new Date(hist.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    
                    <p className="text-[10px] text-neutral-300 font-semibold line-clamp-2 leading-relaxed">
                      {data.render_mode === "PDF_VIEWER" ? hist.change_log : `"${hist.change_log}"`}
                    </p>
                    
                    <div className="flex justify-between items-center mt-1 border-t border-neutral-900 pt-2 text-[8px] text-neutral-500 font-medium">
                      <span>Por: {hist.updated_by_name}</span>
                      {idx > 0 && data.render_mode !== "PDF_VIEWER" && (
                        <button
                          onClick={() => handleViewVersion(hist.conteudo_snapshot || "", hist.versao)}
                          className="text-amber-500 hover:text-amber-400 font-bold flex items-center gap-0.5 uppercase tracking-wide cursor-pointer"
                        >
                          <Eye className="w-2.5 h-2.5" />
                          Ver
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

      </div>

      {/* Save Draft Version Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-850 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-sm font-black uppercase text-amber-500 tracking-wider mb-4">Salvar Alterações de Versão</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-neutral-400 mb-1.5">O que foi alterado nesta versão? (Change Log)</label>
                <textarea
                  required
                  placeholder="Ex: Atualizado taxas de diárias para viagens interestaduais."
                  value={changeLog}
                  onChange={(e) => setChangeLog(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>

              <div className="p-3.5 bg-neutral-950 border border-neutral-900 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[10px] text-neutral-400 leading-relaxed font-medium">
                  Salvar criará uma nova versão incremental no sistema. A versão anterior ficará registrada na aba de Histórico de Versões para fins de auditoria de governança corporativa.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-neutral-850">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-850 rounded-xl text-xs font-bold text-neutral-400 transition"
                >
                  Voltar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-950 font-black rounded-xl text-xs transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirmar e Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reading Statistics Modal */}
      {showStatsModal && readStats && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-850 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowStatsModal(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-white text-sm"
            >
              ✕
            </button>
            <h2 className="text-sm font-black uppercase text-amber-500 tracking-wider mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Relatório de Adesão e Confirmações ({data.versao})
            </h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-900 text-center">
                <span className="text-[10px] text-neutral-500 uppercase font-bold block">Taxa de Adesão</span>
                <span className="text-xl font-black text-emerald-500 block mt-1">{readStats.adhesion_percent}%</span>
              </div>
              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-900 text-center">
                <span className="text-[10px] text-neutral-500 uppercase font-bold block">Confirmaram</span>
                <span className="text-xl font-black text-neutral-200 block mt-1">{readStats.total_read}</span>
              </div>
              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-900 text-center">
                <span className="text-[10px] text-neutral-500 uppercase font-bold block">Pendente</span>
                <span className="text-xl font-black text-neutral-500 block mt-1">{readStats.pending_list.length}</span>
              </div>
            </div>

            {/* List divided in two columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[350px] overflow-y-auto pr-1">
              <div>
                <h3 className="text-[11px] font-black uppercase text-emerald-500 tracking-wide mb-3 border-b border-emerald-950 pb-1 flex justify-between">
                  <span>Já Leram ({readStats.total_read})</span>
                  <span>🟢</span>
                </h3>
                {readStats.read_list.length === 0 ? (
                  <p className="text-[10px] text-neutral-600 italic">Nenhum registro ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {readStats.read_list.map(r => (
                      <div key={r.user_id} className="flex justify-between items-center p-2 bg-neutral-950/40 rounded-lg text-[10px] border border-neutral-900/60">
                        <span className="font-semibold text-neutral-200">{r.name}</span>
                        <span className="text-neutral-500 text-[9px]">{new Date(r.lido_em).toLocaleDateString("pt-BR")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-[11px] font-black uppercase text-amber-500 tracking-wide mb-3 border-b border-amber-950 pb-1 flex justify-between">
                  <span>Pendente ({readStats.pending_list.length})</span>
                  <span>⏳</span>
                </h3>
                {readStats.pending_list.length === 0 ? (
                  <p className="text-[10px] text-neutral-600 italic">Toda a equipe já efetuou a leitura!</p>
                ) : (
                  <div className="space-y-2">
                    {readStats.pending_list.map(p => (
                      <div key={p.user_id} className="flex justify-between items-center p-2 bg-neutral-950/40 rounded-lg text-[10px] border border-neutral-900/60">
                        <span className="font-semibold text-neutral-200">{p.name}</span>
                        <span className="px-1.5 py-0.5 bg-neutral-900 text-neutral-500 text-[8px] font-bold rounded uppercase">{p.role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-neutral-850">
              <button
                onClick={() => setShowStatsModal(false)}
                className="px-4 py-2 bg-neutral-950 hover:bg-neutral-900 border border-neutral-850 rounded-xl text-xs font-bold text-neutral-300 transition"
              >
                Fechar Relatório
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
