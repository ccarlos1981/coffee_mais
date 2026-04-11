"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Send,
  Coffee,
  Sparkles,
  ChevronDown,
  Database,
  ArrowLeft,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  sql?: string;
  timestamp: Date;
  loading?: boolean;
}

export default function CoffeeIAPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Olá! ☕ Sou o **Coffee_IA**, seu assistente de dados.\n\nPode me perguntar qualquer coisa sobre as vendas, como:\n\n• _\"Qual o faturamento de março 2026?\"_\n• _\"Quais os 5 maiores clientes?\"_\n• _\"Qual o produto mais vendido?\"_\n• _\"Compare faturamento de fevereiro e março\"_\n\nPergunte à vontade!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSql, setShowSql] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text,
      timestamp: new Date(),
    };

    const loadingMsg: Message = {
      id: "loading",
      role: "assistant",
      text: "",
      timestamp: new Date(),
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== "welcome" && !m.loading)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch("/api/coffee-ia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      const data = await res.json();

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: data.answer || data.error || "Não consegui processar.",
        sql: data.sql,
        timestamp: new Date(),
      };

      setMessages((prev) =>
        prev.filter((m) => m.id !== "loading").concat(assistantMsg)
      );
    } catch {
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== "loading")
          .concat({
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // Simple markdown-ish rendering
  const renderText = (text: string) => {
    return text.split("\n").map((line, i) => {
      let html = line
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/_(.*?)_/g, "<em>$1</em>")
        .replace(/`(.*?)`/g, '<code style="background:rgba(0,0,0,0.15);padding:1px 5px;border-radius:3px;font-size:0.85em">$1</code>');
      // bullet points
      if (html.startsWith("• ") || html.startsWith("- ")) {
        html = `<span style="margin-left:8px">${html}</span>`;
      }
      return (
        <span key={i}>
          <span dangerouslySetInnerHTML={{ __html: html }} />
          {i < text.split("\n").length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--background)",
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          zIndex: 10,
        }}
      >
        <Link
          href="/"
          style={{
            color: "rgba(255,255,255,0.6)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <ArrowLeft style={{ width: 20, height: 20 }} />
        </Link>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, #b8860b 0%, #daa520 50%, #f4c430 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 12px rgba(184,134,11,0.35)",
          }}
        >
          <Coffee style={{ width: 22, height: 22, color: "#fff" }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "#fff",
              margin: 0,
              letterSpacing: "0.01em",
            }}
          >
            Coffee_IA
          </h1>
          <p
            style={{
              fontSize: "0.72rem",
              color: isLoading ? "#5fe880" : "rgba(255,255,255,0.5)",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {isLoading ? (
              <>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#5fe880",
                    animation: "pulse 1.4s infinite",
                  }}
                />
                analisando dados...
              </>
            ) : (
              <>
                <Sparkles style={{ width: 11, height: 11 }} />
                Assistente inteligente de dados
              </>
            )}
          </p>
        </div>
      </header>

      {/* Chat Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 16px",
          background:
            "linear-gradient(180deg, #0d0d1a 0%, #111827 50%, #0f172a 100%)",
          backgroundImage: `
            radial-gradient(circle at 20% 80%, rgba(184,134,11,0.03) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(30,64,120,0.05) 0%, transparent 50%)
          `,
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                justifyContent:
                  msg.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 12,
                animation: "fadeSlideUp 0.3s ease-out",
              }}
            >
              <div
                style={{
                  maxWidth: "85%",
                  padding: msg.loading ? "14px 24px" : "10px 14px",
                  borderRadius:
                    msg.role === "user"
                      ? "16px 16px 4px 16px"
                      : "16px 16px 16px 4px",
                  background:
                    msg.role === "user"
                      ? "linear-gradient(135deg, #b8860b, #d4a017)"
                      : "rgba(30, 41, 59, 0.85)",
                  color: msg.role === "user" ? "#fff" : "#e2e8f0",
                  fontSize: "0.9rem",
                  lineHeight: 1.55,
                  boxShadow:
                    msg.role === "user"
                      ? "0 2px 8px rgba(184,134,11,0.25)"
                      : "0 1px 4px rgba(0,0,0,0.2)",
                  border:
                    msg.role === "assistant"
                      ? "1px solid rgba(255,255,255,0.06)"
                      : "none",
                  position: "relative",
                }}
              >
                {msg.loading ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 5,
                      alignItems: "center",
                    }}
                  >
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#b8860b",
                          animation: `bounce 1.4s infinite ${i * 0.2}s`,
                          opacity: 0.7,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <>
                    <div>{renderText(msg.text)}</div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 6,
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.65rem",
                          opacity: 0.5,
                        }}
                      >
                        {formatTime(msg.timestamp)}
                      </span>
                      {msg.sql && (
                        <button
                          onClick={() =>
                            setShowSql(
                              showSql === msg.id ? null : msg.id
                            )
                          }
                          style={{
                            fontSize: "0.65rem",
                            color: "#b8860b",
                            background: "rgba(184,134,11,0.1)",
                            border: "1px solid rgba(184,134,11,0.2)",
                            borderRadius: 6,
                            padding: "2px 8px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Database style={{ width: 10, height: 10 }} />
                          SQL
                          <ChevronDown
                            style={{
                              width: 10,
                              height: 10,
                              transform:
                                showSql === msg.id
                                  ? "rotate(180deg)"
                                  : "none",
                              transition: "transform 0.2s",
                            }}
                          />
                        </button>
                      )}
                    </div>
                    {showSql === msg.id && msg.sql && (
                      <pre
                        style={{
                          marginTop: 8,
                          padding: 10,
                          background: "rgba(0,0,0,0.3)",
                          borderRadius: 8,
                          fontSize: "0.75rem",
                          color: "#a5b4fc",
                          overflow: "auto",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                          border: "1px solid rgba(165,180,252,0.1)",
                        }}
                      >
                        {msg.sql}
                      </pre>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div
        style={{
          padding: "12px 16px 16px",
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div
          style={{
            maxWidth: 800,
            margin: "0 auto",
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre seus dados..."
            rows={1}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              color: "#e2e8f0",
              fontSize: "0.92rem",
              resize: "none",
              outline: "none",
              maxHeight: 120,
              lineHeight: 1.4,
              fontFamily: "inherit",
              transition: "border-color 0.2s, background 0.2s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(184,134,11,0.4)";
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              border: "none",
              background:
                input.trim() && !isLoading
                  ? "linear-gradient(135deg, #b8860b, #daa520)"
                  : "rgba(255,255,255,0.08)",
              color: input.trim() && !isLoading ? "#fff" : "rgba(255,255,255,0.3)",
              cursor: input.trim() && !isLoading ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
              flexShrink: 0,
              boxShadow:
                input.trim() && !isLoading
                  ? "0 2px 12px rgba(184,134,11,0.3)"
                  : "none",
            }}
          >
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
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
