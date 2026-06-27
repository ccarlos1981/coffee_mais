"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Lock, Mail, Eye, EyeOff, AlertCircle, Coffee, CheckCircle2 } from "lucide-react";
import { login } from "./actions";
import { ThemeToggle } from "@/components/ThemeProvider";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem("coffee-remembered-email");
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    
    if (val && !val.toLowerCase().endsWith("@coffeemais.com")) {
      setEmailError("Utilize seu e-mail corporativo (@coffeemais.com)");
    } else {
      setEmailError(null);
    }
  };

  async function handleSubmit(formData: FormData) {
    // Validação extra no cliente
    const emailVal = formData.get("email") as string;
    const rememberVal = formData.get("remember") === "on";

    if (!emailVal.trim().toLowerCase().endsWith("@coffeemais.com")) {
      setError("Este e-mail não faz parte da companhia. Utilize seu e-mail @coffeemais.com.");
      return;
    }

    if (rememberVal) {
      localStorage.setItem("coffee-remembered-email", emailVal.trim());
    } else {
      localStorage.removeItem("coffee-remembered-email");
    }

    setLoading(true);
    setError(null);
    const result = await login(formData);
    if (result?.error) {
      setError(
        result.error === "Invalid login credentials"
          ? "E-mail ou senha inválidos."
          : result.error
      );
      setLoading(false);
    }
  }

  // Verifica se o email digitado é corporativo válido para fins de feedback visual
  const isCorporateValid = email.toLowerCase().endsWith("@coffeemais.com");

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden font-sans">
      
      {/* ── PAINEL ESQUERDO: SHOWCASE PREMIUM (Desktop Only) ── */}
      <div className="hidden md:flex md:w-[42%] lg:w-[45%] xl:w-[48%] relative flex-col justify-between p-12 text-white bg-neutral-950 overflow-hidden border-r border-border-light">
        {/* Grain overlay */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none z-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
        {/* Subtle gradients */}
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-gold/10 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-emerald-800/10 blur-[120px] pointer-events-none" />

        {/* Header no painel */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-gold to-amber-700/80 shadow-md">
            <Coffee className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm tracking-tight text-neutral-100">
              Coffee<span className="text-gold font-sans font-medium">++</span>
            </h3>
            <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider -mt-1">
              Apuração de Resultados
            </p>
          </div>
        </div>

        {/* Conteúdo Central: Títulos e Cartões */}
        <div className="relative z-10 my-auto flex flex-col gap-8 max-w-md">
          <div>
            <span className="text-gold text-[10px] font-bold uppercase tracking-widest bg-gold/10 border border-gold/20 px-2.5 py-1 rounded-full w-fit">
              Cafés Especiais
            </span>
            <h2 className="font-display font-bold text-3xl lg:text-4xl xl:text-5xl leading-[1.15] text-neutral-100 tracking-tight mt-4">
              O aroma do café especial acompanha seus resultados.
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed mt-4">
              Acesse a plataforma de Business Intelligence para analisar faturamento, metas,
              comportamento de vendas e SLAs em tempo real.
            </p>
          </div>

          {/* 3D Showcase Deck */}
          <div className="relative w-full h-72 flex justify-center items-center mt-6 group select-none">
            {/* Card 1: Clássico Drip (Left, Rotated) */}
            <div className="absolute left-2 lg:left-6 transform -rotate-6 group-hover:-rotate-12 group-hover:-translate-x-4 -translate-y-2 group-hover:-translate-y-4 hover:scale-105 transition-all duration-300 z-10 w-32 lg:w-36 bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-2xl p-3 shadow-xl">
              <div className="relative w-full h-28">
                <Image
                  src="/images/login/classico_drip_transparent.png"
                  alt="Clássico Drip"
                  fill
                  sizes="(max-width: 768px) 100vw, 150px"
                  className="object-contain rounded-lg"
                />
              </div>
              <p className="text-[8px] text-gold font-bold uppercase tracking-wider mt-2">Drip Coffee</p>
              <h4 className="text-[11px] font-bold text-neutral-200 mt-0.5 font-display">Clássico Drip</h4>
            </div>

            {/* Card 2: Solos Vulcânicos (Center, Elevated) */}
            <div className="absolute z-20 transform group-hover:-translate-y-6 hover:scale-105 transition-all duration-300 w-36 lg:w-40 bg-neutral-900/90 backdrop-blur-md border border-gold/20 rounded-2xl p-3 shadow-2xl ring-1 ring-gold/10">
              <div className="absolute top-2 right-2 bg-gold text-[8px] text-neutral-950 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                100% Arábica
              </div>
              <div className="relative w-full h-32">
                <Image
                  src="/images/login/solos_vulcanicos_transparent.png"
                  alt="Solos Vulcânicos"
                  fill
                  sizes="(max-width: 768px) 100vw, 160px"
                  className="object-contain rounded-lg"
                />
              </div>
              <p className="text-[8px] text-gold font-bold uppercase tracking-wider mt-2">Café Especial</p>
              <h4 className="text-[11px] font-bold text-neutral-100 mt-0.5 font-display">Solos Vulcânicos</h4>
            </div>

            {/* Card 3: Intenso Grão (Right, Rotated) */}
            <div className="absolute right-2 lg:right-6 transform rotate-6 group-hover:rotate-12 group-hover:translate-x-4 -translate-y-2 group-hover:-translate-y-4 hover:scale-105 transition-all duration-300 z-10 w-32 lg:w-36 bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-2xl p-3 shadow-xl">
              <div className="relative w-full h-28">
                <Image
                  src="/images/login/intenso_grao_transparent.png"
                  alt="Intenso Grão"
                  fill
                  sizes="(max-width: 768px) 100vw, 150px"
                  className="object-contain rounded-lg"
                />
              </div>
              <p className="text-[8px] text-gold font-bold uppercase tracking-wider mt-2">Super Specialty</p>
              <h4 className="text-[11px] font-bold text-neutral-200 mt-0.5 font-display">Intenso Grão</h4>
            </div>
          </div>
        </div>

        {/* Footer no painel */}
        <div className="relative z-10 text-[10px] text-neutral-400 flex items-center justify-between border-t border-neutral-800/60 pt-4">
          <span>Origem Controlada</span>
          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
          <span>Pontuação Superior (80+)</span>
          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
          <span>Grãos Nobres</span>
        </div>
      </div>

      {/* ── PAINEL DIREITO: FORMULÁRIO DE LOGIN (Full Screen on Mobile) ── */}
      <div className="w-full md:w-[58%] lg:w-[55%] xl:w-[52%] flex flex-col justify-between p-8 md:p-12 lg:p-16 relative min-h-screen bg-background">
        
        {/* Theme Toggle no topo superior direito */}
        <div className="absolute top-6 right-6 z-30">
          <ThemeToggle />
        </div>

        {/* Spacer no topo */}
        <div className="hidden md:block" />

        {/* Formulário Central */}
        <div className="w-full max-w-[400px] mx-auto my-auto py-8">
          
          {/* Logo e Boas-vindas */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="mb-6 relative h-16 w-16 shadow-lg rounded-2xl overflow-hidden border border-neutral-800 ring-4 ring-neutral-900/5 dark:ring-white/5">
              <Image
                src="/images/login/logo_white.png"
                alt="Coffee Mais"
                fill
                sizes="64px"
                priority
                className="object-cover"
              />
            </div>
            
            <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
              Bem-vindo de volta
            </h1>
            <p className="text-xs text-muted mt-1.5">
              Entre com suas credenciais corporativas da Coffee++
            </p>
          </div>

          {/* Mensagem de Erro Geral */}
          {error && (
            <div className="flex items-center gap-3 p-3.5 mb-6 rounded-xl bg-accent-red/10 border border-accent-red/20 text-accent-red text-xs animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <form action={handleSubmit} className="space-y-5">
            {/* Input E-mail */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                E-mail Corporativo
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-muted pointer-events-none" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  required
                  autoComplete="email"
                  placeholder="nome@coffeemais.com"
                  className={`w-full pl-10 pr-10 py-3 bg-card border rounded-xl text-sm text-foreground outline-none transition-all placeholder:text-neutral-500
                    ${emailError ? "border-accent-red ring-1 ring-accent-red/10" : "border-border hover:border-neutral-500 focus:border-gold focus:ring-2 focus:ring-gold/15"}
                  `}
                />
                
                {/* Feedback visual de e-mail corporativo válido */}
                {isCorporateValid && (
                  <CheckCircle2 className="absolute right-3.5 w-4 h-4 text-emerald-500 animate-pop" />
                )}
              </div>
              
              {/* Feedback dinâmico do domínio corporativo */}
              {emailError && (
                <p className="text-[10px] text-accent-red font-medium pl-1 flex items-center gap-1 animate-fade-in">
                  <AlertCircle className="w-3 h-3" /> {emailError}
                </p>
              )}
            </div>

            {/* Input Senha */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                  Senha
                </label>
                <a
                  href="/esqueci-senha"
                  className="text-[10px] text-gold hover:text-gold/80 font-bold transition-colors"
                >
                  Esqueci minha senha
                </a>
              </div>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-4 h-4 text-muted pointer-events-none" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 bg-card border border-border hover:border-neutral-500 focus:border-gold focus:ring-2 focus:ring-gold/15 rounded-xl text-sm text-foreground outline-none transition-all placeholder:text-neutral-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 p-1 text-muted hover:text-foreground transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Lembrar-me Checkbox */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="remember"
                name="remember"
                defaultChecked
                className="w-4 h-4 rounded border-border text-gold focus:ring-gold/50 cursor-pointer accent-gold"
              />
              <label htmlFor="remember" className="ml-2 text-xs text-muted cursor-pointer select-none">
                Lembrar da minha sessão
              </label>
            </div>

            {/* Botão de Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-gold/10 hover:shadow-gold/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2
                ${loading ? "opacity-60 cursor-not-allowed transform-none" : ""}
              `}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Autenticando...</span>
                </>
              ) : (
                <span>Entrar no Sistema</span>
              )}
            </button>
          </form>

          {/* Link para Cadastro */}
          <div className="mt-8 text-center text-xs text-muted">
            Não possui credenciais?{" "}
            <a href="/cadastro" className="text-gold hover:text-gold/80 font-bold transition-colors">
              Solicitar Cadastro
            </a>
          </div>
        </div>

        {/* Footer Copyright */}
        <div className="w-full text-center text-[10px] text-dim flex flex-col sm:flex-row items-center justify-between border-t border-border/40 pt-6">
          <span>Coffee Mais © {new Date().getFullYear()}</span>
          <span className="mt-1 sm:mt-0">Apuração de Resultados • Versão 2.4.0</span>
        </div>
      </div>
    </div>
  );
}
