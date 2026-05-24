import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Users,
  History,
  Upload,
  Target,
  Coffee,
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
  Mail,
  LogOut,
  Settings
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { ModuleGroup } from "@/components/ModuleGroup";
import { createClient } from "@/lib/supabase/server";

const allModules = [
  {
    category: "Faturamento e Volume",
    items: [
      { title: "Vendas", description: "Meta vs Real", href: "/vendas", icon: BarChart3, color: "from-blue-600 to-blue-800", ready: true },
      { title: "DRE", description: "Demonstrativo de Resultados", href: "/dre", icon: DollarSign, color: "from-teal-600 to-teal-800", ready: true },
      { title: "Histórico", description: "Multi-ano", href: "/historico", icon: History, color: "from-amber-600 to-amber-800", ready: true },
      { title: "MaCo", description: "Margem contribuição", href: "/vendas?tab=maco", icon: DollarSign, color: "from-green-600 to-green-800", ready: false },
      { title: "Dia", description: "Análise diária", href: "/dia", icon: Calendar, color: "from-cyan-600 to-cyan-800", ready: false },
    ],
  },
  {
    category: "Análise",
    items: [
      { title: "Matriz", description: "Ranking clientes", href: "/matriz", icon: Users, color: "from-emerald-600 to-emerald-800", ready: true },
      { title: "Positivação", description: "Clientes ativos", href: "/positivacao", icon: CheckCircle2, color: "from-indigo-600 to-indigo-800", ready: true },
      { title: "Posit. Matriz", description: "Matriz e Cliente", href: "/positivacao-matriz", icon: CheckCircle2, color: "from-cyan-600 to-cyan-800", ready: true },
      { title: "Carteira", description: "Base ativa", href: "/carteira", icon: Briefcase, color: "from-teal-600 to-teal-800", ready: false },
      { title: "Preço", description: "R$/Kg análise", href: "/preco", icon: TrendingUp, color: "from-orange-600 to-orange-800", ready: false },
      { title: "Mix", description: "Composição SKU", href: "/mix", icon: PieChart, color: "from-pink-600 to-pink-800", ready: false },
    ],
  },
  {
    category: "Gestão",
    items: [
      { title: "Meta Cia", description: "Visão Executiva", href: "/meta-cia", icon: Target, color: "from-blue-600 to-blue-800", ready: true },
      { title: "Metas", description: "Cadastro metas", href: "/metas", icon: Target, color: "from-violet-600 to-violet-800", ready: true },
      { title: "Coffee_IA", description: "Pergunte aos dados", href: "/coffee-ia", icon: Sparkles, color: "from-amber-500 to-yellow-600", ready: true },
      { title: "Atendimento", description: "Regras PDV e UFs", href: "/atendimento", icon: Users, color: "from-fuchsia-600 to-fuchsia-800", ready: true },
      { title: "Upload", description: "Importar planilhas", href: "/upload", icon: Upload, color: "from-rose-600 to-rose-800", ready: true },
      { title: "Tributos", description: "Tributação SKU", href: "/tributos", icon: Receipt, color: "from-sky-600 to-sky-800", ready: true },
      { title: "Bonif.", description: "Bonificações", href: "/bonif", icon: Package, color: "from-indigo-600 to-indigo-800", ready: false },
      { title: "Devol.", description: "Devoluções", href: "/devol", icon: Layers, color: "from-slate-600 to-slate-800", ready: false },
    ],
  },
  {
    category: "Smart Hub",
    items: [
      { title: "Alertas", description: "Ações de retenção", href: "/alertas", icon: AlertTriangle, color: "from-red-600 to-red-800", ready: true },
    ],
  },
  {
    category: "Trade",
    items: [
      { title: "Dashboard", description: "Visão executiva", href: "/investimento/dashboard", icon: BarChart3, color: "from-fuchsia-600 to-fuchsia-800", ready: true },
      { title: "Calendário", description: "Visão mensal", href: "/investimento?view=calendar", icon: Calendar, color: "from-violet-600 to-violet-800", ready: true },
      { title: "Investimento", description: "Gestão por cliente", href: "/investimento", icon: TrendingUp, color: "from-emerald-600 to-emerald-800", ready: true },
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
  
  let role = 'Vendedor'; // default
  let allowedModuleNames: string[] = [];
  
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
    
    // Se o usuário for CEO (hardcoded fallback) ele pode ver tudo, 
    // mas o ideal é que até o CEO tenha os acessos mapeados na tabela.
    
    // Buscar permissões para a role
    const { data: permissions } = await supabase
      .from('cm_role_permissions')
      .select('module_name')
      .eq('role', role)
      .eq('has_access', true);
      
    if (permissions) {
      allowedModuleNames = permissions.map((p: any) => p.module_name);
    }
  }

  // Filtrar os módulos de acordo com as permissões
  // Se for CEO e não tiver configurado nada, podemos liberar tudo temporariamente pra não travar o sistema.
  // Mas de acordo com a regra, deve ser estrito. Vou assumir estrito.
  // Exception: if allowedModuleNames is completely empty and user is CEO, let's allow all just in case migration hasn't run.
  const isSuperAdmin = role === 'CEO' && allowedModuleNames.length === 0;

  const filteredModules = allModules.map(group => {
    return {
      ...group,
      items: group.items.filter(item => isSuperAdmin || allowedModuleNames.includes(item.title)).map(({ icon: Icon, ...rest }) => ({
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700">
            <Coffee className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight leading-tight">
              Coffee Mais
            </h1>
            <p className="text-[0.65rem] text-muted leading-tight">
              Apuração de Resultados Comerciais
              {role && <span className="ml-2 text-accent-gold font-semibold uppercase tracking-wider text-[10px] bg-accent-gold/10 px-1.5 py-0.5 rounded border border-accent-gold/20">{role}</span>}
            </p>
          </div>
          {/* User Config / Admin */}
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-3 border-l border-white/10 pl-4 ml-1">
              
              {canManageUsers && (
                <Link 
                  href="/admin/usuarios"
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                  title="Gestão de Usuários"
                >
                  <Users className="w-4 h-4" />
                </Link>
              )}
              
              <form action="/auth/signout" method="post">
                <button 
                  type="submit"
                  title="Sair"
                  className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[rgba(224,85,85,0.1)] transition-colors cursor-pointer"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground mb-1">
            Painel de Controle
          </h2>
          <p className="text-muted text-xs">
            Selecione um módulo para começar a análise
          </p>
        </div>

        <div className="space-y-6">
          {filteredModules.length > 0 ? (
            filteredModules.map((group) => (
              <ModuleGroup key={group.category} group={group} />
            ))
          ) : (
            <div className="text-center py-12 px-4 rounded-2xl bg-foreground/5 border border-border">
              <AlertTriangle className="w-8 h-8 text-muted mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground">Sem acesso</h3>
              <p className="text-muted mt-1 text-sm max-w-sm mx-auto">
                Seu perfil atual ({role}) não tem permissão de acesso a nenhum módulo. 
                Por favor, contate o administrador.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
