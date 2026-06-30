import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import SyncStatusWidget from "@/components/SyncStatusWidget";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Users,
  History,
  Upload,
  Target,
  TrendingUp,
  Calendar,
  Briefcase,
  Package,
  PieChart,
  DollarSign,
  Layers,
  Receipt,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  LogOut,
  Settings,
  CalendarDays,
  ClipboardList,
  Clock,
  ShieldCheck,
  Map,
  BookOpen,
  Trophy,
  Bell
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { ModuleGroup } from "@/components/ModuleGroup";
import { createClient } from "@/lib/supabase/server";

interface NavigationItem {
  title: string;
  description: string;
  href: string;
  icon: any;
  color: string;
  ready: boolean;
  permission?: string;
  highlight?: boolean;
  hasRedBorder?: boolean;
}

interface NavigationGroup {
  category: string;
  items: NavigationItem[];
}

const allModules: NavigationGroup[] = [
  {
    category: "Faturamento e Volume",
    items: [
      { title: "Vendas", description: "Meta vs Real", href: "/vendas", icon: BarChart3, color: "from-blue-600 to-blue-800", ready: true },
      { title: "Histórico", description: "Multi-ano", href: "/historico", icon: History, color: "from-amber-600 to-amber-800", ready: true },
      { title: "Hist. Rede", permission: "Hist. Matriz", description: "YoY por Rede", href: "/historico-matriz", icon: History, color: "from-amber-600 to-amber-800", ready: true },
      { title: "Hist. p/ Rede", permission: "Hist. p/ Matriz", description: "Top 10 Redes YoY", href: "/historico-por-matriz", icon: BarChart3, color: "from-sky-600 to-sky-800", ready: true },
      { title: "Preço", description: "R$/Kg análise", href: "/preco", icon: TrendingUp, color: "from-orange-600 to-orange-800", ready: true },
      { title: "Dia", description: "Análise diária", href: "/dia", icon: Calendar, color: "from-cyan-600 to-cyan-800", ready: true },
      { title: "MaCo", description: "Margem contribuição", href: "/vendas?tab=maco", icon: DollarSign, color: "from-green-600 to-green-800", ready: false },
      { title: "DRE", description: "Demonstrativo de Resultados", href: "/dre", icon: DollarSign, color: "from-teal-600 to-teal-800", ready: false },
    ],
  },
  {
    category: "Análise",
    items: [
      { title: "Rede", permission: "Matriz", description: "Ranking clientes", href: "/matriz", icon: Users, color: "from-emerald-600 to-emerald-800", ready: true },
      { title: "Positivação", description: "Clientes ativos", href: "/positivacao", icon: CheckCircle2, color: "from-indigo-600 to-indigo-800", ready: true },
      { title: "Posit. Rede", permission: "Posit. Matriz", description: "Rede e Cliente", href: "/positivacao-matriz", icon: CheckCircle2, color: "from-cyan-600 to-cyan-800", ready: true },
      { title: "Carteira", description: "Base ativa", href: "/carteira", icon: Briefcase, color: "from-teal-600 to-teal-800", ready: false },
      { title: "Mix", description: "Composição SKU", href: "/mix", icon: PieChart, color: "from-pink-600 to-pink-800", ready: false },
    ],
  },
  {
    category: "Processo Comercial",
    items: [
      { title: "RPS", description: "Processamento de RPS", href: "/processo-comercial/rps", icon: Receipt, color: "from-blue-600 to-blue-800", ready: true },
      { title: "RDM", description: "Reunião Mensal", href: "/processo-comercial/rdm", icon: Layers, color: "from-violet-600 to-violet-800", ready: true },
      { title: "Agenda", description: "Agenda Comercial", href: "/processo-comercial/agenda", icon: CalendarDays, color: "from-emerald-600 to-emerald-800", ready: true },
      { title: "Follow Up", description: "Acompanhamento", href: "/processo-comercial/follow-up", icon: ClipboardList, color: "from-amber-600 to-amber-800", ready: true },
    ],
  },
  {
    category: "Investimentos",
    items: [
      { title: "Dash Gerencial", description: "Visão global de negócios", href: "/investimento/gerencial", icon: PieChart, color: "from-blue-600 to-blue-800", ready: true },
      { title: "Dash resumido", description: "Saldo devedor por rede", href: "/investimento/invest-cliente", icon: Users, color: "from-rose-600 to-rose-800", ready: true },
      { title: "Dash por rede", description: "Visão executiva", href: "/investimento/dashboard", icon: BarChart3, color: "from-fuchsia-600 to-fuchsia-800", ready: true },
      { title: "Invest. por mês", description: "Consolidado mensal", href: "/investimento/por-mes", icon: CalendarDays, color: "from-cyan-600 to-cyan-800", ready: true },
      { title: "Calendário de invest.", description: "Visão mensal", href: "/investimento?view=calendar", icon: Calendar, color: "from-violet-600 to-violet-800", ready: true },
      { title: "Planej. de Invest.", permission: "Planej. de Invest.", description: "Planejamento de ações", href: "/investimento/planejamento", icon: Target, color: "from-amber-600 to-amber-800", ready: true },
      { title: "Invest. oficial", description: "Gestão por cliente", href: "/investimento", icon: TrendingUp, color: "from-amber-600 to-amber-800", ready: true, hasRedBorder: true },
    ],
  },
  {
    category: "Trade",
    items: [
      { title: "Calendário Anual", description: "Eventos e datas", href: "/trade/calendario-anual", icon: CalendarDays, color: "from-amber-600 to-amber-800", ready: true },
    ],
  },
  {
    category: "Módulo Promotor",
    items: [
      { title: "Ponto Promotor", description: "Registrar jornada", href: "/promotor/ponto", icon: Clock, color: "from-amber-600 to-amber-800", ready: true },
      { title: "Agenda Promotor", description: "Roteiro e visitas", href: "/promotor/agenda", icon: ClipboardList, color: "from-orange-600 to-orange-850", ready: true },
      { title: "Painel Supervisor", description: "Aprovar pontos", href: "/supervisor/ponto", icon: Users, color: "from-blue-600 to-blue-800", ready: true },
      { title: "Central de Rotas e SLAs", description: "Configurar SLAs e rotas", href: "/supervisor/rotas", icon: Map, color: "from-amber-650 to-amber-850", ready: true },
      { title: "Command Center", description: "Tracking em tempo real", href: "/supervisor/command-center", icon: ShieldCheck, color: "from-red-650 to-red-850", ready: true },
      { title: "Compliance e KPIs", description: "Auditoria de campo", href: "/trade/dashboard", icon: ShieldCheck, color: "from-red-600 to-red-800", ready: true },
      { title: "Missões Trade", description: "Checklists de loja", href: "/trade/missoes", icon: Target, color: "from-purple-600 to-purple-800", ready: true },
      { title: "Desafio Promotor", description: "Campanhas e incentivos", href: "/promotor/desafio", icon: Trophy, color: "from-amber-500 to-orange-600", ready: true },
    ],
  },
  {
    category: "Gestão",
    items: [
      { title: "Meta Cia", description: "Visão Executiva", href: "/meta-cia", icon: Target, color: "from-blue-600 to-blue-800", ready: true },
      { title: "Metas por área", permission: "Metas", description: "Cadastro metas", href: "/metas", icon: Target, color: "from-violet-600 to-violet-800", ready: true },
      { title: "Metas promotor", description: "Cadastro metas promotor", href: "/metas-promotor", icon: Target, color: "from-purple-600 to-purple-800", ready: true },
      { title: "Coffee_IA", description: "Pergunte aos dados", href: "/coffee-ia", icon: Sparkles, color: "from-amber-500 to-yellow-600", ready: true },
      { title: "Atendimento", description: "Regras PDV e UFs", href: "/atendimento", icon: Users, color: "from-fuchsia-600 to-fuchsia-800", ready: true },
      { title: "Upload", description: "Importar planilhas", href: "/upload", icon: Upload, color: "from-rose-600 to-rose-800", ready: true },
      { title: "Tributos", description: "Tributação SKU", href: "/tributos", icon: Receipt, color: "from-sky-600 to-sky-800", ready: true },
      { title: "Bonif.", description: "Bonificações", href: "/bonif", icon: Package, color: "from-indigo-600 to-indigo-800", ready: false },
      { title: "Devol.", description: "Devoluções", href: "/devol", icon: Layers, color: "from-slate-600 to-slate-800", ready: false },
    ],
  },
  {
    category: "Gente e Gestão",
    items: [
      { title: "Cadastro", permission: "Gente e Gestão", description: "Cadastro de funcionários", href: "/gente-gestao/cadastro", icon: Users, color: "from-teal-600 to-teal-800", ready: true },
      { title: "Remuneração Promotores", permission: "Gente e Gestão", description: "Cálculo e auditoria", href: "/gente-gestao/remuneracao-promotor", icon: DollarSign, color: "from-amber-500 to-amber-700", ready: true },
      { title: "Central de Treinamento", description: "Manuais e Onboarding", href: "/treinamento", icon: BookOpen, color: "from-emerald-600 to-emerald-800", ready: true },
      { title: "Processos Coffee ++", permission: "Gente e Gestão", description: "Fluxos e Procedimentos", href: "/processos", icon: Layers, color: "from-purple-600 to-purple-800", ready: true },
    ],
  },
  {
    category: "Smart Hub",
    items: [
      { title: "Alertas", description: "Ações de retenção", href: "/alertas", icon: AlertTriangle, color: "from-red-600 to-red-800", ready: true },
    ],
  },
  {
    category: "Config financeiro",
    items: [
      { title: "Cadastro", description: "Cadastros financeiros", href: "/config-financeiro/cadastro", icon: DollarSign, color: "from-yellow-600 to-yellow-800", ready: true },
      { title: "Clientes", description: "Gestão de carteira", href: "/config-financeiro/clientes", icon: Users, color: "from-amber-600 to-amber-800", ready: true },
    ],
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  
  // Obter usuário logado
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }

  // Buscar processos obrigatórios pendentes de leitura
  const { data: mandatoryProcesses } = await supabase
    .from("cm_processos")
    .select("id, titulo, versao, departamento_responsavel")
    .eq("ativo", true)
    .eq("status", "PUBLICADO")
    .eq("mandatory_read", true);

  const { data: readings } = await supabase
    .from("cm_processos_leitura")
    .select("processo_id, versao_lida")
    .eq("user_id", user?.id || "00000000-0000-0000-0000-000000000000");

  const readSet = new Set(
    (readings || []).map(r => `${r.processo_id}_${r.versao_lida}`)
  );

  const pendingProcesses = (mandatoryProcesses || []).filter(p => {
    return !readSet.has(`${p.id}_${p.versao}`);
  });

  const pendingCount = pendingProcesses.length;
  
  let role = 'Vendedor'; // default
  let allowedModuleNames: string[] = [];
  let hasConfigInDb = false;
  
  if (user) {
    // Buscar perfil para descobrir a role
    const { data: profile } = await supabase
      .from('cm_user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (profile) {
      role = profile.role;
    }
    
    // Buscar todas as permissões gravadas para a role (ativas ou inativas)
    const { data: permissions } = await supabase
      .from('cm_role_permissions')
      .select('module_name, has_access')
      .eq('role', role);
      
    if (permissions) {
      allowedModuleNames = permissions.filter((p: any) => p.has_access).map((p: any) => p.module_name);
      hasConfigInDb = permissions.length > 0;
    }
  }

  // Filtrar os módulos de acordo com as permissões
  const isSuperAdmin = role === 'CEO' && allowedModuleNames.length === 0;

  const filteredModules = allModules.map(group => {
    return {
      ...group,
      items: group.items.filter(item => {
        if (isSuperAdmin) return true;
        
        const modulePermission = item.permission || item.title;
        
        // Se houver permissão ativa no banco, permite o acesso
        if (allowedModuleNames.includes(modulePermission)) return true;
        
        // Se a role não possuir NENHUMA permissão configurada no banco (tabela vazia para a role),
        // usamos os atalhos de visibilidade legados como fallback de segurança
        if (!hasConfigInDb) {
          if (item.href.startsWith("/promotor") && (role === "Promotor" || role === "Supervisor" || role === "Trade" || role === "Admin" || role === "CEO")) return true;
          if (item.href.startsWith("/supervisor") && (role === "Supervisor" || role === "Trade" || role === "Admin" || role === "CEO")) return true;
          if (item.href.startsWith("/trade") && (role === "Trade" || role === "Admin" || role === "Supervisor" || role === "CEO")) return true;
        }
        
        // Treinamento e manuais são públicos por padrão
        if (item.href.startsWith("/treinamento")) return true;
        
        return false;
      }).map(({ icon: Icon, ...rest }) => ({
        ...rest,
        iconNode: <Icon className="w-3 h-3 text-white" />
      }))
    };
  }).filter(group => group.items.length > 0);

  const canManageUsers = isSuperAdmin || allowedModuleNames.includes('Usuários');
  const canViewLogs = isSuperAdmin || allowedModuleNames.includes('Logs');

  if (role === 'Admin') {
    const adminItems = [
      { title: "Configurar Acesso", description: "Matriz de permissões", href: "/admin/permissoes", iconNode: <Settings className="w-3 h-3 text-white" />, color: "from-slate-600 to-slate-800", ready: true }
    ];
    
    if (canManageUsers || role === 'Admin') {
      adminItems.push({ title: "Usuários", description: "Gestão de usuários", href: "/admin/usuarios", iconNode: <Users className="w-3 h-3 text-white" />, color: "from-slate-600 to-slate-800", ready: true });
    }
    
    if (canViewLogs || role === 'Admin') {
      adminItems.push({ title: "Logs do Sistema", description: "Auditoria de ações", href: "/admin/logs", iconNode: <History className="w-3 h-3 text-white" />, color: "from-slate-600 to-slate-800", ready: true });
    }

    filteredModules.push({
      category: "Configuração",
      items: adminItems
    });
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Decorative noise grain overlay */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Rich radial background glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-gold/8 dark:bg-gold/4 blur-[130px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-10 right-10 w-[600px] h-[600px] rounded-full bg-emerald-700/6 dark:bg-emerald-800/2 blur-[130px] pointer-events-none translate-x-1/3 translate-y-1/3" />
      <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] rounded-full bg-amber-600/3 dark:bg-amber-950/2 blur-[100px] pointer-events-none -translate-y-1/2" />

      {/* Header */}
      <header className="border-b border-border/60 dark:border-white/20 bg-background/80 backdrop-blur-md sticky top-0 z-50 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-neutral-800 shadow-md">
            <Image
              src="/images/login/logo_white.png"
              alt="Coffee++"
              fill
              priority
              sizes="32px"
              className="object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-md font-bold font-display text-foreground tracking-tight leading-tight">
                Coffee<span className="text-gold font-sans font-medium">++</span>
              </h1>
              {role && (
                <span className="bg-gold/10 text-gold border border-gold/20 rounded-full px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase shadow-sm">
                  {role}
                </span>
              )}
            </div>
            <p className="text-[9px] text-muted uppercase tracking-wider font-semibold -mt-0.5">
              Apuração de Resultados Comerciais
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center justify-center p-1 border border-border/80 dark:border-white/20 rounded-lg bg-card/40 backdrop-blur-sm shadow-sm transition-all hover:border-gold/30">
              <ThemeToggle />
            </div>

            {/* Notification Bell Dropdown */}
            <details className="relative flex items-center group">
              <summary className="list-none flex items-center justify-center w-8 h-8 rounded-lg text-neutral-400 hover:text-foreground hover:bg-neutral-500/10 border border-transparent dark:hover:border-white/20 dark:hover:bg-white/5 transition-all cursor-pointer relative select-none">
                <Bell className="w-4 h-4" />
                {pendingCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border border-background animate-pulse" />
                )}
              </summary>
              
              <div className="absolute right-0 top-full mt-2 w-80 bg-neutral-950/95 border border-neutral-850 rounded-xl shadow-2xl p-4 z-50 group-open:block hidden backdrop-blur-md">
                <h4 className="text-[10px] font-black uppercase text-neutral-405 tracking-wider pb-2 border-b border-neutral-900 mb-3 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-amber-500" />
                  Pendências de Leitura ({pendingCount})
                </h4>
                {pendingCount === 0 ? (
                  <div className="text-center py-6 text-neutral-500 text-xs italic">
                    Nenhuma pendência de leitura! 🎉
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {pendingProcesses.map(p => (
                      <Link
                        key={p.id}
                        href={`/processos/${p.id}`}
                        className="flex flex-col gap-1 p-2 rounded-lg hover:bg-neutral-900 border border-transparent hover:border-neutral-850 transition-colors text-left"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-neutral-200 font-bold text-xs truncate flex-1">{p.titulo}</span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[8px] font-extrabold uppercase shrink-0">{p.versao}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-neutral-500">
                          <span>Depto: {p.departamento_responsavel}</span>
                          <span className="text-[8px] text-red-500 font-bold uppercase tracking-wider">Leitura Obrigatória</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </details>

            <div className="flex items-center gap-2 border-l border-border/80 dark:border-white/20 pl-4 ml-1">
              
              {canManageUsers && (
                <Link 
                  href="/admin/usuarios"
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-neutral-400 hover:text-foreground hover:bg-neutral-500/10 border border-transparent dark:hover:border-white/20 dark:hover:bg-white/5 transition-all"
                  title="Gestão de Usuários"
                >
                  <Users className="w-4 h-4" />
                </Link>
              )}
              
              <form action="/auth/signout" method="post">
                <button 
                  type="submit"
                  title="Sair"
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-neutral-400 hover:text-accent-red hover:bg-accent-red/10 transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 w-full flex-grow relative z-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold font-display text-foreground tracking-tight mb-1">
            Painel de Controle
          </h2>
          <p className="text-muted text-xs">
            Selecione um módulo corporativo para iniciar as apurações de metas e indicadores
          </p>
        </div>

        {/* BigQuery sync status - Admin only */}
        {role === 'Admin' && (
          <Suspense fallback={null}>
            <SyncStatusWidget />
          </Suspense>
        )}

        <div className="space-y-8">
          {filteredModules.length > 0 ? (
            filteredModules.map((group) => (
              <ModuleGroup key={group.category} group={group} />
            ))
          ) : (
            <div className="text-center py-16 px-4 rounded-2xl bg-card border border-border/80 shadow-lg max-w-md mx-auto my-12 animate-fade-in">
              <AlertTriangle className="w-10 h-10 text-muted mx-auto mb-4" />
              <h3 className="text-lg font-bold font-display text-foreground">Sem Acesso</h3>
              <p className="text-muted mt-2 text-xs leading-relaxed">
                Seu perfil atual ({role}) não possui permissões configuradas para nenhum módulo no sistema. 
                Entre em contato com o suporte ou administrador.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
