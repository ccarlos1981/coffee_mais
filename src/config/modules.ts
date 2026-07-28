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
  Settings,
  CalendarDays,
  ClipboardList,
  Clock,
  ShieldCheck,
  Map,
  BookOpen,
  FileText,
  MapPin,
  Trophy,
  Activity,
  Network,
  Building2,
  CheckSquare,
  Brain,
  Sliders,
  Compass
} from "lucide-react";

export interface NavigationItem {
  key: string; // Unique stable identifier for the module
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

export interface NavigationGroup {
  category: string;
  items: NavigationItem[];
}

export const allModules: NavigationGroup[] = [
  {
    category: "Plataforma Comercial Enterprise",
    items: [
      { key: "crm_enterprise", title: "CRM Enterprise", description: "Gestão 360º da carteira comercial", href: "/crm-enterprise", icon: Building2, color: "from-indigo-600 to-indigo-800", ready: true, permission: "CRM Enterprise" },
      { key: "execucao_comercial", title: "Execução Comercial", description: "Agenda e visitas inteligentes", href: "/execucao-comercial", icon: CheckSquare, color: "from-emerald-600 to-emerald-800", ready: true, permission: "Execução Comercial" },
      { key: "assistente_decisao", title: "Assistente de Decisão", description: "Inteligência e recomendações", href: "/assistente-decisao", icon: Brain, color: "from-amber-500 to-yellow-600", ready: true, permission: "Assistente de Decisão" },
      { key: "simulacao_estrategica", title: "Simulação Estratégica", description: "Cenários prospectivos", href: "/simulacao-estrategica", icon: Sliders, color: "from-purple-600 to-purple-800", ready: true, permission: "Simulação Estratégica" },
      { key: "planejamento_comercial", title: "S&OP Comercial", description: "Planejamento comercial integrado", href: "/planejamento-comercial", icon: Compass, color: "from-blue-600 to-blue-800", ready: true, permission: "S&OP Comercial" },
    ],
  },
  {
    category: "Faturamento e Volume",
    items: [
      { key: "vendas", title: "Vendas", description: "Meta vs Real", href: "/vendas", icon: BarChart3, color: "from-blue-600 to-blue-800", ready: true },
      { key: "historico", title: "Histórico", description: "Multi-ano", href: "/historico", icon: History, color: "from-amber-600 to-amber-800", ready: true },
      { key: "historico_rede", title: "Hist. Rede", permission: "Hist. Matriz", description: "YoY por Rede", href: "/historico-matriz", icon: History, color: "from-amber-600 to-amber-800", ready: true },
      { key: "historico_por_rede", title: "Hist. p/ Rede", permission: "Hist. p/ Matriz", description: "Top 10 Redes YoY", href: "/historico-por-matriz", icon: BarChart3, color: "from-sky-600 to-sky-800", ready: true },
      { key: "preco", title: "Preço", description: "R$/Kg análise", href: "/preco", icon: TrendingUp, color: "from-orange-600 to-orange-800", ready: true },
      { key: "dia", title: "Dia", description: "Análise diária", href: "/dia", icon: Calendar, color: "from-cyan-600 to-cyan-800", ready: true },
      { key: "maco", title: "MaCo", description: "Margem contribuição", href: "/vendas?tab=maco", icon: DollarSign, color: "from-green-600 to-green-800", ready: false },
      { key: "dre", title: "DRE", description: "Demonstrativo de Resultados", href: "/dre", icon: DollarSign, color: "from-teal-600 to-teal-800", ready: true },
      { key: "dre_historico", title: "DRE Hist.", description: "Histórico anual", href: "/dre/historico", icon: DollarSign, color: "from-teal-700 to-teal-900", ready: true },
    ],
  },
  {
    category: "Análise",
    items: [
      { key: "matriz", title: "Rede", permission: "Matriz", description: "Ranking clientes", href: "/matriz", icon: Users, color: "from-emerald-600 to-emerald-800", ready: true },
      { key: "positivacao", title: "Positivação", description: "Clientes ativos", href: "/positivacao", icon: CheckCircle2, color: "from-indigo-600 to-indigo-800", ready: true },
      { key: "positivacao_matriz", title: "Posit. Rede", permission: "Posit. Matriz", description: "Rede e Cliente", href: "/positivacao-matriz", icon: CheckCircle2, color: "from-cyan-600 to-cyan-800", ready: true },
      { key: "historico_familia", title: "Hist. Família", description: "Evolução e ranking de famílias", href: "/historico-familia", icon: Layers, color: "from-indigo-600 to-indigo-800", ready: true },
      { key: "carteira", title: "Carteira", description: "Base ativa", href: "/carteira", icon: Briefcase, color: "from-teal-600 to-teal-800", ready: false },
      { key: "mix", title: "Mix", description: "Composição SKU", href: "/mix", icon: PieChart, color: "from-pink-600 to-pink-800", ready: false },
    ],
  },
  {
    category: "Processo Comercial",
    items: [
      { key: "rps", title: "RPS", description: "Processamento de RPS", href: "/processo-comercial/rps", icon: Receipt, color: "from-blue-600 to-blue-800", ready: true },
      { key: "rdm", title: "RDM", description: "Reunião Mensal", href: "/processo-comercial/rdm", icon: Layers, color: "from-violet-600 to-violet-800", ready: true },
      { key: "agenda", title: "Agenda", description: "Agenda Comercial", href: "/processo-comercial/agenda", icon: CalendarDays, color: "from-emerald-600 to-emerald-800", ready: true },
      { key: "follow_up", title: "Follow Up", description: "Acompanhamento", href: "/processo-comercial/follow-up", icon: ClipboardList, color: "from-amber-600 to-amber-800", ready: true },
    ],
  },
  {
    category: "Investimentos",
    items: [
      { key: "dash_gerencial", title: "Dash Gerencial", description: "Visão global de negócios", href: "/investimento/gerencial", icon: PieChart, color: "from-blue-600 to-blue-800", ready: true },
      { key: "dash_resumido", title: "Dash resumido", description: "Saldo devedor por rede", href: "/investimento/invest-cliente", icon: Users, color: "from-rose-600 to-rose-800", ready: true },
      { key: "dash_por_rede", title: "Dash por rede", description: "Visão executiva", href: "/investimento/dashboard", icon: BarChart3, color: "from-fuchsia-600 to-fuchsia-800", ready: true },
      { key: "invest_por_mes", title: "Invest. por mês", description: "Consolidado mensal", href: "/investimento/por-mes", icon: CalendarDays, color: "from-cyan-600 to-cyan-800", ready: true },
      { key: "calendario_invest", title: "Calendário de invest.", description: "Visão mensal", href: "/investimento?view=calendar", icon: Calendar, color: "from-violet-600 to-violet-800", ready: true },
      { key: "planej_invest", title: "Planej. de Invest.", permission: "Planej. de Invest.", description: "Planejamento de ações", href: "/investimento/planejamento", icon: Target, color: "from-amber-600 to-amber-800", ready: true },
      { key: "carta_anuencia", title: "Carta de Anuência", permission: "Investimento", description: "Gestão de cartas de quitação", href: "/investimento/carta-anuencia", icon: FileText, color: "from-blue-600 to-indigo-800", ready: true },
      { key: "invest_oficial", title: "Invest. oficial", description: "Gestão por cliente", href: "/investimento", icon: TrendingUp, color: "from-amber-600 to-amber-800", ready: true, hasRedBorder: true },
    ],
  },
  {
    category: "Trade",
    items: [
      { key: "trade_calendario_anual", title: "Calendário Anual", description: "Eventos e datas", href: "/trade/calendario-anual", icon: CalendarDays, color: "from-amber-600 to-amber-800", ready: true },
    ],
  },
  {
    category: "Módulo Promotor",
    items: [
      { key: "promotor_ponto", title: "Ponto Promotor", description: "Registrar jornada", href: "/promotor/ponto", icon: Clock, color: "from-amber-600 to-amber-800", ready: true },
      { key: "promotor_agenda", title: "Agenda Promotor", description: "Roteiro e visitas", href: "/promotor/agenda", icon: ClipboardList, color: "from-orange-600 to-orange-850", ready: true },
      { key: "supervisor_ponto", title: "Painel Supervisor", description: "Aprovar pontos", href: "/supervisor/ponto", icon: Users, color: "from-blue-600 to-blue-800", ready: true },
      { key: "supervisor_rotas", title: "Central de Rotas e SLAs", description: "Configurar SLAs e rotas", href: "/supervisor/rotas", icon: Map, color: "from-amber-650 to-amber-850", ready: true },
      { key: "supervisor_command_center", title: "Command Center", description: "Tracking em tempo real", href: "/supervisor/command-center", icon: ShieldCheck, color: "from-red-650 to-red-850", ready: true },
      { key: "trade_dashboard", title: "Compliance e KPIs", description: "Auditoria de campo", href: "/trade/dashboard", icon: ShieldCheck, color: "from-red-600 to-red-800", ready: true },
      { key: "trade_missoes", title: "Missões Trade", description: "Checklists de loja", href: "/trade/missoes", icon: Target, color: "from-purple-600 to-purple-800", ready: true },
      { key: "promotor_desafio", title: "Desafio Promotor", description: "Campanhas e incentivos", href: "/promotor/desafio", icon: Trophy, color: "from-amber-500 to-orange-600", ready: true },
      { key: "promotor_pesquisa_light", title: "Pesquisa Light", permission: "Pesquisa Light", description: "Pesquisa rápida de preços", href: "/promotor/pesquisa-light", icon: FileText, color: "from-amber-600 to-amber-800", ready: true },
    ],
  },
  {
    category: "Gestão",
    items: [
      { key: "meta_cia", title: "Meta Cia", description: "Visão Executiva", href: "/meta-cia", icon: Target, color: "from-blue-600 to-blue-800", ready: true },
      { key: "metas", title: "Metas por área", permission: "Metas", description: "Cadastro metas", href: "/metas", icon: Target, color: "from-violet-600 to-violet-800", ready: true },
      { key: "metas_promotor", title: "Metas promotor", description: "Cadastro metas promotor", href: "/metas-promotor", icon: Target, color: "from-purple-600 to-purple-800", ready: true },
      { key: "coffee_ia", title: "Coffee_IA", description: "Pergunte aos dados", href: "/coffee-ia", icon: Sparkles, color: "from-amber-500 to-yellow-600", ready: true },
      { key: "atendimento", title: "Atendimento", description: "Regras PDV e UFs", href: "/atendimento", icon: Users, color: "from-fuchsia-600 to-fuchsia-800", ready: true },
      { key: "upload", title: "Upload", description: "Importar planilhas", href: "/upload", icon: Upload, color: "from-rose-600 to-rose-800", ready: true },
      { key: "tributos", title: "Tributos", description: "Tributação SKU", href: "/tributos", icon: Receipt, color: "from-sky-600 to-sky-800", ready: true },
      { key: "bonif", title: "Bonif.", description: "Bonificações", href: "/bonif", icon: Package, color: "from-indigo-600 to-indigo-800", ready: false },
      { key: "devol", title: "Devol.", description: "Devoluções", href: "/devol", icon: Layers, color: "from-slate-600 to-slate-800", ready: false },
    ],
  },
  {
    category: "Gente e Gestão",
    items: [
      { key: "gente_gestao_cadastro", title: "Cadastro", permission: "Cadastro Funcionários", description: "Cadastro de funcionários", href: "/gente-gestao/cadastro", icon: Users, color: "from-teal-600 to-teal-800", ready: true },
      { key: "gente_gestao_remuneracao", title: "Remuneração Promotores", permission: "Remuneração Promotores", description: "Cálculo e auditoria", href: "/gente-gestao/remuneracao-promotor", icon: DollarSign, color: "from-amber-500 to-amber-700", ready: true },
      { key: "gente_gestao_ferias", title: "Férias", permission: "Férias", description: "Calendário de Férias", href: "/gente-gestao/ferias", icon: CalendarDays, color: "from-emerald-600 to-emerald-800", ready: true },
      { key: "gente_gestao_treinamento", title: "Central de Treinamento", permission: "Central de Treinamento", description: "Manuais e Onboarding", href: "/treinamento", icon: BookOpen, color: "from-emerald-600 to-emerald-800", ready: true },
      { key: "gente_gestao_processos", title: "Processos Coffee ++", permission: "Processos Coffee ++", description: "Fluxos e Procedimentos", href: "/processos", icon: Layers, color: "from-purple-600 to-purple-800", ready: true },
    ],
  },
  {
    category: "Smart Hub",
    items: [
      { key: "smart_hub_alertas", title: "Alertas", description: "Ações de retenção", href: "/alertas", icon: AlertTriangle, color: "from-red-600 to-red-800", ready: true },
    ],
  },
  {
    category: "Config financeiro",
    items: [
      { key: "config_financeiro_cadastro", title: "Cadastro", description: "Cadastros financeiros", href: "/config-financeiro/cadastro", icon: DollarSign, color: "from-yellow-600 to-yellow-800", ready: true },
      { key: "config_financeiro_clientes", title: "Clientes", description: "Gestão de carteira", href: "/config-financeiro/clientes", icon: Users, color: "from-amber-600 to-amber-800", ready: true },
      { key: "config_financeiro_multiestado", title: "Multiestado", description: "Bases regionais", href: "/config-financeiro/multiestado", icon: MapPin, color: "from-fuchsia-600 to-fuchsia-800", ready: true },
    ],
  },
  {
    category: "Governança & Health",
    items: [
      { key: "health_center", title: "Health Center", description: "Governança & Observabilidade", href: "/health", icon: Activity, color: "from-emerald-600 to-teal-800", ready: true, permission: "Health Center" },
      { key: "workflow_enterprise", title: "Workflow Enterprise", description: "Infraestrutura de Workflows", href: "/workflow-enterprise", icon: Network, color: "from-amber-600 to-amber-800", ready: true, permission: "Workflow Enterprise" },
    ],
  },
  {
    category: "Configuração",
    items: [
      { key: "admin_configurar_acesso", title: "Configurar Acesso", description: "Matriz de permissões", href: "/admin/permissoes", icon: Settings, color: "from-slate-600 to-slate-800", ready: true },
      { key: "admin_usuarios", title: "Usuários", description: "Gestão de usuários", href: "/admin/usuarios", icon: Users, color: "from-slate-600 to-slate-800", ready: true },
      { key: "admin_qualidade_cadastral", title: "Qualidade Cadastral", description: "Auditoria preventiva", href: "/admin/qualidade", icon: ShieldCheck, color: "from-amber-600 to-amber-800", ready: true },
      { key: "admin_cadastro_mestre", title: "Cadastro Mestre Comercial", description: "Redes, Matrizes e Filiais", href: "/admin/cadastro-mestre", icon: ClipboardList, color: "from-amber-500 to-yellow-600", ready: true },
      { key: "admin_logs", title: "Logs do Sistema", description: "Auditoria de ações", href: "/admin/logs", icon: History, color: "from-slate-600 to-slate-800", ready: true },
      { key: "admin_ranking_usuarios", title: "Ranking Usuários", description: "Quem mais acessa", href: "/admin/ranking-usuarios", icon: Trophy, color: "from-amber-600 to-orange-700", ready: true },
      { key: "admin_ranking_modulos", title: "Ranking Módulos", description: "Funções mais usadas", href: "/admin/ranking-modulos", icon: BarChart3, color: "from-blue-600 to-indigo-700", ready: true },
    ],
  }
];
