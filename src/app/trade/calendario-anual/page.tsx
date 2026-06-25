"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Calendar,
  User,
  MapPin,
  Plus,
  Trash2,
  ArrowLeft,
  RotateCw,
  Info,
  CalendarDays,
  Building2
} from "lucide-react";

interface CalendarioEvent {
  id: string;
  data_inicio: string;
  data_fim: string;
  assunto: string;
  observacao: string;
  gerente: string;
  regiao: string;
  rede: string;
  ano: number;
  created_at: string;
  created_by: string;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Helper to parse "YYYY-MM-DD" as local Date object (avoids UTC timezone shift issues)
const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export default function CalendarioAnualPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarioEvent[]>([]);
  const [userEmail, setUserEmail] = useState<string>("");

  // Filters state
  const [filterAno, setFilterAno] = useState<number>(new Date().getFullYear());
  const [filterGerente, setFilterGerente] = useState<string>("Todos");
  const [filterRegiao, setFilterRegiao] = useState<string>("Todos");
  const [filterRede, setFilterRede] = useState<string>("Todos");
  const [selectedMonth, setSelectedMonth] = useState<number | null>(new Date().getMonth()); // Default to current month

  // Form state
  const [showFormModal, setShowFormModal] = useState(false);
  const [formData, setFormData] = useState({
    data_inicio: "",
    data_fim: "",
    assunto: "",
    observacao: "",
    gerente: "",
    regiao: "",
    rede: ""
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Dynamic filter lists fetched from API
  const [managersList, setManagersList] = useState<string[]>([]);
  const [ufsList, setUfsList] = useState<string[]>([]);
  const [redesList, setRedesList] = useState<string[]>([]);

  // Feedback states
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Available years for filter
  const yearsList = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  }, []);

  useEffect(() => {
    // Get current logged-in user
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        setUserEmail(data.user.email);
      }
    });

    // Fetch dynamic filters
    fetch("/api/dashboard/filters")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.filters) {
          setManagersList(data.filters.managers || []);
          setUfsList(data.filters.ufs || []);
        }
      })
      .catch((err) => console.error("Erro ao carregar filtros:", err));

    // Fetch redes list
    supabase
      .from("v_redes_matrizes_detalhes")
      .select("nome")
      .order("nome", { ascending: true })
      .then(({ data }) => {
        if (data) {
          const nomes = [...new Set(data.map((r: any) => r.nome).filter(Boolean))] as string[];
          setRedesList(nomes);
        }
      });

    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("cm_trade_calendario_anual")
        .select("*")
        .order("data_inicio", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar eventos do calendário:", err);
      setFeedback({ type: "error", msg: "Erro ao carregar eventos." });
    } finally {
      setLoading(false);
    }
  };

  // Filter events in memory
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (ev.ano !== filterAno) return false;
      if (filterGerente !== "Todos" && ev.gerente !== filterGerente) return false;
      if (filterRegiao !== "Todos" && ev.regiao !== filterRegiao) return false;
      if (filterRede !== "Todos" && ev.rede !== filterRede) return false;
      if (selectedMonth !== null) {
        const start = parseLocalDate(ev.data_inicio);
        const end = parseLocalDate(ev.data_fim);
        const checkStart = new Date(filterAno, selectedMonth, 1);
        const checkEnd = new Date(filterAno, selectedMonth + 1, 0);
        if (start > checkEnd || end < checkStart) return false;
      }
      return true;
    });
  }, [events, filterAno, filterGerente, filterRegiao, filterRede, selectedMonth]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.data_inicio || !formData.data_fim || !formData.assunto) {
      setFeedback({ type: "error", msg: "Data inicial, data final e assunto são obrigatórios." });
      return;
    }

    try {
      setFormSubmitting(true);
      setFeedback(null);

      const computedAno = parseLocalDate(formData.data_inicio).getFullYear();

      const { error } = await supabase.from("cm_trade_calendario_anual").insert({
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim,
        assunto: formData.assunto,
        observacao: formData.observacao || null,
        gerente: formData.gerente || null,
        regiao: formData.regiao || null,
        rede: formData.rede || null,
        ano: computedAno,
        created_by: userEmail || "system"
      });

      if (error) throw error;

      setFeedback({ type: "success", msg: "Evento cadastrado com sucesso!" });
      setShowFormModal(false);
      // Reset form
      setFormData({
        data_inicio: "",
        data_fim: "",
        assunto: "",
        observacao: "",
        gerente: "",
        regiao: "",
        rede: ""
      });

      loadEvents();
    } catch (err: any) {
      console.error("Erro ao criar evento:", err);
      setFeedback({ type: "error", msg: err.message || "Erro ao salvar evento." });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este evento?")) return;

    try {
      const { error } = await supabase
        .from("cm_trade_calendario_anual")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setFeedback({ type: "success", msg: "Evento excluído com sucesso!" });
      loadEvents();
    } catch (err: any) {
      console.error("Erro ao deletar evento:", err);
      setFeedback({ type: "error", msg: "Erro ao excluir evento." });
    }
  };

  // Format date interval beautifully
  const formatEventDate = (startStr: string, endStr: string) => {
    try {
      const start = parseLocalDate(startStr);
      const end = parseLocalDate(endStr);

      if (startStr === endStr) {
        return start.toLocaleDateString("pt-BR");
      }
      return `${start.toLocaleDateString("pt-BR")} até ${end.toLocaleDateString("pt-BR")}`;
    } catch (e) {
      return `${startStr} a ${endStr}`;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col lg:flex-row">
      
      {/* SIDEBAR FILTERS (Left column) */}
      <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-neutral-900 bg-neutral-950 p-6 flex flex-col gap-6 flex-shrink-0">
        
        {/* Brand/Back */}
        <div className="flex flex-col gap-4">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors font-medium text-xs w-fit cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao Painel
          </Link>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-amber-500" />
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-amber-500 to-amber-200 bg-clip-text text-transparent uppercase">
              Coffee++
            </span>
          </div>
        </div>

        {/* Filter Group */}
        <div className="flex flex-col gap-4">
          
          {/* Year Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Período (Ano)</span>
            <select
              value={filterAno}
              onChange={(e) => setFilterAno(Number(e.target.value))}
              className="text-xs bg-neutral-900 border border-neutral-850 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 cursor-pointer appearance-none w-full"
            >
              {yearsList.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Manager Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Gerente</span>
            <select
              value={filterGerente}
              onChange={(e) => setFilterGerente(e.target.value)}
              className="text-xs bg-neutral-900 border border-neutral-850 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 cursor-pointer appearance-none w-full"
            >
              <option value="Todos">Todos</option>
              {managersList.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Estado / UF Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Estado (UF)</span>
            <select
              value={filterRegiao}
              onChange={(e) => setFilterRegiao(e.target.value)}
              className="text-xs bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 cursor-pointer appearance-none w-full"
            >
              <option value="Todos">Todos</option>
              {ufsList.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>

          {/* Rede Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Rede</span>
            <select
              value={filterRede}
              onChange={(e) => setFilterRede(e.target.value)}
              className="text-xs bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 cursor-pointer appearance-none w-full"
            >
              <option value="Todos">Todas</option>
              {redesList.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {(filterGerente !== "Todos" || filterRegiao !== "Todos" || filterRede !== "Todos") && (
            <button
              onClick={() => { setFilterGerente("Todos"); setFilterRegiao("Todos"); setFilterRede("Todos"); }}
              className="text-[10px] text-amber-400 hover:text-amber-300 font-bold underline underline-offset-2 text-left transition-colors cursor-pointer"
            >
              Limpar filtros
            </button>
          )}

        </div>

        {/* Sync Info */}
        <div className="mt-auto border-t border-neutral-900 pt-4 text-[10px] text-neutral-500 flex flex-col gap-1">
          <span>Tabela: public.cm_trade_calendario_anual</span>
          <span>Status: Banco Sincronizado</span>
        </div>
      </aside>

      {/* MAIN CONTENT AREA (Right column) */}
      <main className="flex-1 p-6 lg:p-10 flex flex-col gap-6 overflow-hidden">
        
        {/* Main Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-900/40 p-6 rounded-2xl border border-neutral-900">
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-amber-500 to-amber-200 bg-clip-text text-transparent">
              Calendário Anual de Trade
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Eventos, comemorações e aniversários de redes parceiras programados para {filterAno}.
            </p>
          </div>
          <button
            onClick={() => setShowFormModal(true)}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl flex items-center gap-2 transition cursor-pointer text-sm shadow-md"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Evento
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`p-4 rounded-xl border flex gap-3 items-center text-sm animate-in fade-in slide-in-from-top-2 ${
            feedback.type === "success" ? "bg-emerald-950/40 border-emerald-900/50 text-emerald-300" : "bg-red-950/40 border-red-900/50 text-red-300"
          }`}>
            <Info className="w-5 h-5 shrink-0" />
            <p>{feedback.msg}</p>
          </div>
        )}

        {/* MONTHS HORIZONTAL BAR */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Filtro por Mês</span>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedMonth(null)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                selectedMonth === null 
                  ? 'bg-gold/15 text-gold border-gold/30 shadow-sm' 
                  : 'bg-neutral-900/50 text-neutral-400 border-neutral-850 hover:bg-neutral-900 hover:text-white'
              }`}
            >
              Todos os Meses
            </button>
            {MONTH_NAMES.map((month, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedMonth(idx)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                  selectedMonth === idx 
                    ? 'bg-gold/15 text-gold border-gold/30 shadow-sm' 
                    : 'bg-neutral-900/50 text-neutral-400 border-neutral-850 hover:bg-neutral-900 hover:text-white'
                }`}
              >
                {month}
              </button>
            ))}
          </div>
        </div>

        {/* BODY: EVENTS LIST */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RotateCw className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl bg-neutral-900/10 border border-neutral-900/80">
              <Calendar className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-neutral-300">Nenhum evento registrado</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
                Não há eventos cadastrados com os filtros selecionados para o ano de {filterAno}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
              {filteredEvents.map((ev) => (
                <div key={ev.id} className="p-5 bg-neutral-900/20 hover:bg-neutral-900/40 rounded-2xl border border-neutral-900 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all group relative">
                  
                  {/* Event Top (Subject & Delete) */}
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-extrabold text-sm text-neutral-100 group-hover:text-gold transition-colors line-clamp-2">
                      {ev.assunto}
                    </h3>
                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      className="p-1.5 bg-neutral-900 hover:bg-red-500/10 text-neutral-500 hover:text-red-400 rounded-lg transition-colors border border-transparent hover:border-red-950 cursor-pointer shrink-0"
                      title="Excluir evento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Event Date Info */}
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-500/5 border border-amber-500/10 px-3 py-2 rounded-xl w-fit">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    <span>{formatEventDate(ev.data_inicio, ev.data_fim)}</span>
                  </div>

                  {/* Event Obs */}
                  <p className="text-xs text-neutral-400 leading-relaxed italic line-clamp-3">
                    {ev.observacao ? `"${ev.observacao}"` : "Sem observações detalhadas."}
                  </p>

                  {/* Event Badges Footer */}
                  <div className="mt-auto pt-3 border-t border-neutral-900/80 flex flex-wrap gap-2 text-[10px] font-semibold">
                    {ev.rede && (
                      <span className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2 py-1 rounded-lg">
                        <Building2 className="w-3 h-3" />
                        {ev.rede}
                      </span>
                    )}
                    {ev.gerente && (
                      <span className="flex items-center gap-1 bg-neutral-900/60 border border-neutral-800 text-neutral-400 px-2 py-1 rounded-lg">
                        <User className="w-3 h-3 text-amber-500/60" />
                        {ev.gerente}
                      </span>
                    )}
                    {ev.regiao && (
                      <span className="flex items-center gap-1 bg-neutral-900/60 border border-neutral-800 text-neutral-400 px-2 py-1 rounded-lg">
                        <MapPin className="w-3 h-3 text-amber-500/60" />
                        {ev.regiao}
                      </span>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {/* FORM MODAL (Add New Event) */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-850 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            <header className="p-5 border-b border-neutral-850 bg-neutral-900 flex justify-between items-center">
              <h2 className="text-sm font-extrabold text-amber-500 uppercase tracking-wider">Cadastrar Evento</h2>
              <button 
                onClick={() => setShowFormModal(false)} 
                className="text-xs text-neutral-400 hover:text-white font-bold cursor-pointer hover:bg-neutral-800 px-2 py-1 rounded-lg transition"
              >
                Fechar
              </button>
            </header>

            <form onSubmit={handleCreateEvent} className="p-6 flex flex-col gap-4 overflow-y-auto">
              
              {/* Date Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-neutral-300 uppercase">Data Inicial</label>
                  <input
                    type="date"
                    required
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                    className="text-xs bg-neutral-950 border border-neutral-850 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-neutral-300 uppercase">Data Final</label>
                  <input
                    type="date"
                    required
                    value={formData.data_fim}
                    onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                    className="text-xs bg-neutral-950 border border-neutral-850 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Subject */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-neutral-300 uppercase">Assunto / Evento</label>
                <input
                  type="text"
                  required
                  value={formData.assunto}
                  onChange={(e) => setFormData({ ...formData, assunto: e.target.value })}
                  placeholder="Ex: Aniversário da Rede Mambo"
                  className="text-xs bg-neutral-950 border border-neutral-850 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Rede select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-neutral-300 uppercase">Rede</label>
                <select
                  value={formData.rede}
                  onChange={(e) => setFormData({ ...formData, rede: e.target.value })}
                  className="text-xs bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 cursor-pointer w-full"
                >
                  <option value="">Nenhuma (Geral)</option>
                  {redesList.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Manager select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-neutral-300 uppercase">Gerente Vinculado</label>
                <select
                  value={formData.gerente}
                  onChange={(e) => setFormData({ ...formData, gerente: e.target.value })}
                  className="text-xs bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 cursor-pointer w-full"
                >
                  <option value="">Nenhum (Todos)</option>
                  {managersList.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Region select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-neutral-300 uppercase">Estado / UF</label>
                <select
                  value={formData.regiao}
                  onChange={(e) => setFormData({ ...formData, regiao: e.target.value })}
                  className="text-xs bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 cursor-pointer w-full"
                >
                  <option value="">Nenhuma (Geral)</option>
                  {ufsList.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>

              {/* Observation */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-neutral-300 uppercase">Observações</label>
                <textarea
                  value={formData.observacao}
                  onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                  placeholder="Instruções ou observações adicionais sobre o evento..."
                  rows={3}
                  className="text-xs bg-neutral-950 border border-neutral-850 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={formSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-neutral-950 font-black text-sm rounded-xl shadow-lg transition active:scale-98 mt-2 cursor-pointer disabled:opacity-50"
              >
                {formSubmitting ? "Salvando..." : "Salvar Evento"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
