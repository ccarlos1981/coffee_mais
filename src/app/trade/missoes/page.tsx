"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Calendar,
  Layers,
  CheckCircle,
  Clock,
  Briefcase,
  AlertCircle,
  RotateCw,
  Sliders,
  Store,
  UserCheck,
  ArrowLeft
} from "lucide-react";

export default function TradeMissoesPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [missoes, setMissoes] = useState<any[]>([]);
  const [promotores, setPromotores] = useState<any[]>([]);
  const [pdvs, setPdvs] = useState<any[]>([]);

  // Estado do formulário de criação
  const [showCriarModal, setShowCriarModal] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [slaMinutos, setSlaMinutos] = useState("30");
  const [prioridade, setPrioridade] = useState("50");
  
  // Checklist dinâmico: lista de campos
  const [camposChecklist, setCamposChecklist] = useState<any[]>([
    { name: "exposicao_correta", label: "Produto exposto corretamente na gôndola?", type: "boolean" }
  ]);
  const [novoCampoLabel, setNovoCampoLabel] = useState("");
  const [novoCampoType, setNovoCampoType] = useState("boolean");

  // Distribuição
  const [selectedPdvs, setSelectedPdvs] = useState<string[]>([]);
  const [selectedPromotores, setSelectedPromotores] = useState<Record<string, string>>({}); // cod_parceiro -> promotor_id

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [btnLoading, setBtnLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // 1. Carregar missões cadastradas
      const { data: m, error: mError } = await supabase
        .from("cm_trade_missao")
        .select("*")
        .order("created_at", { ascending: false });

      if (mError) throw mError;
      setMissoes(m || []);

      // 2. Carregar promotores ativos (vinculados a perfis de promotor)
      const { data: perfis } = await supabase
        .from("cm_promotor_perfil")
        .select("employee_id");

      const employeeIds = perfis?.map(p => p.employee_id) || [];
      if (employeeIds.length > 0) {
        const { data: emps } = await supabase
          .from("cm_employees")
          .select("id, nome_completo")
          .in("id", employeeIds)
          .eq("ativo", true);
        setPromotores(emps || []);
      }

      // 3. Carregar PDVs cadastrados na base de atendimento
      const { data: lojas } = await supabase
        .from("base_atendimento")
        .select("cod_parceiro, nome_fantasia, cidade, uf")
        .limit(100); // Traz os primeiros 100 PDVs
      setPdvs(lojas || []);

    } catch (err: any) {
      console.error("Erro ao carregar dados de trade:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCampo = () => {
    if (!novoCampoLabel) return;
    const name = novoCampoLabel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_");
    setCamposChecklist([...camposChecklist, { name, label: novoCampoLabel, type: novoCampoType }]);
    setNovoCampoLabel("");
  };

  const handleRemoveCampo = (index: number) => {
    setCamposChecklist(camposChecklist.filter((_, i) => i !== index));
  };

  const togglePdvSelection = (codParceiro: string) => {
    if (selectedPdvs.includes(codParceiro)) {
      setSelectedPdvs(selectedPdvs.filter(id => id !== codParceiro));
      const newSelProms = { ...selectedPromotores };
      delete newSelProms[codParceiro];
      setSelectedPromotores(newSelProms);
    } else {
      setSelectedPdvs([...selectedPdvs, codParceiro]);
    }
  };

  const handleSelectPromotor = (codParceiro: string, promId: string) => {
    setSelectedPromotores(prev => ({ ...prev, [codParceiro]: promId }));
  };

  const handleSalvarMissao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !dataInicio || !dataFim || selectedPdvs.length === 0) {
      setFeedback({ type: "error", message: "Preencha o título, vigência e selecione ao menos uma loja." });
      return;
    }

    setBtnLoading(true);
    setFeedback(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Criar Missão
      const schema = { fields: camposChecklist };
      const { data: novaMissao, error: createError } = await supabase
        .from("cm_trade_missao")
        .insert({
          titulo,
          descricao,
          data_inicio: dataInicio,
          data_fim: dataFim,
          sla_minutos: parseInt(slaMinutos),
          prioridade: parseInt(prioridade),
          checklist_schema: schema,
          created_by: user?.id
        })
        .select()
        .single();

      if (createError) throw createError;

      // 2. Mapear para PDVs / Promotores selecionados
      const mapeamento = selectedPdvs.map(cod => ({
        missao_id: novaMissao.id,
        cod_parceiro: cod,
        promotor_id: selectedPromotores[cod] || null, // Vínculo direto de promotor ou nulo para auto-assumir na rota
        status: "PENDENTE"
      }));

      const { error: mapError } = await supabase
        .from("cm_trade_missao_pdv")
        .insert(mapeamento);

      if (mapError) throw mapError;

      setFeedback({ type: "success", message: "Missão criada e distribuída com sucesso!" });
      setShowCriarModal(false);
      
      // Limpar formulário
      setTitulo("");
      setDescricao("");
      setSlaMinutos("30");
      setPrioridade("50");
      setSelectedPdvs([]);
      setSelectedPromotores({});
      
      loadData();
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: "error", message: err.message || "Erro ao salvar missão." });
    } finally {
      setBtnLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <RotateCw className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 lg:p-10 font-sans">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        
        {/* Back Button */}
        <Link 
          href="/" 
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors font-medium text-sm w-fit cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Painel
        </Link>

        {/* Top Header */}
        <div className="flex justify-between items-center bg-neutral-900/40 p-6 rounded-2xl border border-neutral-900">
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-amber-500 to-amber-200 bg-clip-text text-transparent">
              Painel de Trade Marketing
            </h1>
            <p className="text-xs text-neutral-400 mt-1">Criação, priorização e distribuição de missões táticas para promotores.</p>
          </div>
          <button
            onClick={() => setShowCriarModal(true)}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            Nova Missão Dinâmica
          </button>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div className={`p-4 rounded-xl border flex gap-3 items-center text-sm ${
            feedback.type === "success" ? "bg-emerald-950/40 border-emerald-900/50 text-emerald-300" : "bg-red-950/40 border-red-900/50 text-red-300"
          }`}>
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{feedback.message}</p>
          </div>
        )}

        {/* Missões Recentes */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-400">Missões Ativas / Recentes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {missoes.length === 0 ? (
              <p className="text-xs text-neutral-500 py-6">Nenhuma missão tática cadastrada.</p>
            ) : (
              missoes.map(m => (
                <div key={m.id} className="p-5 bg-neutral-900/30 rounded-2xl border border-neutral-900 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-900/30 px-2 py-0.5 rounded font-black">
                      PRIORIDADE {m.prioridade}/100
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      SLA: {m.sla_minutos} min
                    </span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-neutral-100">{m.titulo}</h3>
                    <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">{m.descricao}</p>
                  </div>
                  <div className="pt-3 border-t border-neutral-900/80 flex items-center justify-between text-[10px] text-neutral-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-500/70" />
                      {new Date(m.data_inicio).toLocaleDateString("pt-BR")} a {new Date(m.data_fim).toLocaleDateString("pt-BR")}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {m.checklist_schema?.fields?.length || 0} perguntas
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* MODAL DE CRIAÇÃO E DISTRIBUIÇÃO */}
        {showCriarModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-850 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
              
              <header className="p-5 border-b border-neutral-850 bg-neutral-900 flex justify-between items-center">
                <h2 className="text-base font-extrabold text-amber-500 uppercase tracking-wider">Criar Missão de Trade Marketing</h2>
                <button onClick={() => setShowCriarModal(false)} className="text-xs text-neutral-400 hover:text-white font-bold">
                  Fechar
                </button>
              </header>

              <form onSubmit={handleSalvarMissao} className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6">
                
                {/* Coluna 1: Informações Gerais */}
                <div className="flex-1 flex flex-col gap-4">
                  <h3 className="text-xs font-black uppercase text-neutral-400 border-b border-neutral-850 pb-1">1. Dados Básicos</h3>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-neutral-300 uppercase">Título da Missão</label>
                    <input
                      type="text"
                      required
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Ex: Auditoria de Ponta de Gôndola Coffee Mais Menta"
                      className="text-xs bg-neutral-950 border border-neutral-850 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-neutral-300 uppercase">Descrição / Objetivo</label>
                    <textarea
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Descreva claramente as instruções de execução para o promotor..."
                      rows={3}
                      className="text-xs bg-neutral-950 border border-neutral-850 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-neutral-300 uppercase">Início Vigência</label>
                      <input
                        type="date"
                        required
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                        className="text-xs bg-neutral-950 border border-neutral-850 rounded-lg p-2.5 text-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-neutral-300 uppercase">Fim Vigência</label>
                      <input
                        type="date"
                        required
                        value={dataFim}
                        onChange={(e) => setDataFim(e.target.value)}
                        className="text-xs bg-neutral-950 border border-neutral-850 rounded-lg p-2.5 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-neutral-300 uppercase">SLA Execução (Minutos)</label>
                      <input
                        type="number"
                        required
                        value={slaMinutos}
                        onChange={(e) => setSlaMinutos(e.target.value)}
                        className="text-xs bg-neutral-950 border border-neutral-850 rounded-lg p-2.5 text-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-neutral-300 uppercase">Prioridade Comercial (1-100)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="100"
                        value={prioridade}
                        onChange={(e) => setPrioridade(e.target.value)}
                        className="text-xs bg-neutral-950 border border-neutral-850 rounded-lg p-2.5 text-white"
                      />
                    </div>
                  </div>

                  {/* Checklist Dinâmico Creator */}
                  <div className="flex flex-col gap-3 mt-2 bg-neutral-950 p-4 rounded-xl border border-neutral-850">
                    <h4 className="text-xs font-black uppercase text-amber-500 tracking-wide flex items-center gap-1.5">
                      <Sliders className="w-4 h-4" />
                      Checklist Personalizado
                    </h4>
                    
                    {/* Lista de campos atual */}
                    <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {camposChecklist.map((c, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-neutral-900 p-2 rounded-lg text-xs border border-neutral-850">
                          <span className="truncate max-w-[200px]">{c.label} ({c.type})</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCampo(idx)}
                            className="p-1 text-neutral-500 hover:text-red-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Adicionar campo */}
                    <div className="flex gap-2 items-end border-t border-neutral-900 pt-3">
                      <div className="flex-1 flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-neutral-400">Pergunta / Item</label>
                        <input
                          type="text"
                          value={novoCampoLabel}
                          onChange={(e) => setNovoCampoLabel(e.target.value)}
                          placeholder="Ex: Preço correto de R$ 19,90 exposto?"
                          className="text-[11px] bg-neutral-900 border border-neutral-850 rounded-md p-2 text-white focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1 w-24 shrink-0">
                        <label className="text-[9px] font-bold text-neutral-400 font-medium">Tipo</label>
                        <select
                          value={novoCampoType}
                          onChange={(e) => setNovoCampoType(e.target.value)}
                          className="text-[11px] bg-neutral-900 border border-neutral-850 rounded-md p-2 text-white"
                        >
                          <option value="boolean">Sim/Não</option>
                          <option value="number">Número</option>
                          <option value="text">Texto livre</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddCampo}
                        className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-900/30 rounded-md font-bold text-xs flex items-center justify-center shrink-0 h-fit"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Coluna 2: Distribuição de Lojas e Promotores */}
                <div className="flex-1 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-neutral-850 pt-4 lg:pt-0 lg:pl-6">
                  <h3 className="text-xs font-black uppercase text-neutral-400 border-b border-neutral-850 pb-1 flex items-center gap-1">
                    <Store className="w-4 h-4 text-amber-500/80" />
                    2. Selecionar Lojas e Promotores
                  </h3>

                  <div className="flex-1 overflow-y-auto max-h-[350px] border border-neutral-850 rounded-xl p-2 bg-neutral-950/50 flex flex-col gap-2">
                    {pdvs.map(loja => {
                      const isSelected = selectedPdvs.includes(loja.cod_parceiro);
                      return (
                        <div
                          key={loja.cod_parceiro}
                          className={`p-3 rounded-lg border transition flex flex-col gap-2 ${
                            isSelected 
                              ? "bg-amber-950/10 border-amber-500/30" 
                              : "bg-neutral-900/40 border-neutral-900"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => togglePdvSelection(loja.cod_parceiro)}
                              className="rounded border-neutral-700 bg-neutral-900 text-amber-500 focus:ring-amber-500"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-neutral-200 truncate">{loja.nome_fantasia}</h4>
                              <p className="text-[9px] text-neutral-400 truncate">Cód: {loja.cod_parceiro} • {loja.cidade}/{loja.uf}</p>
                            </div>
                          </div>

                          {/* Seletor de Promotor se a loja for selecionada */}
                          {isSelected && (
                            <div className="pl-6 flex items-center gap-2">
                              <UserCheck className="w-3.5 h-3.5 text-amber-500/70" />
                              <select
                                value={selectedPromotores[loja.cod_parceiro] || ""}
                                onChange={(e) => handleSelectPromotor(loja.cod_parceiro, e.target.value)}
                                className="text-[10px] bg-neutral-950 border border-neutral-800 rounded-md p-1.5 text-neutral-300 flex-1 focus:outline-none"
                              >
                                <option value="">Sem promotor vinculado (Qualquer um da rota)</option>
                                {promotores.map(p => (
                                  <option key={p.id} value={p.id}>{p.nome_completo}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="submit"
                    disabled={btnLoading}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-neutral-950 font-black text-sm rounded-xl shadow-lg transition active:scale-98 mt-auto"
                  >
                    {btnLoading ? "Criando e Distribuindo Missão..." : "Confirmar e Distribuir Missão"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
