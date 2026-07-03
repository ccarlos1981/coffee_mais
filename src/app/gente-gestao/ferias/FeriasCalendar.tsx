"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  User,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const YEARS = [2024, 2025, 2026, 2027, 2028];

interface Vacation {
  id: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  description: string;
}

interface CalendarDay {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isWeekday: boolean;
  dayOfWeek: number;
  isToday: boolean;
  monthLabel?: string;
}

const getCalendarGrid = (year: number, month: number, todayStr: string): CalendarDay[] => {
  const days: CalendarDay[] = [];
  const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startDayOfWeek = firstDayOfMonth.getUTCDay(); // 0 = Sunday, 6 = Saturday
  
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

export function FeriasCalendar() {
  const router = useRouter();

  // Filters
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterEmployee, setFilterEmployee] = useState("ALL");

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [isFullAccess, setIsFullAccess] = useState(false);
  const [currentUserManagerName, setCurrentUserManagerName] = useState<string | null>(null);
  const [restrictedToManager, setRestrictedToManager] = useState<string | null>(null);
  
  // Selected day details
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Popup Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newVacationEmployee, setNewVacationEmployee] = useState("");
  const [isCustomEmployee, setIsCustomEmployee] = useState(false);
  const [customEmployeeName, setCustomEmployeeName] = useState("");
  const [newVacationStart, setNewVacationStart] = useState("");
  const [newVacationEnd, setNewVacationEnd] = useState("");
  const [newVacationDesc, setNewVacationDesc] = useState("Férias");

  // Today (Brasilia time)
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
    return `${d} de ${MONTHS[m]} de ${y}`;
  };

  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const dayOfWeekForSelected = (dateStr: string | null) => {
    if (!dateStr) return -1;
    const d = new Date(dateStr + 'T00:00:00');
    return d.getDay(); // 0 = Dom, 6 = Sáb
  };

  // Fetch vacations data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        year: String(filterYear),
        month: String(filterMonth),
        employee: filterEmployee,
      });
      const res = await fetch(`/api/gente-gestao/ferias?${params}`, { cache: 'no-store' });
      const json = await res.json();

      if (json.success) {
        setVacations(json.vacations || []);
        setEmployees(json.employees || []);
        setIsFullAccess(json.isFullAccess ?? false);
        setCurrentUserManagerName(json.currentUserManagerName || null);
        setRestrictedToManager(json.restrictedToManager || null);
        
        // Setup initial default manager for add modal
        if (json.restrictedToManager) {
          setNewVacationEmployee(json.restrictedToManager);
        } else if (json.employees && json.employees.length > 0 && !newVacationEmployee) {
          setNewVacationEmployee(json.employees[0]);
        }
      } else {
        throw new Error(json.error || "Erro desconhecido.");
      }
    } catch (err: any) {
      console.error('Vacation loadData error:', err);
      setError(`Erro ao carregar calendário de férias: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterMonth, filterEmployee, newVacationEmployee]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // If user is restricted, force their name filter
  useEffect(() => {
    if (restrictedToManager && filterEmployee !== restrictedToManager) {
      setFilterEmployee(restrictedToManager);
    }
  }, [restrictedToManager, filterEmployee]);

  const handleAddVacation = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalEmployeeName = isCustomEmployee ? customEmployeeName.trim() : newVacationEmployee;

    if (!finalEmployeeName || !newVacationStart || !newVacationEnd) {
      alert("Por favor, preencha todos os campos.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/gente-gestao/ferias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          employee_name: finalEmployeeName,
          start_date: newVacationStart,
          end_date: newVacationEnd,
          description: newVacationDesc || 'Férias',
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSuccess("Período de férias adicionado com sucesso!");
        setTimeout(() => setSuccess(null), 3000);
        setIsAddModalOpen(false);
        // Clear inputs
        setNewVacationStart("");
        setNewVacationEnd("");
        setCustomEmployeeName("");
        setIsCustomEmployee(false);
        setNewVacationDesc("Férias");
        loadData();
      } else {
        throw new Error(json.error || "Erro ao adicionar.");
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVacation = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este período de férias?")) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/gente-gestao/ferias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          id,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSuccess("Férias excluídas com sucesso!");
        setTimeout(() => setSuccess(null), 3000);
        loadData();
      } else {
        throw new Error(json.error || "Erro ao excluir.");
      }
    } catch (err: any) {
      setError(`Erro ao excluir férias: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Month navigation
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

  // Count vacation days in selected year for a specific employee
  const getVacationDaysInYear = (emp: string) => {
    const yearStart = new Date(Date.UTC(filterYear, 0, 1));
    const yearEnd = new Date(Date.UTC(filterYear, 11, 31));
    
    let count = 0;
    const tempDate = new Date(yearStart);
    while (tempDate <= yearEnd) {
      const dateStr = tempDate.toISOString().split('T')[0];
      const isOnVacation = vacations.some(v => 
        v.employee_name === emp && dateStr >= v.start_date && dateStr <= v.end_date
      );
      if (isOnVacation) {
        count++;
      }
      tempDate.setUTCDate(tempDate.getUTCDate() + 1);
    }
    return count;
  };

  // List of employees with active vacation days in this year
  const annualVacationEmployees = useMemo(() => {
    const list: { name: string; days: number }[] = [];
    employees.forEach(emp => {
      const days = getVacationDaysInYear(emp);
      if (days > 0) {
        list.push({ name: emp, days });
      }
    });
    return list.sort((a, b) => b.days - a.days);
  }, [employees, vacations, filterYear]);

  const openAddModal = (initialDateStr?: string) => {
    if (initialDateStr) {
      setNewVacationStart(initialDateStr);
      setNewVacationEnd(initialDateStr);
    }
    if (!newVacationEmployee) {
      if (restrictedToManager) {
        setNewVacationEmployee(restrictedToManager);
      } else if (employees.length > 0) {
        setNewVacationEmployee(employees[0]);
      }
    }
    setIsAddModalOpen(true);
  };

  // Render unified calendar grid
  const renderCalendar = () => {
    const gridDays = getCalendarGrid(filterYear, filterMonth, todayStr);

    return (
      <div className="glass-card animate-fade-in border border-border rounded-xl overflow-hidden shadow-sm">
        {/* Header */}
        <div
          className="p-2.5 md:p-4 border-b border-border flex items-center justify-between"
          style={{ background: 'var(--table-header-bg)' }}
        >
          <h2 className="text-xs font-bold uppercase tracking-wider text-accent-gold flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4 text-accent-gold" />
            Grade de Férias — {filterEmployee === 'ALL' ? 'Visão Consolidada' : filterEmployee}
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-border bg-card">
            {MONTHS[filterMonth - 1]} de {filterYear}
          </span>
        </div>

        {/* Desktop Calendar Grid */}
        <div className="hidden md:block p-0 overflow-x-auto">
          <div className="w-full min-w-[800px]">
            <div className="grid grid-cols-7 border-b border-border text-center bg-elevated/20">
              {["DOM.", "SEG.", "TER.", "QUA.", "QUI.", "SEX.", "SÁB."].map((dayName, idx) => (
                <div
                  key={dayName}
                  className="py-2.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    color: idx === 0 || idx === 6 ? 'var(--foreground-muted)' : 'var(--foreground-secondary)',
                    borderRight: idx < 6 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {dayName}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 grid-rows-6">
              {gridDays.map((day, idx) => {
                const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
                const dayVacations = vacations.filter(v => day.dateStr >= v.start_date && day.dateStr <= v.end_date);
                const hasVacations = dayVacations.length > 0;

                return (
                  <div
                    key={day.dateStr}
                    onClick={() => {
                      setSelectedDateStr(day.dateStr);
                    }}
                    onDoubleClick={() => {
                      if (isFullAccess || !restrictedToManager) {
                        openAddModal(day.dateStr);
                      }
                    }}
                    className={`min-h-[110px] p-2 flex flex-col group relative transition-all duration-200 border-r border-b border-border ${
                      day.isToday ? 'bg-accent-gold/[0.04]' : ''
                    } ${
                      !day.isCurrentMonth ? 'bg-elevated/10 opacity-40' : ''
                    } ${
                      isWeekend ? 'bg-elevated/30' : ''
                    } cursor-pointer hover:bg-elevated/15`}
                    style={{
                      borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--border)',
                      borderBottom: idx >= 35 ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    {/* Cell Header */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        {day.isToday ? (
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white bg-blue-600">
                            {day.dayOfMonth}
                          </span>
                        ) : (
                          <span className={`text-[11px] font-bold ${!day.isCurrentMonth ? 'text-foreground-dim' : 'text-foreground-secondary'}`}>
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

                    {/* Vacation Badges */}
                    <div className="flex-1 flex flex-col gap-1 justify-start overflow-hidden">
                      {dayVacations.slice(0, 3).map(v => (
                        <div
                          key={v.id}
                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 truncate"
                          title={`${v.employee_name}: ${v.description}`}
                        >
                          <span className="font-bold">{v.employee_name}</span>
                        </div>
                      ))}
                      {dayVacations.length > 3 && (
                        <div className="text-[8px] font-bold text-foreground-muted pl-1.5">
                          + {dayVacations.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile Calendar Grid */}
        <div className="block md:hidden p-1.5">
          <div className="grid grid-cols-7 text-center mb-1 bg-elevated/10 py-1 rounded">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((name, idx) => (
              <div key={idx} className="text-[9px] font-bold uppercase tracking-wider" style={{ color: idx === 0 || idx === 6 ? 'var(--foreground-muted)' : 'var(--foreground-secondary)' }}>
                {name}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 border border-border rounded-lg overflow-hidden bg-background">
            {gridDays.map((day, idx) => {
              const isSelected = day.dateStr === selectedDateStr;
              const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
              const dayVacations = vacations.filter(v => day.dateStr >= v.start_date && day.dateStr <= v.end_date);

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
                    borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--border)',
                    borderBottom: idx >= 35 ? 'none' : '1px solid var(--border)',
                  }}
                >
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

                  <div className="h-2 flex items-center justify-center gap-0.5 max-w-full overflow-hidden">
                    {dayVacations.slice(0, 3).map(v => (
                      <span
                        key={v.id}
                        className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                        title={v.employee_name}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
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
          Carregando Calendário de Férias...
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
            Calendário de Férias
          </h1>
        </div>
        <div className="cm-nav-right flex items-center gap-4">
          <ThemeToggle />
        </div>
      </nav>

      {/* Body Layout */}
      <div className="dash-body flex-1">
        
        {/* Sidebar */}
        <aside className="dash-sidebar">
          <p className="dash-sidebar-title hidden md:block" style={{ marginTop: 0 }}>Período</p>
          
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
            <select
              title="Mês"
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="dash-filter-select"
            >
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m.slice(0, 3)}</option>)}
            </select>
            <select
              title="Ano"
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="dash-filter-select"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <p className="dash-sidebar-title hidden md:block">Colaborador</p>
          <select
            title="Funcionário"
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className="dash-filter-select mb-2 md:mb-4"
            disabled={loading || !!restrictedToManager}
          >
            <option value="ALL">Todos os Funcionários</option>
            {employees.map(emp => (
              <option key={emp} value={emp}>{emp}</option>
            ))}
          </select>

          {/* Active Vacations Summary in Selected Year */}
          {!loading && (
            <>
              {/* Desktop version */}
              <div className="sidebar-info-box mb-4 hidden md:block max-h-[220px] overflow-y-auto pr-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent-gold mb-2 flex items-center gap-1">
                  <User className="w-3 h-3 text-accent-gold" />
                  Férias no Ano ({filterYear})
                </p>
                {annualVacationEmployees.length > 0 ? (
                  annualVacationEmployees.map(item => (
                    <div key={item.name} className="flex justify-between py-1.5 border-b border-white/5 last:border-b-0 text-xs">
                      <span className="truncate max-w-[120px]" title={item.name}>
                        {item.name}
                      </span>
                      <strong className="text-emerald-400 font-mono">
                        {item.days} {item.days === 1 ? 'dia' : 'dias'}
                      </strong>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-foreground-muted italic py-1">
                    Nenhum colaborador de férias no ano.
                  </p>
                )}
              </div>

              {/* Mobile version */}
              <div className="sidebar-info-box p-1.5 mb-2 block md:hidden text-[9px]">
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                  {annualVacationEmployees.length > 0 ? (
                    annualVacationEmployees.map(item => (
                      <div key={item.name} className="flex items-center gap-1 bg-elevated/5 px-1.5 py-0.5 rounded border border-border/30">
                        <span className="font-semibold text-foreground-secondary">{item.name.split(' ')[0]}:</span>
                        <strong className="text-emerald-400">{item.days}d</strong>
                      </div>
                    ))
                  ) : (
                    <span className="text-foreground-muted italic">Nenhum de férias no ano.</span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Add Vacation Button */}
          <div className="mt-2 md:mt-6">
            <button
              onClick={() => openAddModal()}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-2.5 md:py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 disabled:from-gray-700 disabled:to-gray-700 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Adicionar Férias
            </button>
            <p className="text-[10px] text-foreground-muted text-center mt-1.5 md:mt-2 leading-tight">
              *Adicione períodos de férias para qualquer funcionário através do formulário.
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
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
                Carregando Calendário...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {renderCalendar()}

              {/* Day Details Card - Rendered below the calendar */}
              <div className="mt-4 p-4 rounded-xl border border-border bg-elevated/10 flex flex-col gap-3 animate-fade-in">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-accent-gold flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-accent-gold" />
                    Detalhamento do Dia: {formatFriendlyDate(selectedDateStr)}
                  </span>
                  {dayOfWeekForSelected(selectedDateStr) === 0 || dayOfWeekForSelected(selectedDateStr) === 6 ? (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      Fim de Semana
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  {(() => {
                    const dayVacations = vacations.filter(v => selectedDateStr! >= v.start_date && selectedDateStr! <= v.end_date);
                    
                    if (dayVacations.length === 0) {
                      return (
                        <div className="text-center py-6 text-foreground-muted text-xs italic">
                          Nenhum colaborador de férias neste dia.
                        </div>
                      );
                    }

                    return dayVacations.map(vac => {
                      const isAuthorized = isFullAccess || vac.employee_name === currentUserManagerName;

                      return (
                        <div
                          key={vac.id}
                          className="p-3 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-l-4 border-l-emerald-500"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-emerald-400">
                              {vac.employee_name}
                            </span>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-2 py-0.5 text-[10px] font-bold uppercase">
                                Férias
                              </span>
                              <span className="text-xs text-foreground-secondary font-medium">
                                Período: {formatDateBR(vac.start_date)} até {formatDateBR(vac.end_date)}
                              </span>
                              {vac.description && vac.description !== 'Férias' && (
                                <span className="text-xs text-foreground-muted italic font-normal">
                                  ({vac.description})
                                </span>
                              )}
                            </div>
                          </div>

                          {isAuthorized && (
                            <button
                              onClick={() => handleDeleteVacation(vac.id)}
                              disabled={saving}
                              className="self-start sm:self-center flex items-center justify-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-500 transition-colors bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-lg px-3 py-1.5 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Excluir Férias
                            </button>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add Vacation Period Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-[999] backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 border border-border rounded-2xl shadow-2xl relative bg-neutral-900/90 text-foreground">
            
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-4 h-4 text-accent-gold" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-accent-gold">
                Lançar Período de Férias
              </h3>
            </div>

            <form onSubmit={handleAddVacation} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground-secondary">
                    Colaborador / Funcionário
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomEmployee(!isCustomEmployee);
                      // Clear values on toggle
                      setCustomEmployeeName("");
                    }}
                    className="text-[9px] font-bold text-accent-gold hover:underline uppercase tracking-wider"
                  >
                    {isCustomEmployee ? "Selecionar da Lista" : "Digitar Nome Manual"}
                  </button>
                </div>
                
                {isCustomEmployee ? (
                  <input
                    type="text"
                    placeholder="Nome completo do funcionário"
                    value={customEmployeeName}
                    onChange={(e) => setCustomEmployeeName(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs text-foreground outline-none focus:border-accent-gold focus:ring-1 focus:ring-accent-gold"
                    required
                  />
                ) : (
                  <select
                    value={newVacationEmployee}
                    onChange={(e) => setNewVacationEmployee(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs text-foreground outline-none focus:border-accent-gold focus:ring-1 focus:ring-accent-gold"
                    disabled={!isFullAccess && restrictedToManager !== null}
                    required
                  >
                    {restrictedToManager ? (
                      <option value={restrictedToManager}>{restrictedToManager}</option>
                    ) : (
                      employees.map(emp => (
                        <option key={emp} value={emp}>{emp}</option>
                      ))
                    )}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground-secondary mb-1.5">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={newVacationStart}
                    onChange={(e) => setNewVacationStart(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs text-foreground outline-none focus:border-accent-gold focus:ring-1 focus:ring-accent-gold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground-secondary mb-1.5">
                    Data de Fim
                  </label>
                  <input
                    type="date"
                    value={newVacationEnd}
                    onChange={(e) => setNewVacationEnd(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs text-foreground outline-none focus:border-accent-gold focus:ring-1 focus:ring-accent-gold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground-secondary mb-1.5">
                  Descrição / Observação (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Férias Coletivas, Licença, etc."
                  value={newVacationDesc}
                  onChange={(e) => setNewVacationDesc(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs text-foreground outline-none focus:border-accent-gold focus:ring-1 focus:ring-accent-gold"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold text-foreground-secondary hover:text-foreground hover:bg-elevated/10 rounded-xl transition-all border border-transparent hover:border-border cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      Salvar Férias
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
