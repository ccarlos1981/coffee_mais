"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Mail, Plus, Trash2, Home, BarChart3, Bell, ArrowLeft, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";

interface Recipient {
  id: string;
  email: string;
  name: string;
  active: boolean;
}

export default function ConfigEmailsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [emails, setEmails] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/emails');
      const json = await res.json();
      if (json.success) setEmails(json.emails);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;
    
    setAdding(true);
    try {
      const res = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, email: newEmail })
      });
      if (res.ok) {
        setNewName("");
        setNewEmail("");
        fetchEmails();
      }
    } catch (e) {
      console.error(e);
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este email da lista VIP?")) return;
    try {
      await fetch(`/api/emails?id=${id}`, { method: 'DELETE' });
      setEmails(emails.filter(e => e.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="glass-card p-8 w-full max-w-sm text-center relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-amber-500/5 z-0" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 mb-6 shadow-lg shadow-violet-500/30">
              <Mail className="w-6 h-6 text-white" />
            </div>
            
            <h2 className="text-xl font-bold text-foreground mb-2">Acesso Restrito</h2>
            <p className="text-sm text-muted mb-6">Por favor, digite a senha para acessar a lista de emails.</p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (passwordInput === "123456") {
                setIsAuthenticated(true);
                setError(null);
              } else {
                setError("Senha incorreta");
              }
            }} className="w-full flex flex-col gap-4">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Senha"
                className="w-full bg-background border border-border-light rounded-xl px-4 py-3 text-center tracking-widest text-foreground placeholder:tracking-normal placeholder:text-dim focus:outline-none focus:border-violet-500"
                autoFocus
              />
              
              {error && <p className="text-xs text-red-400 -mt-2">{error}</p>}
              
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white font-medium transition-all shadow-lg shadow-violet-500/20"
              >
                Acessar
              </button>
            </form>

            <Link href="/" className="mt-8 flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Voltar ao Menu Inicial
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", paddingBottom: 80 }}>
      {/* NAVBAR */}
      <nav className="cm-navbar">
        <Link href="/" className="cm-logo">Coffee<span>++</span></Link>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center" }}>
          <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--foreground)" }}>Lista de Relatórios</h1>
          <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)" }}>Destinatários do PDF</p>
        </div>
        <div className="cm-nav-right">
          <ThemeToggle />
        </div>
      </nav>

      <main style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        {/* ADD FORM */}
        <div className="glass-card" style={{ padding: 20, marginBottom: 24, background: "var(--card-bg)" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Mail size={18} color="var(--accent-gold)" /> Adicionar Gestor (VIP)
          </h2>
          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input 
              type="text" 
              placeholder="Nome do Gestor (Ex: Marcos Silva)" 
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="dash-filter-select"
              style={{ width: "100%", padding: 12 }}
              required
            />
            <input 
              type="email" 
              placeholder="Email Oficial" 
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="dash-filter-select"
              style={{ width: "100%", padding: 12 }}
              required
            />
            <button 
              type="submit" 
              disabled={adding}
              style={{ padding: 12, background: "var(--accent-gold)", color: "#000", fontWeight: 'bold', border: 'none', borderRadius: 8, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}
            >
              {adding ? "Adicionando..." : <><Plus size={18}/> Salvar Destinatário</>}
            </button>
          </form>
        </div>

        {/* LIST */}
        <h3 style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "var(--foreground-muted)", marginBottom: 12, letterSpacing: 1 }}>
          Emails Cadastrados ({emails.length})
        </h3>

        {loading ? (
           <p style={{ textAlign: "center", padding: 20 }}>Carregando...</p>
        ) : emails.length === 0 ? (
           <p style={{ textAlign: "center", padding: 20, color: "var(--foreground-muted)" }}>Nenhum diretor na lista ainda.</p>
        ) : (
           <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {emails.map(emp => (
                <div key={emp.id} className="glass-card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                   <div>
                      <p style={{ fontWeight: 700, fontSize: "1rem" }}>{emp.name}</p>
                      <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Mail size={12} /> {emp.email}
                      </p>
                   </div>
                   <button 
                     onClick={() => handleDelete(emp.id)}
                     style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", border: "none", padding: 8, borderRadius: 8, display: "flex", alignItems: "center" }}
                   >
                     <Trash2 size={18} />
                   </button>
                </div>
              ))}
           </div>
        )}
      </main>

      {/* BOTTOM NAVIGATION REUSE */}
      <nav className="bottom-tabs" style={{ position: "fixed", bottom: 0, width: "100%", zIndex: 10 }}>
        <Link href="/" className="bottom-tab"><ArrowLeft className="bottom-tab-icon" /> Voltar</Link>
        <Link href="/vendas" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Vendas</Link>
        <Link href="/alertas" className="bottom-tab"><Bell className="bottom-tab-icon" /> Alertas</Link>
      </nav>
    </div>
  );
}
