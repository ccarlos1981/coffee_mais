import React from "react";
import fs from "fs";
import path from "path";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { 
  BookOpen, 
  ArrowLeft, 
  FileText, 
  Search, 
  User, 
  GraduationCap,
  ShieldCheck, 
  TrendingUp, 
  ChevronRight,
  Sparkles,
  PlayCircle
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";

// GESTOR ROLES
const GESTOR_ROLES = ["Supervisor", "CEO", "Admin", "Trade"];

interface ManualConfig {
  key: string;
  title: string;
  filename: string;
  description: string;
  icon: any;
  color: string;
  roles: string[];
}

const AVAILABLE_MANUALS: ManualConfig[] = [
  {
    key: "promotor",
    title: "Manual do Promotor de Vendas",
    filename: "manual_promotor.md",
    description: "Instruções de campo, check-in, leitura por Shelf AI, precificação Price OCR e giro de estoque.",
    icon: User,
    color: "from-amber-600 to-amber-800",
    roles: ["Promotor", "Supervisor", "Trade", "Admin", "CEO"]
  },
  {
    key: "trade",
    title: "Manual de Trade & Operações",
    filename: "manual_trade_operacoes.md",
    description: "Gestão de equipe, parametrização de SLAs, análise de telemetria antifraude e aprovação de ocorrências.",
    icon: ShieldCheck,
    color: "from-blue-600 to-blue-800",
    roles: ["Supervisor", "Trade", "Admin", "CEO"]
  },
  {
    key: "investimento",
    title: "Manual de Investimentos Comerciais",
    filename: "manual_investimento.md",
    description: "Guia completo da esteira de auditoria de investimentos, desde o planejamento até o pagamento.",
    icon: FileText,
    color: "from-purple-600 to-purple-800",
    roles: ["Supervisor", "Trade", "Admin", "CEO"]
  },
  {
    key: "executivo",
    title: "Manual do Executivo Comercial",
    filename: "manual_executivo_comercial.md",
    description: "Análise de DRE, faturamento consolidado, simulador de trade e tomada de decisão preditiva.",
    icon: TrendingUp,
    color: "from-emerald-600 to-emerald-800",
    roles: ["CEO", "Admin"]
  }
];

// Custom Markdown Parser Function
function parseMarkdownToHtml(md: string): string {
  const lines = md.split("\n");
  const result: string[] = [];
  let inList = false;
  let listType: "ul" | "ol" | null = null;
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  let inNote = false;
  let noteLines: string[] = [];
  let noteType: "note" | "warning" | "important" | "tip" | "caution" = "note";
  let inImageFrame = false;
  let imageFrameLines: string[] = [];

  const closeList = () => {
    if (inList) {
      result.push(listType === "ul" ? "</ul>" : "</ol>");
      inList = false;
      listType = null;
    }
  };

  const closeTable = () => {
    if (inTable) {
      let tableHtml = `<div class="overflow-x-auto my-6 border border-neutral-800 rounded-xl bg-neutral-900/30">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-neutral-800 bg-neutral-900/60 font-bold text-neutral-200">`;
      tableHeaders.forEach(h => {
        tableHtml += `<th class="p-3 uppercase tracking-wider">${h}</th>`;
      });
      tableHtml += `</tr></thead><tbody class="divide-y divide-neutral-900">`;
      tableRows.forEach(row => {
        tableHtml += `<tr class="hover:bg-neutral-850/20 transition">`;
        row.forEach(cell => {
          tableHtml += `<td class="p-3 text-neutral-300 font-medium">${cell}</td>`;
        });
        tableHtml += `</tr>`;
      });
      tableHtml += `</tbody></table></div>`;
      result.push(tableHtml);
      inTable = false;
      tableHeaders = [];
      tableRows = [];
    }
  };

  const closeNote = () => {
    if (inNote) {
      const noteContent = noteLines.join(" ");
      const styles = {
        note: "bg-blue-950/20 border-blue-900/40 text-blue-300",
        warning: "bg-amber-950/20 border-amber-900/40 text-amber-300",
        important: "bg-red-950/20 border-red-900/40 text-red-300",
        tip: "bg-emerald-950/20 border-emerald-900/40 text-emerald-300",
        caution: "bg-rose-950/20 border-rose-900/40 text-rose-300"
      };
      const title = noteType.toUpperCase();
      result.push(`<div class="p-4 rounded-xl border border-neutral-800/80 my-5 ${styles[noteType]} flex flex-col gap-1.5">
        <span class="text-[10px] font-black tracking-wider uppercase">${title}</span>
        <div class="text-xs leading-relaxed font-medium">${noteContent}</div>
      </div>`);
      inNote = false;
      noteLines = [];
    }
  };

  const closeImageFrame = () => {
    if (inImageFrame) {
      const titleLine = imageFrameLines.find(l => l.includes("[IMAGEM"));
      const captionLine = imageFrameLines.find(l => l.includes("Legenda:"));
      const title = titleLine ? titleLine.replace(/[\[\]|]/g, "").trim() : "Visualização Técnica";
      const caption = captionLine ? captionLine.replace(/Legenda:|\|/g, "").trim() : "";
      
      result.push(`<div class="my-6 border border-neutral-850 bg-neutral-900/10 rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-3 shadow-lg select-none">
        <div class="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
        </div>
        <div class="text-xs font-bold text-neutral-200 uppercase">${title}</div>
        ${caption ? `<div class="text-[10px] text-neutral-500 italic max-w-md leading-relaxed">${caption}</div>` : ""}
      </div>`);
      inImageFrame = false;
      imageFrameLines = [];
    }
  };

  const parseInline = (text: string) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-neutral-100">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-neutral-300">$1</em>')
      .replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 font-mono text-[10px] text-amber-400">$1</code>');
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Image frame boundaries
    if (trimmed.startsWith("+---") && trimmed.endsWith("---+")) {
      if (inImageFrame) {
        closeImageFrame();
      } else {
        closeList(); closeTable(); closeNote();
        inImageFrame = true;
      }
      continue;
    }
    if (inImageFrame) {
      imageFrameLines.push(line);
      continue;
    }

    // Alert notes boundaries
    if (trimmed.startsWith("> [!")) {
      closeList(); closeTable(); closeImageFrame();
      inNote = true;
      const type = trimmed.substring(4, trimmed.length - 1).toLowerCase();
      noteType = ["note", "warning", "important", "tip", "caution"].includes(type) ? type as any : "note";
      continue;
    }
    if (inNote) {
      if (trimmed.startsWith(">")) {
        noteLines.push(parseInline(trimmed.substring(1).trim()));
        continue;
      } else {
        closeNote();
      }
    }

    // Tables
    if (trimmed.startsWith("|")) {
      closeList(); closeNote(); closeImageFrame();
      const cells = trimmed.split("|").map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (cells.every(c => c.startsWith("---") || c.startsWith(":---") || c.endsWith("---:"))) {
        continue;
      }
      if (!inTable) {
        inTable = true;
        tableHeaders = cells.map(parseInline);
      } else {
        tableRows.push(cells.map(parseInline));
      }
      continue;
    } else {
      closeTable();
    }

    // Headings
    if (trimmed.startsWith("#")) {
      closeList(); closeNote(); closeTable(); closeImageFrame();
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = parseInline(match[2].trim());
        if (level === 1) {
          result.push(`<h1 id="${encodeURIComponent(text)}" class="text-2xl font-black mt-8 mb-4 text-amber-500 uppercase tracking-wide border-b border-neutral-850 pb-2">${text}</h1>`);
        } else if (level === 2) {
          result.push(`<h2 id="${encodeURIComponent(text)}" class="text-lg font-bold mt-7 mb-3 text-neutral-200 border-b border-neutral-900 pb-1">${text}</h2>`);
        } else {
          result.push(`<h3 id="${encodeURIComponent(text)}" class="text-sm font-extrabold mt-6 mb-2 text-neutral-300">${text}</h3>`);
        }
      }
      continue;
    }

    // Unordered lists
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      closeNote(); closeTable(); closeImageFrame();
      const text = parseInline(trimmed.substring(2).trim());
      if (!inList || listType !== "ul") {
        closeList();
        result.push(`<ul class="list-disc pl-5 my-2.5 text-xs text-neutral-300 space-y-1">`);
        inList = true;
        listType = "ul";
      }
      result.push(`<li>${text}</li>`);
      continue;
    }

    // Ordered lists
    if (/^\d+\.\s+/.test(trimmed)) {
      closeNote(); closeTable(); closeImageFrame();
      const index = trimmed.indexOf(".");
      const text = parseInline(trimmed.substring(index + 1).trim());
      if (!inList || listType !== "ol") {
        closeList();
        result.push(`<ol class="list-decimal pl-5 my-2.5 text-xs text-neutral-300 space-y-1">`);
        inList = true;
        listType = "ol";
      }
      result.push(`<li>${text}</li>`);
      continue;
    }

    // Empty lines
    if (trimmed === "") {
      closeList();
      continue;
    }

    // Regular paragraphs
    closeList(); closeNote(); closeTable(); closeImageFrame();
    result.push(`<p class="text-xs leading-relaxed text-neutral-300 my-2.5">${parseInline(line.trim())}</p>`);
  }

  // Cleanup final blocks
  closeList(); closeNote(); closeTable(); closeImageFrame();

  return result.join("\n");
}

// Generate Table of Contents (TOC)
function generateToc(md: string) {
  const lines = md.split("\n");
  const toc: { id: string; text: string; level: number }[] = [];
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      const match = line.match(/^(#{1,3})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim().replace(/\*\*/g, "").replace(/\*/g, "");
        if (text.toLowerCase() === "sumário" || text.toLowerCase().includes("manual")) return;
        toc.push({
          id: encodeURIComponent(text),
          text,
          level
        });
      }
    }
  });

  return toc;
}

export default async function TreinamentoPage({
  searchParams
}: {
  searchParams: Promise<{ manual?: string }>
}) {
  const supabase = await createClient();
  
  // 1. Obter usuário logado
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Obter perfil do usuário
  const { data: profile } = await supabase
    .from("cm_user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role || "Vendedor";
  const userManuals = AVAILABLE_MANUALS.filter(m => m.roles.includes(role));

  const resolvedParams = await searchParams;
  const activeManualKey = resolvedParams.manual;

  if (activeManualKey) {
    const activeManual = userManuals.find(m => m.key === activeManualKey);
    if (!activeManual) {
      redirect("/treinamento");
    }

    // Load manual content
    const filepath = path.join(process.cwd(), "src/app/treinamento/manuais", activeManual.filename);
    let rawContent = "";
    try {
      rawContent = fs.readFileSync(filepath, "utf-8");
    } catch (e) {
      rawContent = "# Erro\nNão foi possível abrir o manual solicitado.";
    }

    const htmlContent = parseMarkdownToHtml(rawContent);
    const toc = generateToc(rawContent);

    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col font-sans">
        {/* Header */}
        <header className="p-4 border-b border-neutral-900 bg-neutral-900/40 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Link 
              href="/treinamento"
              className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-all flex items-center justify-center border border-transparent hover:border-neutral-700/50"
              title="Voltar ao Painel de Treinamento"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-sm font-extrabold text-amber-500 uppercase tracking-wider">{activeManual.title}</h1>
              <p className="text-[10px] text-neutral-400">Coffee Mais AI Platform — Onboarding Operacional</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
          {/* Sidebar TOC */}
          <aside className="lg:col-span-3 hidden lg:flex flex-col gap-4 sticky top-20 h-[calc(100vh-100px)] overflow-y-auto border-r border-neutral-900 pr-4">
            <div className="flex items-center gap-2 text-neutral-400 font-bold uppercase text-[10px] tracking-wider pb-2 border-b border-neutral-900">
              <BookOpen className="w-4 h-4 text-amber-500/80" />
              Índice do Artigo
            </div>
            <nav className="flex flex-col gap-2.5">
              {toc.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`text-[11px] font-semibold leading-normal transition-colors ${
                    item.level === 1
                      ? "text-neutral-200 hover:text-amber-400 uppercase tracking-wide text-[10px]"
                      : item.level === 2
                        ? "text-neutral-400 hover:text-white pl-3.5 border-l border-neutral-800"
                        : "text-neutral-500 hover:text-neutral-300 pl-6 border-l border-neutral-800"
                  }`}
                >
                  {item.text}
                </a>
              ))}
            </nav>
          </aside>

          {/* Article View */}
          <main className="lg:col-span-9 flex flex-col bg-neutral-900/10 border border-neutral-900 rounded-2xl p-6 lg:p-10 max-w-3xl">
            <article 
              className="prose prose-invert max-w-none prose-sm"
              dangerouslySetInnerHTML={{ __html: htmlContent }} 
            />
            
            <div className="mt-12 pt-6 border-t border-neutral-900 flex justify-between items-center">
              <span className="text-[10px] text-neutral-500">© 2026 Coffee Mais S.A. Todos os direitos reservados.</span>
              <Link 
                href="/treinamento"
                className="text-xs font-bold text-amber-500 hover:text-amber-400 transition"
              >
                Voltar ao Início
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Dashboard Page View
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col font-sans">
      {/* Header */}
      <header className="p-5 border-b border-neutral-900 bg-neutral-900/40 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Link 
            href="/"
            className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-all flex items-center justify-center border border-transparent hover:border-neutral-700/50"
            title="Voltar ao Menu Principal"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-extrabold uppercase tracking-wide text-amber-500">
              Central de Treinamento
            </h1>
            <p className="text-[10px] text-neutral-400 mt-0.5">
              Capacitação e Manuais Operacionais do Coffee Mais Campo
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Grid */}
      <main className="max-w-5xl mx-auto w-full p-6 lg:p-10 flex flex-col gap-8 flex-1">
        
        {/* Banner de Boas Vindas */}
        <div className="p-6 bg-gradient-to-br from-neutral-900 to-neutral-900/40 border border-neutral-900 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl" />
          <div className="space-y-1">
            <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded uppercase">
              Onboarding Ativo
            </span>
            <h2 className="text-lg font-bold text-neutral-100 mt-2">Bem-vindo, {role}!</h2>
            <p className="text-xs text-neutral-400 max-w-md leading-relaxed">
              Consulte os manuais abaixo para entender os processos de leitura de gôndolas por Inteligência Artificial, configuração de rotas e auditorias de conformidade.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="text-xs font-semibold text-neutral-400 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-850 flex items-center gap-1.5">
              <User className="w-4 h-4 text-amber-500/80" />
              Perfil: {role}
            </span>
          </div>
        </div>

        {/* Lista de Manuais */}
        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Manuais Disponíveis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {userManuals.map(m => {
              const IconComp = m.icon;
              return (
                <Link
                  key={m.key}
                  href={`/treinamento?manual=${m.key}`}
                  className="group bg-neutral-900/20 border border-neutral-900 rounded-2xl p-5 hover:border-amber-500/30 transition-all duration-300 flex flex-col justify-between gap-5 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-amber-600/0 via-amber-500/10 to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="space-y-3">
                    <span className={`p-2.5 bg-neutral-900 border border-neutral-850 rounded-xl w-fit flex items-center justify-center text-amber-500 group-hover:border-amber-500/20 transition-colors`}>
                      <IconComp className="w-5 h-5" />
                    </span>
                    <div>
                      <h4 className="text-sm font-extrabold text-neutral-100 group-hover:text-amber-500 transition-colors flex items-center gap-1">
                        {m.title}
                        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </h4>
                      <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{m.description}</p>
                    </div>
                  </div>
                  <div className="text-[10px] text-neutral-500 border-t border-neutral-900/60 pt-3 flex justify-between items-center">
                    <span>Vigente (Acesso Livre)</span>
                    <span className="font-bold text-[9px] uppercase tracking-wider text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">Ler Agora</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

      </main>
    </div>
  );
}
