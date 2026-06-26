"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Send, Coffee, Sparkles, ChevronDown, Database, ArrowLeft, Trash2,
  BarChart2, TrendingUp, PieChart as PieIcon,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Cell, LabelList,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  sql?: string;
  queryData?: Record<string, unknown>[];
  timestamp: Date;
  loading?: boolean;
}

type ChartType = "bar" | "line" | "hbar" | null;

// ── Chart detection helpers ────────────────────────────────────────────────────
const CURRENCY_KEYS = ["faturamento", "net_value", "valor", "receita", "total", "maco", "margem", "custo"];
const TIME_KEYS     = ["mes", "month", "data", "date", "ano_mes", "periodo", "semana"];
const LABEL_KEYS    = ["produto", "product", "rede", "cliente", "nome_parceiro", "manager", "canal", "channel",
                       "uf", "regional", "tipo_produto", "familia", "category", "name", "label"];

function detectChart(data: Record<string, unknown>[]): { type: ChartType; xKey: string; yKey: string; yLabel: string } {
  if (!data || data.length < 2) return { type: null, xKey: "", yKey: "", yLabel: "" };
  const keys = Object.keys(data[0]);

  const timeKey  = keys.find(k => TIME_KEYS.some(t => k.toLowerCase().includes(t)));
  const labelKey = keys.find(k => LABEL_KEYS.some(t => k.toLowerCase().includes(t)));
  const numKey   = keys.find(k => {
    const v = data[0][k];
    return typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)));
  });

  if (!numKey) return { type: null, xKey: "", yKey: "", yLabel: "" };

  const isCurrency = CURRENCY_KEYS.some(c => numKey.toLowerCase().includes(c));
  const yLabel = isCurrency ? "R$" : numKey;

  // Time series → line chart
  if (timeKey) return { type: "line", xKey: timeKey, yKey: numKey, yLabel };

  // Ranking (many rows, a label key) → horizontal bars
  if (labelKey && data.length >= 4) return { type: "hbar", xKey: labelKey, yKey: numKey, yLabel };

  // Few categories → vertical bar
  if (labelKey) return { type: "bar", xKey: labelKey, yKey: numKey, yLabel };

  return { type: null, xKey: "", yKey: "", yLabel: "" };
}

function normalizeNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  return 0;
}

function fmtValue(v: number, yLabel: string): string {
  if (yLabel === "R$") return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

const GOLD = "#d4a017";
const COLORS = ["#d4a017", "#4f87c4", "#6ecb63", "#e0634a", "#a77ded", "#45bfb0", "#f3a93c", "#e8607a"];

// ── Custom tooltip ─────────────────────────────────────────────────────────────
 
function ChartTooltip({ active, payload, label, yLabel }: any) {
  if (!active || !payload?.length) return null;
  const v = normalizeNum(payload[0]?.value);
  return (
    <div style={{ background: "rgba(15,20,40,0.95)", border: "1px solid rgba(212,160,23,0.3)",
      borderRadius: 8, padding: "8px 12px", fontSize: "0.8rem", color: "#e2e8f0" }}>
      <div style={{ color: GOLD, fontWeight: 700, marginBottom: 3 }}>{label}</div>
      <div>{fmtValue(v, yLabel)}</div>
    </div>
  );
}

// ── Inline chart component ─────────────────────────────────────────────────────
function InlineChart({ data, chartInfo }: {
  data: Record<string, unknown>[];
  chartInfo: { type: ChartType; xKey: string; yKey: string; yLabel: string };
}) {
  const { type, xKey, yKey, yLabel } = chartInfo;
  if (!type || !data.length) return null;

  const normalized = data.map((d, i) => ({
    ...d,
    __x: String(d[xKey] ?? ""),
    __y: normalizeNum(d[yKey]),
    __color: COLORS[i % COLORS.length],
  }));

  const gridStyle = { stroke: "rgba(255,255,255,0.06)" };
  const axisStyle = { fontSize: 11, fill: "rgba(255,255,255,0.45)", fontFamily: "inherit" };

  const icons: Record<NonNullable<ChartType>, React.ReactNode> = {
    bar:  <BarChart2 style={{ width: 13, height: 13 }} />,
    line: <TrendingUp style={{ width: 13, height: 13 }} />,
    hbar: <PieIcon style={{ width: 13, height: 13 }} />,
  };

  return (
    <div style={{
      marginTop: 12,
      background: "rgba(0,0,0,0.25)",
      borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.07)",
      overflow: "hidden",
    }}>
      {/* Chart header */}
      <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 6,
        borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: "0.7rem",
        color: "rgba(255,255,255,0.45)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        <span style={{ color: GOLD }}>{icons[type]}</span>
        {type === "line" ? "Evolução" : type === "hbar" ? "Ranking" : "Comparativo"}
      </div>

      <div style={{ padding: "16px 8px 8px" }}>
        {/* Vertical bar chart */}
        {type === "bar" && (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={normalized} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} {...gridStyle} />
              <XAxis dataKey="__x" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false}
                tickFormatter={v => fmtValue(v, yLabel)} width={60} />
              <Tooltip content={<ChartTooltip yLabel={yLabel} />} cursor={{ fill: "rgba(212,160,23,0.06)" }} />
              <Bar dataKey="__y" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {normalized.map((d, i) => <Cell key={i} fill={d.__color as string} />)}
                <LabelList dataKey="__y" position="top"
                  formatter={(v: unknown) => fmtValue(Number(v), yLabel)}
                  style={{ fontSize: 9, fill: "rgba(255,255,255,0.5)" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Line chart */}
        {type === "line" && (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={normalized} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} {...gridStyle} />
              <XAxis dataKey="__x" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false}
                tickFormatter={v => fmtValue(v, yLabel)} width={60} />
              <Tooltip content={<ChartTooltip yLabel={yLabel} />} />
              <Line dataKey="__y" stroke={GOLD} strokeWidth={2.5}
                dot={{ r: 3.5, fill: GOLD, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: GOLD }}
                isAnimationActive={true} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Horizontal bar chart (ranking) */}
        {type === "hbar" && (
          <div style={{ padding: "4px 8px" }}>
            {normalized.slice(0, 10).map((d, i) => {
              const max = Math.max(...normalized.map(r => r.__y as number));
              const pct = max > 0 ? ((d.__y as number) / max) * 100 : 0;
              return (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between",
                    fontSize: "0.72rem", marginBottom: 3, color: "rgba(255,255,255,0.7)" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      maxWidth: "60%", fontWeight: i < 3 ? 700 : 400 }}>
                      {i + 1}. {d.__x}
                    </span>
                    <span style={{ color: GOLD, fontWeight: 600 }}>{fmtValue(d.__y as number, yLabel)}</span>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${pct}%`, borderRadius: 3,
                      background: `linear-gradient(90deg, ${d.__color as string}, ${COLORS[(i + 2) % COLORS.length]})`,
                      transition: "width 0.8s ease-out",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function CoffeeIAPage() {
  const defaultWelcome: Message = {
    id: "welcome",
    role: "assistant",
    text: "Olá! ☕ Sou o **Coffee_IA**, seu assistente de dados.\n\nPode me perguntar qualquer coisa sobre as vendas, como:\n\n• _\"Qual o faturamento de março 2026?\"_\n• _\"Quais os 5 maiores clientes?\"_\n• _\"Evolução mensal do faturamento em 2026\"_\n• _\"Compare faturamento de fevereiro e março\"_\n\nPergunte à vontade!",
    timestamp: new Date(),
  };

  const [messages, setMessages] = useState<Message[]>([defaultWelcome]);
  const [input, setInput]       = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSql, setShowSql]   = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!isMounted) return;
    const saved = localStorage.getItem("coffee_ia_full_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
         
        parsed.forEach((m: any) => { m.timestamp = new Date(m.timestamp); });
        if (parsed.length > 0) setMessages(parsed);
      } catch { /* ignore */ }
    }
   
  }, [isMounted]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (isMounted) {
      localStorage.setItem("coffee_ia_full_history",
        JSON.stringify(messages.filter(m => !m.loading)));
    }
  }, [messages, isMounted]);

  const handleClearHistory = () => {
    if (window.confirm("Limpar todo o histórico de conversas?")) {
      setMessages([{ ...defaultWelcome, timestamp: new Date() }]);
      localStorage.removeItem("coffee_ia_full_history");
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message  = { id: Date.now().toString(), role: "user",  text, timestamp: new Date() };
    const loadMsg: Message  = { id: "loading",              role: "assistant", text: "", timestamp: new Date(), loading: true };

    setMessages(prev => [...prev, userMsg, loadMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const history = messages
        .filter(m => m.id !== "welcome" && !m.loading)
        .map(m => ({ role: m.role, text: m.text }));

      const res  = await fetch("/api/coffee-ia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();

      const assistantMsg: Message = {
        id:        (Date.now() + 1).toString(),
        role:      "assistant",
        text:      data.answer || data.error || "Não consegui processar.",
        sql:       data.sql,
        queryData: data.queryData,
        timestamp: new Date(),
      };

      setMessages(prev => prev.filter(m => m.id !== "loading").concat(assistantMsg));
    } catch {
      setMessages(prev =>
        prev.filter(m => m.id !== "loading").concat({
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: "Ops! Erro de conexão. Tente novamente.",
          timestamp: new Date(),
        })
      );
    }

    setIsLoading(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const renderText = (text: string) =>
    text.split("\n").map((line, i, arr) => {
      const html = line
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g,     "<em>$1</em>")
        .replace(/_(.*?)_/g,       "<em>$1</em>")
        .replace(/`(.*?)`/g, '<code style="background:rgba(0,0,0,0.15);padding:1px 5px;border-radius:3px;font-size:0.85em">$1</code>');
      const indented = html.startsWith("• ") || html.startsWith("- ")
        ? `<span style="margin-left:8px">${html}</span>` : html;
      return (
        <span key={i}>
          <span dangerouslySetInnerHTML={{ __html: indented }} />
          {i < arr.length - 1 && <br />}
        </span>
      );
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh",
      background: "var(--background)", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>

      {/* Header */}
      <header style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        padding: "12px 20px", display: "flex", alignItems: "center", gap: 14,
        borderBottom: "1px solid rgba(255,255,255,0.05)", zIndex: 10 }}>
        <Link href="/" style={{ color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center" }}>
          <ArrowLeft style={{ width: 20, height: 20 }} />
        </Link>
        <div style={{ width: 42, height: 42, borderRadius: "50%",
          background: "linear-gradient(135deg, #b8860b 0%, #daa520 50%, #f4c430 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 12px rgba(184,134,11,0.35)" }}>
          <Coffee style={{ width: 22, height: 22, color: "#fff" }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "0.01em" }}>
            Coffee_IA
          </h1>
          <p style={{ fontSize: "0.72rem", color: isLoading ? "#5fe880" : "rgba(255,255,255,0.5)",
            margin: 0, display: "flex", alignItems: "center", gap: 5 }}>
            {isLoading ? (
              <><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5fe880",
                animation: "pulse 1.4s infinite", display: "inline-block" }} />analisando dados...</>
            ) : (
              <><Sparkles style={{ width: 11, height: 11 }} />Assistente inteligente de dados</>
            )}
          </p>
        </div>
        {messages.length > 1 && (
          <button onClick={handleClearHistory} title="Limpar Histórico"
            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
              color: "#ef4444", borderRadius: "50%", width: 34, height: 34,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Trash2 style={{ width: 14, height: 14 }} />
          </button>
        )}
      </header>

      {/* Chat Area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px",
        background: "linear-gradient(180deg, #0d0d1a 0%, #111827 50%, #0f172a 100%)",
        backgroundImage: `
          radial-gradient(circle at 20% 80%, rgba(184,134,11,0.03) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(30,64,120,0.05) 0%, transparent 50%)
        ` }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          {messages.map((msg) => {
            // Detect chart for assistant messages with data
            const chartInfo = msg.role === "assistant" && msg.queryData
              ? detectChart(msg.queryData)
              : { type: null as ChartType, xKey: "", yKey: "", yLabel: "" };

            return (
              <div key={msg.id} style={{ display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 12, animation: "fadeSlideUp 0.3s ease-out" }}>
                <div style={{
                  maxWidth: chartInfo.type ? "95%" : "85%",
                  width: chartInfo.type ? "min(95%, 680px)" : undefined,
                  padding: msg.loading ? "14px 24px" : "10px 14px",
                  borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: msg.role === "user"
                    ? "linear-gradient(135deg, #b8860b, #d4a017)"
                    : "rgba(30, 41, 59, 0.85)",
                  color: msg.role === "user" ? "#fff" : "#e2e8f0",
                  fontSize: "0.9rem", lineHeight: 1.55,
                  boxShadow: msg.role === "user"
                    ? "0 2px 8px rgba(184,134,11,0.25)"
                    : "0 1px 4px rgba(0,0,0,0.2)",
                  border: msg.role === "assistant" ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}>
                  {msg.loading ? (
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      {[0, 1, 2].map(i => (
                        <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#b8860b",
                          animation: `bounce 1.4s infinite ${i * 0.2}s`, opacity: 0.7, display: "inline-block" }} />
                      ))}
                    </div>
                  ) : (
                    <>
                      <div>{renderText(msg.text)}</div>

                      {/* ── Inline Chart ── */}
                      {chartInfo.type && msg.queryData && (
                        <InlineChart data={msg.queryData} chartInfo={chartInfo} />
                      )}

                      {/* Footer: time + SQL button */}
                      <div style={{ display: "flex", justifyContent: "space-between",
                        alignItems: "center", marginTop: 6, gap: 10 }}>
                        <span style={{ fontSize: "0.65rem", opacity: 0.5 }}>
                          {formatTime(msg.timestamp)}
                        </span>
                        {msg.sql && (
                          <button onClick={() => setShowSql(showSql === msg.id ? null : msg.id)}
                            style={{ fontSize: "0.65rem", color: "#b8860b",
                              background: "rgba(184,134,11,0.1)", border: "1px solid rgba(184,134,11,0.2)",
                              borderRadius: 6, padding: "2px 8px", cursor: "pointer",
                              display: "flex", alignItems: "center", gap: 4 }}>
                            <Database style={{ width: 10, height: 10 }} />
                            SQL
                            <ChevronDown style={{ width: 10, height: 10,
                              transform: showSql === msg.id ? "rotate(180deg)" : "none",
                              transition: "transform 0.2s" }} />
                          </button>
                        )}
                      </div>
                      {showSql === msg.id && msg.sql && (
                        <pre style={{ marginTop: 8, padding: 10, background: "rgba(0,0,0,0.3)",
                          borderRadius: 8, fontSize: "0.75rem", color: "#a5b4fc",
                          overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
                          border: "1px solid rgba(165,180,252,0.1)" }}>
                          {msg.sql}
                        </pre>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div style={{ padding: "12px 16px 16px",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre seus dados..."
            rows={1}
            style={{ flex: 1, padding: "12px 16px", borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)", color: "#e2e8f0",
              fontSize: "0.92rem", resize: "none", outline: "none",
              maxHeight: 120, lineHeight: 1.4, fontFamily: "inherit",
              transition: "border-color 0.2s, background 0.2s" }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(184,134,11,0.4)";
              e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          />
          <button onClick={sendMessage} disabled={!input.trim() || isLoading}
            style={{ width: 46, height: 46, borderRadius: "50%", border: "none", flexShrink: 0,
              background: input.trim() && !isLoading
                ? "linear-gradient(135deg, #b8860b, #daa520)"
                : "rgba(255,255,255,0.08)",
              color: input.trim() && !isLoading ? "#fff" : "rgba(255,255,255,0.3)",
              cursor: input.trim() && !isLoading ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
              boxShadow: input.trim() && !isLoading ? "0 2px 12px rgba(184,134,11,0.3)" : "none" }}>
            <Send style={{ width: 20, height: 20 }} />
          </button>
        </div>
      </div>

      {/* Animations */}
      <style jsx global>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-8px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
