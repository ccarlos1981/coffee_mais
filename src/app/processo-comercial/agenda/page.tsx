"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Save,
  Loader2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const YEARS = [2024, 2025, 2026, 2027];
const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex"];

const MANAGER_OPTIONS = [
  { value: "ALL", label: "Todos os Gerentes" },
  { value: "Julliano", label: "Julliano (SPC)" },
  { value: "Leandro", label: "Leandro (Sul)" },
  { value: "Luiz", label: "Luiz (SU+CO+NE)" },
  { value: "Cristiano", label: "Cristiano" },
];

// Cores para diferenciar os gerentes na visão "Todos"
const MANAGER_COLORS: Record<string, { bg: string; border: string; text: string; dot: string; badge: string; badgeText: string }> = {
  Julliano: { 
    bg: "rgba(59, 130, 246, 0.08)", 
    border: "rgba(59, 130, 246, 0.25)", 
    text: "#60a5fa", 
    dot: "#3b82f6",
    badge: "rgba(37, 99, 235, 0.85)",
    badgeText: "#ffffff"
  },
  Leandro:  { 
    bg: "rgba(16, 185, 129, 0.08)", 
    border: "rgba(16, 185, 129, 0.25)", 
    text: "#34d399", 
    dot: "#10b981",
    badge: "rgba(5, 150, 105, 0.85)",
    badgeText: "#ffffff"
  },
  Luiz:     { 
    bg: "rgba(245, 158, 11, 0.08)",  
    border: "rgba(245, 158, 11, 0.25)",  
    text: "#fbbf24", 
    dot: "#f59e0b",
    badge: "rgba(217, 119, 6, 0.85)",
    badgeText: "#ffffff"
  },
  Cristiano: {
    bg: "rgba(139, 92, 246, 0.08)", 
    border: "rgba(139, 92, 246, 0.25)", 
    text: "#a78bfa", 
    dot: "#8b5cf6",
    badge: "rgba(124, 58, 237, 0.85)",
    badgeText: "#ffffff"
  },
};

interface CalendarDay {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isWeekday: boolean; // Monday-Friday
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  isToday: boolean;
  monthLabel?: string; // e.g. "jun." or "jul."
}

// Helper para gerar o grid de 42 dias (6 semanas de 7 dias)
const getCalendarGrid = (year: number, month: number, todayStr: string): CalendarDay[] => {
  const days: CalendarDay[] = [];
  
  // Primeiro dia do mês (UTC para evitar problemas de fuso horário na geração)
  const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startDayOfWeek = firstDayOfMonth.getUTCDay(); // 0 = Domingo, ..., 6 = Sábado
  
  // Início da grade (retroceder até o Domingo anterior)
  const gridStart = new Date(firstDayOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - startDayOfWeek);
  
  const tempDate = new Date(gridStart);
  for (let i = 0; i < 42; i++) {
    const dateStr = tempDate.toISOString().split('T')[0];
    const dayOfWeek = tempDate.getUTCDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isCurrentMonth = tempDate.getUTCMonth() === month - 1;
    
    let monthLabel = undefined;
    if (tempDate.getUTCDate() === 1 || i === 0) {
      const monthsAbr = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
      monthLabel = monthsAbr[tempDate.getUTCMonth()];
    }
    
    days.push({
      date: new Date(tempDate),
      dateStr,
      dayOfMonth: tempDate.getUTCDate(),
      isCurrentMonth,
      isWeekday,
      dayOfWeek,
      isToday: dateStr === todayStr,
      monthLabel
    });
    
    tempDate.setUTCDate(tempDate.getUTCDate() + 1);
  }
  
  return days;
};

export default function AgendaPage() {
  const router = useRouter();

  // Filtros
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterManager, setFilterManager] = useState("ALL");

  // Dados
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [weekdays, setWeekdays] = useState<string[]>([]);
  const [managers, setManagers] = useState<string[]>([]);
  const [visibleManagers, setVisibleManagers] = useState<string[]>([]);
  const [routesByManager, setRoutesByManager] = useState<Record<string, Record<string, string>>>({});
  const [isFullAccess, setIsFullAccess] = useState(false);
  const [restrictedToManager, setRestrictedToManager] = useState<string | null>(null);
  const [currentUserManagerName, setCurrentUserManagerName] = useState<string | null>(null);
  
  // Célula que está sendo editada (formato 'manager_dateStr')
  const [editingCell, setEditingCell] = useState<string | null>(null);

  // Data selecionada no calendário (usada no mobile)
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Data de hoje (BR timezone)
  const todayStr = useMemo(() => {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const parts = formatter.formatToParts(d);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const dVal = parts.find(p => p.type === 'day')?.value;
    return `${y}-${m}-${dVal}`;
  }, []);

  useEffect(() => {
    if (todayStr) {
      setSelectedDateStr(todayStr);
    }
  }, [todayStr]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const formatFriendlyDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const y = parts[0];
    const m = parseInt(parts[1]) - 1;
    const d = parseInt(parts[2]);
    const monthsName = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    return `${d} de ${monthsName[m]} de ${y}`;
  };

  const dayOfWeekForSelected = (dateStr: string | null) => {
    if (!dateStr) return -1;
    const d = new Date(dateStr + 'T00:00:00');
    return d.getDay(); // 0 = Dom, 6 = Sáb
  };

  const isSelectedDayEditable = (dateStr: string | null) => {
    if (!dateStr) return false;
    if (dateStr < todayStr) return false;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    if (y !== filterYear || m !== filterMonth) return false;
    const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  };

  const handleSaveCell = (manager: string, date: string, value: string) => {
    setRoutesByManager(prev => ({
      ...prev,
      [manager]: {
        ...(prev[manager] || {}),
        [date]: value,
      },
    }));
    setEditingCell(null);
  };

  // Carregar dados
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        year: String(filterYear),
        month: String(filterMonth),
        manager: filterManager,
      });
      const res = await fetch(`/api/processo-comercial/agenda?${params}`, { cache: 'no-store' });
      
      // Ler o texto cru da resposta primeiro para diagnóstico
      const rawText = await res.text();
      
      if (!res.ok) {
        console.error('Agenda API error response:', res.status, rawText.slice(0, 500));
        throw new Error(`API retornou status ${res.status}: ${rawText.slice(0, 200)}`);
      }

      let json;
      try {
        json = JSON.parse(rawText);
      } catch {
        console.error('Agenda API non-JSON response:', rawText.slice(0, 500));
        throw new Error('Resposta da API não é JSON válido.');
      }

      if (json.success) {
        setWeekdays(json.weekdays || []);
        setManagers(json.managers || []);
        setVisibleManagers(json.visibleManagers || []);
        setRoutesByManager(json.routesByManager || {});
        setIsFullAccess(json.isFullAccess ?? false);
        setCurrentUserManagerName(json.currentUserManagerName || null);
        setRestrictedToManager(json.restrictedToManager || null);
      } else {
        throw new Error(json.error || "Erro desconhecido.");
      }
    } catch (err: any) {
      const msg = err?.message || (typeof err === 'string' ? err : 'Erro desconhecido');
      console.error('Agenda loadData error:', msg);
      setError(`Erro ao carregar agenda: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterMonth, filterManager]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Se o usuário é restrito, forçar o filtro de gerente
  useEffect(() => {
    if (restrictedToManager && filterManager !== restrictedToManager) {
      setFilterManager(restrictedToManager);
    }
  }, [restrictedToManager]);

  // Handler para editar uma rota
  const handleRouteChange = (manager: string, date: string, value: string) => {
    setRoutesByManager(prev => ({
      ...prev,
      [manager]: {
        ...(prev[manager] || {}),
        [date]: value,
      },
    }));
  };

  // Salvar
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const routes: { manager: string; route_date: string; description: string }[] = [];

      // Para cada gerente visível, enviar todas as datas dos dias úteis
      managers.forEach(mgr => {
        // Apenas enviar as do próprio gerente se não for Admin
        if (!isFullAccess && mgr !== currentUserManagerName) return;

        const mgrRoutes = routesByManager[mgr] || {};
        weekdays.forEach(date => {
          routes.push({
            manager: mgr,
            route_date: date,
            description: mgrRoutes[date] || '',
          });
        });
      });

      const res = await fetch('/api/processo-comercial/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routes }),
      });

      const json = await res.json();
      if (json.success) {
        setSuccess("Agenda salva com sucesso!");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error(json.error || "Erro ao salvar.");
      }
    } catch (err: any) {
      console.error(err);
      setError(`Erro ao salvar agenda: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Navegação rápida de mês
  const prevMonth = () => {
    if (filterMonth === 1) {
      setFilterMonth(12);
      setFilterYear(y => y - 1);
    } else {
      setFilterMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (filterMonth === 12) {
      setFilterMonth(1);
      setFilterYear(y => y + 1);
    } else {
      setFilterMonth(m => m + 1);
    }
  };

  // Rótulo do gerente
  const getManagerLabel = (name: string) => {
    const opt = MANAGER_OPTIONS.find(o => o.value === name);
    return opt ? opt.label : name;
  };

  // Contagem de dias preenchidos
  const getFilledCount = (mgr: string) => {
    const routes = routesByManager[mgr] || {};
    return Object.values(routes).filter(v => v && v.trim() !== '').length;
  };

  // Verificar se é hoje
  const isToday = (dateStr: string) => dateStr === todayStr;

  // Renderizar visão de gerente individual
  const renderSingleManagerCalendar = (mgr: string) => {
    const mgrRoutes = routesByManager[mgr] || {};
    const gridDays = getCalendarGrid(filterYear, filterMonth, todayStr);
    const filledCount = getFilledCount(mgr);
    const totalDays = weekdays.length;
    const pct = totalDays > 0 ? Math.round((filledCount / totalDays) * 100) : 0;

    return (
      <div key={mgr} className="glass-card animate-fade-in border border-border rounded-xl overflow-hidden shadow-sm">
        {/* Header do calendário */}
        <div
          className="p-2.5 md:p-4 border-b border-border flex items-center justify-between"
          style={{ background: 'var(--table-header-bg)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: MANAGER_COLORS[mgr]?.dot || 'var(--accent-gold)' }}
            />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent-gold)' }}>
                <MapPin className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
                Agenda de Rotas — {getManagerLabel(mgr)}
              </h2>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
                {MONTHS[filterMonth - 1]} de {filterYear}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded border"
              style={{
                background: 'rgba(255,255,255,0.03)',
                borderColor: 'var(--border)',
                color: pct >= 80 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--foreground-muted)',
              }}
            >
              {filledCount}/{totalDays} dias ({pct}%)
            </span>
          </div>
        </div>

        {/* Grade do Calendário (Desktop) */}
        <div className="hidden md:block p-0 overflow-x-auto">
          <div className="w-full min-w-[700px]">
            {/* Cabeçalho dos dias da semana */}
            <div className="grid grid-cols-7 border-b border-border text-center bg-elevated/20">
              {["DOM.", "SEG.", "TER.", "QUA.", "QUI.", "SEX.", "SÁB."].map((dayName, index) => (
                <div
                  key={dayName}
                  className="py-2.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    color: index === 0 || index === 6 ? 'var(--foreground-muted)' : 'var(--foreground-secondary)',
                    borderRight: index < 6 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* Células de dias */}
            <div className="grid grid-cols-7 grid-rows-6">
              {gridDays.map((day, index) => {
                const value = mgrRoutes[day.dateStr] || '';
                const isEditable = day.isCurrentMonth && day.isWeekday && (day.dateStr >= todayStr) && (isFullAccess || mgr === currentUserManagerName);
                const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
                const isEditing = editingCell === `${mgr}_${day.dateStr}`;
                const cellColors = MANAGER_COLORS[mgr] || { bg: "", border: "", text: "", dot: "", badge: "var(--accent-gold)", badgeText: "#ffffff" };

                return (
                  <div
                    key={day.dateStr}
                    onClick={() => {
                      setSelectedDateStr(day.dateStr);
                      if (isEditable && !isEditing) {
                        setEditingCell(`${mgr}_${day.dateStr}`);
                      }
                    }}
                    className={`min-h-[100px] p-2 flex flex-col group relative transition-all duration-200 border-r border-b border-border ${
                      day.isToday ? 'bg-accent-gold/[0.04]' : ''
                    } ${
                      !day.isCurrentMonth ? 'bg-elevated/10 opacity-40' : ''
                    } ${
                      isWeekend ? 'bg-elevated/30' : ''
                    } ${
                      isEditable ? 'cursor-pointer hover:bg-elevated/20' : ''
                    }`}
                    style={{
                      borderRight: (index + 1) % 7 === 0 ? 'none' : '1px solid var(--border)',
                      borderBottom: index >= 35 ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    {/* Header da Célula */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1">
                        {day.isToday ? (
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white bg-blue-600"
                            title="Hoje"
                          >
                            {day.dayOfMonth}
                          </span>
                        ) : (
                          <span
                            className="text-[11px] font-bold"
                            style={{
                              color: day.isToday
                                ? 'var(--accent-gold)'
                                : !day.isCurrentMonth
                                ? 'var(--foreground-dim)'
                                : 'var(--foreground-secondary)',
                            }}
                          >
                            {day.dayOfMonth}
                          </span>
                        )}
                        {day.monthLabel && (
                          <span className="text-[9px] font-semibold text-foreground-muted uppercase tracking-wider ml-0.5">
                            {day.monthLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Conteúdo/Evento */}
                    <div className="flex-1 flex flex-col justify-start">
                      {isEditing ? (
                        <textarea
                          autoFocus
                          defaultValue={value}
                          placeholder="Digite a rota..."
                          onBlur={(e) => handleSaveCell(mgr, day.dateStr, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveCell(mgr, day.dateStr, e.currentTarget.value);
                            } else if (e.key === 'Escape') {
                              setEditingCell(null);
                            }
                          }}
                          className="w-full text-xs p-1 rounded border border-accent-gold bg-background text-foreground outline-none resize-none focus:ring-1 focus:ring-accent-gold h-14"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : value ? (
                        <div
                          className="px-2 py-1 rounded text-[10px] font-semibold tracking-wide transition-all shadow-sm flex items-start gap-1"
                          style={{
                            backgroundColor: cellColors?.badge || 'var(--accent-gold)',
                            color: cellColors?.badgeText || '#ffffff',
                          }}
                        >
                          <span className="truncate flex-1">{value}</span>
                        </div>
                      ) : (
                        isEditable && (
                          <div className="hidden group-hover:flex items-center justify-center py-2 text-[10px] font-bold text-accent-gold/60 border border-dashed border-accent-gold/20 rounded transition-all">
                            + Rota
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Grade do Calendário (Mobile) */}
        <div className="block md:hidden p-1.5">
          {/* Cabeçalho simplificado dos dias */}
          <div className="grid grid-cols-7 text-center mb-1 bg-elevated/10 py-1 rounded">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((dayName, idx) => (
              <div
                key={idx}
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: idx === 0 || idx === 6 ? 'var(--foreground-muted)' : 'var(--foreground-secondary)' }}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Grade de 42 dias */}
          <div className="grid grid-cols-7 border border-border rounded-lg overflow-hidden bg-background">
            {gridDays.map((day, index) => {
              const value = mgrRoutes[day.dateStr] || '';
              const isSelected = day.dateStr === selectedDateStr;
              const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;

              return (
                <div
                  key={day.dateStr}
                  onClick={() => setSelectedDateStr(day.dateStr)}
                  className={`h-14 p-1 flex flex-col items-center justify-between border-r border-b border-border select-none relative cursor-pointer ${
                    day.isToday ? 'bg-accent-gold/[0.04]' : ''
                  } ${
                    !day.isCurrentMonth ? 'bg-elevated/5 opacity-30' : ''
                  } ${
                    isWeekend ? 'bg-elevated/15' : ''
                  } ${
                    isSelected ? 'ring-2 ring-accent-gold ring-inset bg-elevated/20' : 'hover:bg-elevated/10'
                  }`}
                  style={{
                    borderRight: (index + 1) % 7 === 0 ? 'none' : '1px solid var(--border)',
                    borderBottom: index >= 35 ? 'none' : '1px solid var(--border)',
                  }}
                >
                  {/* Dia */}
                  <div className="flex items-center justify-center">
                    {day.isToday ? (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-blue-600">
                        {day.dayOfMonth}
                      </span>
                    ) : (
                      <span className={`text-[10px] font-bold ${isSelected ? 'text-accent-gold' : 'text-foreground-secondary'}`}>
                        {day.dayOfMonth}
                      </span>
                    )}
                  </div>

                  {/* Dot indicador */}
                  <div className="h-2 flex items-center justify-center">
                    {value && (
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ backgroundColor: MANAGER_COLORS[mgr]?.dot || 'var(--accent-gold)' }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Card de Detalhes do Dia Selecionado */}
          <div className="mt-2 p-2.5 rounded-lg border border-border bg-elevated/10 flex flex-col gap-2 animate-fade-in">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent-gold flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-accent-gold" />
                {formatFriendlyDate(selectedDateStr)}
              </span>
              {(dayOfWeekForSelected(selectedDateStr) === 0 || dayOfWeekForSelected(selectedDateStr) === 6) ? (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400">
                  Fim de Semana
                </span>
              ) : null}
            </div>

            {/* Conteúdo */}
            {(() => {
              const isEditable = isSelectedDayEditable(selectedDateStr) && (isFullAccess || mgr === currentUserManagerName);
              const val = mgrRoutes[selectedDateStr || ''] || '';

              if (isEditable) {
                return (
                  <div key="editable-route-container" className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold uppercase text-foreground-muted">
                      Sua Rota ({mgr}):
                    </label>
                    <textarea
                      value={val}
                      onChange={(e) => handleRouteChange(mgr, selectedDateStr || '', e.target.value)}
                      placeholder="Digite a rota..."
                      className="w-full text-xs p-2 rounded border border-border bg-background text-foreground outline-none resize-none focus:ring-1 focus:ring-accent-gold focus:border-accent-gold h-16"
                    />
                  </div>
                );
              } else {
                return (
                  <div key="readonly-route-container" className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold uppercase text-foreground-muted">
                      Rota ({mgr}):
                    </span>
                    {val ? (
                      <div
                        key="has-route-badge"
                        className="px-2 py-1.5 rounded text-[10px] font-semibold tracking-wide transition-all shadow-sm flex items-start gap-1"
                        style={{
                          backgroundColor: MANAGER_COLORS[mgr]?.badge || 'var(--accent-gold)',
                          color: MANAGER_COLORS[mgr]?.badgeText || '#ffffff',
                        }}
                      >
                        <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>{val}</span>
                      </div>
                    ) : (
                      <span key="no-route-msg" className="text-[10px] text-foreground-muted italic leading-relaxed">
                        Nenhuma rota planejada para este dia.
                      </span>
                    )}
                  </div>
                );
              }
            })()}
          </div>
        </div>
      </div>
    );
  };

  // Renderizar visão "Todos" - tabela compacta com todos os gerentes
  const renderAllManagersView = () => {
    const gridDays = getCalendarGrid(filterYear, filterMonth, todayStr);

    return (
      <div className="glass-card animate-fade-in border border-border rounded-xl overflow-hidden shadow-sm">
        {/* Header do calendário */}
        <div
          className="p-2.5 md:p-4 border-b border-border flex items-center justify-between"
          style={{ background: 'var(--table-header-bg)' }}
        >
          <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent-gold)' }}>
            <Users className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
            Agenda de Rotas — Visão Consolidada
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border"
            style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}
          >
            {MONTHS[filterMonth - 1]} de {filterYear}
          </span>
        </div>

        {/* Grade do Calendário (Desktop) */}
        <div className="hidden md:block p-0 overflow-x-auto">
          <div className="w-full min-w-[800px]">
            {/* Cabeçalho dos dias da semana */}
            <div className="grid grid-cols-7 border-b border-border text-center bg-elevated/20">
              {["DOM.", "SEG.", "TER.", "QUA.", "QUI.", "SEX.", "SÁB."].map((dayName, index) => (
                <div
                  key={dayName}
                  className="py-2.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    color: index === 0 || index === 6 ? 'var(--foreground-muted)' : 'var(--foreground-secondary)',
                    borderRight: index < 6 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* Células de dias */}
            <div className="grid grid-cols-7 grid-rows-6">
              {gridDays.map((day, index) => {
                const isEditable = day.isCurrentMonth && day.isWeekday && day.dateStr >= todayStr;
                const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;

                return (
                  <div
                    key={day.dateStr}
                    className={`min-h-[130px] p-2 flex flex-col group relative transition-all duration-200 border-r border-b border-border ${
                      day.isToday ? 'bg-accent-gold/[0.04]' : ''
                    } ${
                      !day.isCurrentMonth ? 'bg-elevated/10 opacity-40' : ''
                    } ${
                      isWeekend ? 'bg-elevated/30' : ''
                    } ${
                      isEditable ? 'hover:bg-elevated/15' : ''
                    }`}
                    style={{
                      borderRight: (index + 1) % 7 === 0 ? 'none' : '1px solid var(--border)',
                      borderBottom: index >= 35 ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    {/* Header da Célula */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1">
                        {day.isToday ? (
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white bg-blue-600"
                            title="Hoje"
                          >
                            {day.dayOfMonth}
                          </span>
                        ) : (
                          <span
                            className="text-[11px] font-bold"
                            style={{
                              color: day.isToday
                                ? 'var(--accent-gold)'
                                : !day.isCurrentMonth
                                ? 'var(--foreground-dim)'
                                : 'var(--foreground-secondary)',
                            }}
                          >
                            {day.dayOfMonth}
                          </span>
                        )}
                        {day.monthLabel && (
                          <span className="text-[9px] font-semibold text-foreground-muted uppercase tracking-wider ml-0.5">
                            {day.monthLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Empilhamento de Eventos (Gerentes) */}
                    <div className="flex-1 flex flex-col gap-1 justify-start">
                      {managers.map(mgr => {
                        const mgrRoutes = routesByManager[mgr] || {};
                        const value = mgrRoutes[day.dateStr] || '';
                        const isEditing = editingCell === `${mgr}_${day.dateStr}`;
                        const colors = MANAGER_COLORS[mgr] || { bg: "", border: "", text: "", dot: "", badge: "var(--accent-gold)", badgeText: "#ffffff" };
                        const isEditableForManager = isEditable && (isFullAccess || mgr === currentUserManagerName);

                        if (isEditing) {
                          return (
                            <div key={mgr} onClick={(e) => e.stopPropagation()} className="mt-1">
                              <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: colors.text }}>
                                {mgr}:
                              </span>
                              <textarea
                                autoFocus
                                defaultValue={value}
                                placeholder="Rota..."
                                onBlur={(e) => handleSaveCell(mgr, day.dateStr, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveCell(mgr, day.dateStr, e.currentTarget.value);
                                  } else if (e.key === 'Escape') {
                                    setEditingCell(null);
                                  }
                                }}
                                className="w-full text-[10px] p-1 rounded border border-accent-gold bg-background text-foreground outline-none resize-none focus:ring-1 focus:ring-accent-gold h-12"
                              />
                            </div>
                          );
                        }

                        if (value) {
                          return (
                            <div
                              key={mgr}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isEditableForManager) {
                                  setEditingCell(`${mgr}_${day.dateStr}`);
                                }
                              }}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide transition-all shadow-sm flex items-center justify-between gap-1 ${
                                isEditableForManager ? 'cursor-pointer hover:brightness-95 active:scale-98' : ''
                              }`}
                              style={{
                                backgroundColor: colors?.badge || 'var(--accent-gold)',
                                color: colors?.badgeText || '#ffffff',
                              }}
                            >
                              <span className="truncate flex-1">
                                {mgr.split(' ')[0]}: {value}
                              </span>
                            </div>
                          );
                        }

                        // Se não tem valor, e a célula for editável, podemos exibir o "+ Gerente" no hover
                        return isEditableForManager ? (
                          <div
                            key={mgr}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCell(`${mgr}_${day.dateStr}`);
                            }}
                            className="hidden group-hover:flex items-center justify-center py-0.5 px-1 border border-dashed border-border-light hover:border-accent-gold/40 rounded text-[8px] font-bold text-foreground-muted hover:text-accent-gold cursor-pointer transition-all"
                          >
                            + {mgr}
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Grade do Calendário (Mobile) */}
        <div className="block md:hidden p-1.5">
          {/* Cabeçalho simplificado dos dias */}
          <div className="grid grid-cols-7 text-center mb-1 bg-elevated/10 py-1 rounded">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((dayName, idx) => (
              <div
                key={idx}
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: idx === 0 || idx === 6 ? 'var(--foreground-muted)' : 'var(--foreground-secondary)' }}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Grade de 42 dias */}
          <div className="grid grid-cols-7 border border-border rounded-lg overflow-hidden bg-background">
            {gridDays.map((day, index) => {
              const isSelected = day.dateStr === selectedDateStr;
              const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;

              return (
                <div
                  key={day.dateStr}
                  onClick={() => setSelectedDateStr(day.dateStr)}
                  className={`h-14 p-1 flex flex-col items-center justify-between border-r border-b border-border select-none relative cursor-pointer ${
                    day.isToday ? 'bg-accent-gold/[0.04]' : ''
                  } ${
                    !day.isCurrentMonth ? 'bg-elevated/5 opacity-30' : ''
                  } ${
                    isWeekend ? 'bg-elevated/15' : ''
                  } ${
                    isSelected ? 'ring-2 ring-accent-gold ring-inset bg-elevated/20' : 'hover:bg-elevated/10'
                  }`}
                  style={{
                    borderRight: (index + 1) % 7 === 0 ? 'none' : '1px solid var(--border)',
                    borderBottom: index >= 35 ? 'none' : '1px solid var(--border)',
                  }}
                >
                  {/* Dia */}
                  <div className="flex items-center justify-center">
                    {day.isToday ? (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-blue-600">
                        {day.dayOfMonth}
                      </span>
                    ) : (
                      <span className={`text-[10px] font-bold ${isSelected ? 'text-accent-gold' : 'text-foreground-secondary'}`}>
                        {day.dayOfMonth}
                      </span>
                    )}
                  </div>

                  {/* Dots indicadores */}
                  <div className="h-2 flex items-center justify-center gap-0.5 max-w-full overflow-hidden">
                    {managers.map(m => {
                      const route = routesByManager[m]?.[day.dateStr];
                      if (!route) return null;
                      return (
                        <span
                          key={m}
                          className="w-1.5 h-1.5 rounded-full animate-pulse"
                          style={{ backgroundColor: MANAGER_COLORS[m]?.dot || 'var(--accent-gold)' }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Card de Detalhes do Dia Selecionado */}
          <div className="mt-2 p-2.5 rounded-lg border border-border bg-elevated/10 flex flex-col gap-2 animate-fade-in">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent-gold flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-accent-gold" />
                {formatFriendlyDate(selectedDateStr)}
              </span>
              {(dayOfWeekForSelected(selectedDateStr) === 0 || dayOfWeekForSelected(selectedDateStr) === 6) ? (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400">
                  Fim de Semana
                </span>
              ) : null}
            </div>

            {/* Conteúdo */}
            <div className="flex flex-col gap-2.5 mt-1.5">
              {managers.map(m => {
                const val = routesByManager[m]?.[selectedDateStr || ''] || '';
                const isEditable = isSelectedDayEditable(selectedDateStr) && (isFullAccess || m === currentUserManagerName);
                const colors = MANAGER_COLORS[m];

                return (
                  <div
                    key={m}
                    className="p-2 rounded border border-border bg-background flex flex-col gap-1.5"
                    style={{ borderLeftWidth: '3px', borderLeftColor: colors?.dot || 'var(--accent-gold)' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold" style={{ color: colors?.text || 'var(--accent-gold)' }}>
                        {getManagerLabel(m)}
                      </span>
                      {!isEditable && (
                        <span className="text-[8px] font-mono text-foreground-muted tracking-wider uppercase">
                          Leitura
                        </span>
                      )}
                    </div>

                    {isEditable ? (
                      <textarea
                        key={`edit-textarea-${m}`}
                        value={val}
                        onChange={(e) => handleRouteChange(m, selectedDateStr || '', e.target.value)}
                        placeholder={`Digite a rota de ${m}...`}
                        className="w-full text-xs p-1.5 rounded border border-border bg-elevated/20 text-foreground outline-none resize-none focus:ring-1 focus:ring-accent-gold focus:border-accent-gold h-12"
                      />
                    ) : val ? (
                      <span key={`val-text-${m}`} className="text-xs font-semibold text-foreground-secondary leading-relaxed">
                        {val}
                      </span>
                    ) : (
                      <span key={`empty-text-${m}`} className="text-xs text-foreground-muted italic">
                        Nenhuma rota planejada.
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center font-sans">
        <Loader2 className="w-8 h-8 text-accent-gold animate-spin animate-duration-1000" />
        <p className="text-foreground-muted text-xs uppercase font-bold tracking-widest mt-3 animate-pulse">
          Carregando Agenda...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-300">

      {/* Navbar */}
      <nav className="cm-topnav border-b border-border flex items-center justify-between px-6 h-14 sticky top-0 z-50" style={{ backgroundColor: 'var(--background-navbar)' }}>
        <div className="cm-nav-links flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-foreground-secondary hover:text-foreground transition-colors font-medium text-xs bg-elevated/40 border border-border px-3 py-1.5 rounded-lg cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <h1 className="text-sm md:text-base font-bold text-foreground tracking-wider uppercase flex items-center justify-center gap-2">
            <CalendarDays className="w-4 h-4 text-accent-gold" />
            Agenda de Rotas
          </h1>
        </div>
        <div className="cm-nav-right flex items-center gap-4">
          <ThemeToggle />
        </div>
      </nav>

      {/* Body: Sidebar + Main */}
      <div className="dash-body flex-1">

        {/* SIDEBAR */}
        <aside className="dash-sidebar">
          <p className="dash-sidebar-title hidden md:block" style={{ marginTop: 0 }}>Período</p>

          {/* Navegação rápida de mês */}
          <div className="flex items-center justify-between gap-1 mb-2 md:mb-3">
            <button
              onClick={prevMonth}
              className="flex items-center justify-center w-7 h-7 rounded border border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted transition-all cursor-pointer"
              title="Mês anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold text-foreground text-center">
              {MONTHS[filterMonth - 1].slice(0, 3)} {filterYear}
            </span>
            <button
              onClick={nextMonth}
              className="flex items-center justify-center w-7 h-7 rounded border border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted transition-all cursor-pointer"
              title="Próximo mês"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2 md:mb-4">
            <div className="relative">
              <select
                title="Mês"
                value={filterMonth}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
                className="dash-filter-select"
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m.slice(0, 3)}</option>)}
              </select>
            </div>
            <div className="relative">
              <select
                title="Ano"
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="dash-filter-select"
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <p className="dash-sidebar-title hidden md:block">Regional</p>
          <select
            title="Gerente"
            value={filterManager}
            onChange={(e) => setFilterManager(e.target.value)}
            className="dash-filter-select mb-2 md:mb-4"
            disabled={loading || !!restrictedToManager}
          >
            {(restrictedToManager
              ? MANAGER_OPTIONS.filter(o => o.value === restrictedToManager)
              : (isFullAccess ? MANAGER_OPTIONS : MANAGER_OPTIONS.filter(o => visibleManagers.includes(o.value) || o.value === 'ALL'))
            ).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Info box — resumo de preenchimento */}
          {!loading && managers.length > 0 && (
            <>
              {/* Desktop version: stacked list */}
              <div className="sidebar-info-box mb-4 hidden md:block">
                {managers.map(mgr => {
                  const filled = getFilledCount(mgr);
                  const total = weekdays.length;
                  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
                  const colors = MANAGER_COLORS[mgr];
                  return (
                    <div key={mgr} className="flex justify-between py-1 border-b border-white/5 last:border-b-0">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: colors?.dot || 'var(--accent-gold)' }} />
                        {mgr}
                      </span>
                      <strong style={{ color: pct >= 80 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--foreground-muted)' }}>
                        {filled}/{total}
                      </strong>
                    </div>
                  );
                })}
              </div>

              {/* Mobile version: compact row of badges */}
              <div className="sidebar-info-box p-1.5 mb-2 block md:hidden text-[9px]">
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                  {managers.map(mgr => {
                    const filled = getFilledCount(mgr);
                    const total = weekdays.length;
                    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
                    const colors = MANAGER_COLORS[mgr];
                    return (
                      <div key={mgr} className="flex items-center gap-1 bg-elevated/5 px-1.5 py-0.5 rounded border border-border/30">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: colors?.dot || 'var(--accent-gold)' }} />
                        <span className="font-semibold text-foreground-secondary">{mgr.split(' ')[0]}:</span>
                        <strong style={{ color: pct >= 80 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--foreground-muted)' }}>
                          {filled}/{total}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Botão Salvar */}
          <div className="mt-2 md:mt-6">
            <button
              onClick={handleSave}
              disabled={saving || loading || managers.length === 0}
              className="flex items-center justify-center gap-2 w-full py-2 md:py-3 rounded-xl bg-gradient-to-r from-[#c8a96e] to-[#a0844f] hover:from-[#d6b97d] hover:to-[#b0935d] disabled:from-gray-700 disabled:to-gray-700 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Agenda
                </>
              )}
            </button>
            <p className="text-[10px] text-foreground-muted text-center mt-1 md:mt-2 leading-tight">
              *Salva todas as rotas do mês para os gerentes exibidos.
            </p>
          </div>
        </aside>

        {/* MAIN */}
        <main className="cm-main">

          {/* Feedback */}
          {success && (
            <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-semibold animate-fade-in">
              ✓ {success}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold animate-fade-in">
              ✗ {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-3">
              <Loader2 className="w-8 h-8 text-accent-gold animate-spin" />
              <p className="text-foreground-muted text-xs uppercase font-bold tracking-widest animate-pulse">
                Carregando Agenda...
              </p>
            </div>
          ) : managers.length === 0 ? (
            <div className="text-center py-20 bg-card border border-border rounded-xl">
              <CalendarDays className="w-10 h-10 text-foreground-muted mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground">Nenhum gerente selecionado</h3>
              <p className="text-foreground-muted text-xs mt-1 max-w-sm mx-auto">
                Selecione um gerente na sidebar para visualizar e editar a agenda de rotas.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filterManager === 'ALL' && managers.length > 1 ? (
                <div key="consolidated-calendar-view">
                  {renderAllManagersView()}
                </div>
              ) : (
                <div key="individual-calendars-view" className="space-y-6">
                  {managers.map(mgr => (
                    <div key={`calendar-wrapper-${mgr}`}>
                      {renderSingleManagerCalendar(mgr)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
