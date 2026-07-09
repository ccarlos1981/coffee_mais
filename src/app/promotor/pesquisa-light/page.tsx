"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  FileText, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle,
  User,
  Coffee,
  Building2,
  DollarSign,
  ChevronDown
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeProvider";
import { salvarPesquisaLight, obterRedesRecomendadas } from "./actions";
import { obterRedesMatrizes } from "@/app/investimento/lancar/actions";

export default function PesquisaLightPage() {
  const supabase = createClient();

  // Estados de controle de usuário e carregamento
  const [user, setUser] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Estados do formulário
  const [searchRede, setSearchRede] = useState("");
  const [isRedeOpen, setIsRedeOpen] = useState(false);
  const [selectedRede, setSelectedRede] = useState<{ codigo: string; nome: string; canal: string } | null>(null);
  const [redes, setRedes] = useState<Array<{ codigo: string; nome: string; canal: string }>>([]);
  const [recomendadas, setRecomendadas] = useState<Array<{ codigo: string; nome: string; canal: string }>>([]);
  const [ufPrincipal, setUfPrincipal] = useState<string | null>(null);
  const [precoFlat, setPrecoFlat] = useState("");
  const [tipoFlat, setTipoFlat] = useState<"Moído" | "Grão">("Moído");
  const [precoGourmet, setPrecoGourmet] = useState("");

  // Estados de envio e feedback
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const filteredRedes = redes.filter(r => 
    r.nome.toLowerCase().includes(searchRede.toLowerCase()) ||
    r.codigo.toLowerCase().includes(searchRede.toLowerCase())
  );

  useEffect(() => {
    async function loadUserDataAndRedes() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          window.location.href = "/login";
          return;
        }
        setUser(authUser);

        // Perfil Digital para identificar o promotor
        const { data: perfil } = await supabase
          .from("cm_promotor_perfil")
          .select("employee_id")
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (perfil) {
          const { data: emp } = await supabase
            .from("cm_employees")
            .select("id, nome_completo")
            .eq("id", perfil.employee_id)
            .maybeSingle();

          setEmployee(emp);
        }

        // Buscar UF no perfil do usuário
        const { data: userProfile } = await supabase
          .from("cm_user_profiles")
          .select("uf")
          .eq("id", authUser.id)
          .maybeSingle();

        let principalUf = null;
        if (userProfile?.uf) {
          const ufs = userProfile.uf.split(",").map((x: string) => x.trim().toUpperCase());
          if (ufs.length > 0 && ufs[0]) {
            principalUf = ufs[0];
            setUfPrincipal(principalUf);
          }
        }

        // Carregar redes da mesma fonte utilizada no módulo de investimentos
        const redesList = await obterRedesMatrizes();
        setRedes(redesList);

        // Carregar as 10 redes recomendadas (baseado no faturamento/estado)
        const topRedes = await obterRedesRecomendadas(principalUf);
        setRecomendadas(topRedes);
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    }
    loadUserDataAndRedes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      if (!selectedRede) {
        setErrorMsg("Por favor, selecione uma rede válida.");
        setSubmitting(false);
        return;
      }

      const pFlat = parseFloat(precoFlat.replace(",", "."));
      const pGourmet = parseFloat(precoGourmet.replace(",", "."));

      if (isNaN(pFlat) || pFlat <= 0) {
        setErrorMsg("Por favor, insira um preço Flat válido maior que zero.");
        setSubmitting(false);
        return;
      }

      if (isNaN(pGourmet) || pGourmet <= 0) {
        setErrorMsg("Por favor, insira um preço Gourmet válido maior que zero.");
        setSubmitting(false);
        return;
      }

      const result = await salvarPesquisaLight({
        rede: selectedRede.nome,
        codigoMatriz: selectedRede.codigo,
        precoFlat: pFlat,
        tipoFlat,
        precoGourmet: pGourmet
      });

      if (result?.success) {
        setSuccess(true);
        // Reset formulário
        setSelectedRede(null);
        setSearchRede("");
        setPrecoFlat("");
        setPrecoGourmet("");
        setTipoFlat("Moído");
      } else {
        setErrorMsg(result?.message || "Ocorreu um erro ao salvar a pesquisa.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro de conexão ao enviar a pesquisa.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSuccess(false);
    setErrorMsg("");
    setSelectedRede(null);
    setSearchRede("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RotateCw className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-neutral-400 text-sm">Carregando painel de pesquisa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col max-w-md mx-auto relative border-x border-neutral-900 shadow-2xl pb-6">
      {/* Header */}
      <header className="p-5 border-b border-neutral-900 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-30 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.location.href = "/"}
            className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-all flex items-center justify-center border border-transparent hover:border-neutral-700/50"
            title="Voltar ao Menu Principal"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div>
            <h1 className="text-lg font-extrabold bg-gradient-to-r from-amber-500 to-amber-200 bg-clip-text text-transparent">
              Coffee Mais Campo
            </h1>
            <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
              <FileText className="w-3.5 h-3.5 text-amber-500/80" />
              Pesquisa Light
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="w-8 h-8 bg-neutral-900 border border-neutral-800 rounded-lg flex items-center justify-center text-neutral-400" title={employee?.nome_completo || "Usuário"}>
            <User className="w-4 h-4" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-5 flex flex-col justify-center">
        {success ? (
          /* Success Screen */
          <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-900 text-center flex flex-col items-center gap-5 py-10 animate-fade-in">
            <div className="p-4 bg-emerald-500/10 rounded-full text-emerald-400">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-100">Pesquisa Registrada!</h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                Os dados foram gravados com sucesso e as notificações automáticas por e-mail foram disparadas.
              </p>
            </div>
            
            <div className="w-full flex flex-col gap-2 mt-2">
              <button
                onClick={handleReset}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs uppercase tracking-widest rounded-xl transition shadow-lg active:scale-98"
              >
                Nova Pesquisa
              </button>
              <Link
                href="/"
                className="w-full py-3 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 font-bold text-xs uppercase tracking-widest rounded-xl transition text-center"
              >
                Voltar ao Menu
              </Link>
            </div>
          </div>
        ) : (
          /* Form Screen */
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500 shrink-0">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Captura Rápida</h2>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Informe os preços praticados dos cafés Flat e Gourmet identificados na loja.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/40 text-red-300 text-xs flex gap-2 animate-pulse">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-5 bg-neutral-900/30 border border-neutral-900/60 rounded-2xl flex flex-col gap-4">
              
              {/* Campo: Rede */}
              <div className="flex flex-col gap-1.5 relative z-50">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-500/70" />
                  Rede
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Digite para buscar a rede..."
                    className="w-full bg-neutral-950 border border-neutral-900 focus:border-amber-500/40 rounded-xl p-3 pr-10 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none transition"
                    value={isRedeOpen ? searchRede : (selectedRede ? `${selectedRede.codigo} - ${selectedRede.nome}` : "")}
                    onChange={(e) => {
                      setSearchRede(e.target.value);
                      if (!isRedeOpen) setIsRedeOpen(true);
                    }}
                    onFocus={() => setIsRedeOpen(true)}
                    onBlur={() => setTimeout(() => setIsRedeOpen(false), 200)}
                  />
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                </div>

                {/* Sugestões Dinâmicas (Top 10) */}
                {recomendadas.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">
                      Sugestões {ufPrincipal ? `(${ufPrincipal})` : "(Nacional)"}
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
                      {recomendadas.map((r) => (
                        <button
                          key={r.codigo}
                          type="button"
                          onClick={() => {
                            setSelectedRede(r);
                            setSearchRede("");
                            setIsRedeOpen(false);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] text-neutral-400 transition cursor-pointer"
                        >
                          {r.nome}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isRedeOpen && (
                  <div className="absolute z-[999] w-full left-0 top-[calc(100%+4px)] max-h-60 overflow-auto bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl divide-y divide-neutral-800">
                    {filteredRedes.length > 0 ? (
                      filteredRedes.map(r => (
                        <button
                          key={r.codigo}
                          type="button"
                          className="w-full text-left px-4 py-3 text-sm text-neutral-100 hover:bg-amber-500/10 hover:text-amber-400 transition-colors flex items-center justify-between"
                          onClick={() => {
                            setSelectedRede(r);
                            setSearchRede("");
                            setIsRedeOpen(false);
                          }}
                        >
                          <div>
                            <span className="font-semibold text-amber-500 mr-2">{r.codigo}</span>
                            <span>{r.nome}</span>
                          </div>
                          <span className="text-xs text-neutral-500">({r.canal})</span>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-neutral-500 text-sm">Nenhuma rede encontrada.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Campo: Preço Flat */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-amber-500/70" />
                  Preço Flat
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-neutral-500 font-bold">R$</span>
                  <input
                    type="text"
                    required
                    inputMode="decimal"
                    value={precoFlat}
                    onChange={(e) => setPrecoFlat(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-neutral-950 border border-neutral-900 focus:border-amber-500/40 rounded-xl py-3 pl-9 pr-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none transition font-semibold"
                  />
                </div>

                {/* Tipo Flat Selection */}
                <div className="flex gap-2 mt-0.5">
                  <button
                    type="button"
                    onClick={() => setTipoFlat("Moído")}
                    className={`flex-1 py-2.5 rounded-xl border text-xs font-bold uppercase transition active:scale-98 ${
                      tipoFlat === "Moído" 
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/40" 
                        : "bg-neutral-950 text-neutral-500 border-neutral-900 hover:border-neutral-800"
                    }`}
                  >
                    Moído
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoFlat("Grão")}
                    className={`flex-1 py-2.5 rounded-xl border text-xs font-bold uppercase transition active:scale-98 ${
                      tipoFlat === "Grão" 
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/40" 
                        : "bg-neutral-950 text-neutral-500 border-neutral-900 hover:border-neutral-800"
                    }`}
                  >
                    Grão
                  </button>
                </div>
              </div>

              {/* Campo: Preço Gourmet */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-amber-500/70" />
                  Preço Gourmet
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-neutral-500 font-bold">R$</span>
                  <input
                    type="text"
                    required
                    inputMode="decimal"
                    value={precoGourmet}
                    onChange={(e) => setPrecoGourmet(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-neutral-950 border border-neutral-900 focus:border-amber-500/40 rounded-xl py-3 pl-9 pr-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none transition font-semibold"
                  />
                </div>
              </div>

              {/* Botão de Confirmação */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-950 font-black text-xs uppercase tracking-widest rounded-xl transition shadow-lg mt-4 active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <span>Confirmar Pesquisa</span>
                )}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
