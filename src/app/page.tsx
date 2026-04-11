"use client";

import Link from "next/link";
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
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";

const modules = [
  {
    category: "Faturamento e Volume",
    items: [
      {
        title: "Vendas",
        description: "Meta vs Real",
        href: "/vendas",
        icon: BarChart3,
        color: "from-blue-600 to-blue-800",
        ready: true,
      },
      {
        title: "DRE",
        description: "Demonstrativo de Resultados",
        href: "/dre",
        icon: DollarSign,
        color: "from-teal-600 to-teal-800",
        ready: true,
      },
      {
        title: "Histórico",
        description: "Multi-ano",
        href: "/historico",
        icon: History,
        color: "from-amber-600 to-amber-800",
        ready: true,
      },
      {
        title: "MaCo",
        description: "Margem contribuição",
        href: "/vendas?tab=maco",
        icon: DollarSign,
        color: "from-green-600 to-green-800",
        ready: false,
      },
      {
        title: "Dia",
        description: "Análise diária",
        href: "/dia",
        icon: Calendar,
        color: "from-cyan-600 to-cyan-800",
        ready: false,
      },
    ],
  },
  {
    category: "Análise",
    items: [
      {
        title: "Matriz",
        description: "Ranking clientes",
        href: "/matriz",
        icon: Users,
        color: "from-emerald-600 to-emerald-800",
        ready: true,
      },
      {
        title: "Positivação",
        description: "Clientes ativos",
        href: "/positivacao",
        icon: CheckCircle2,
        color: "from-indigo-600 to-indigo-800",
        ready: true,
      },
      {
        title: "Posit. Matriz",
        description: "Matriz e Cliente",
        href: "/positivacao-matriz",
        icon: CheckCircle2,
        color: "from-cyan-600 to-cyan-800",
        ready: true,
      },
      {
        title: "Carteira",
        description: "Base ativa",
        href: "/carteira",
        icon: Briefcase,
        color: "from-teal-600 to-teal-800",
        ready: false,
      },
      {
        title: "Preço",
        description: "R$/Kg análise",
        href: "/preco",
        icon: TrendingUp,
        color: "from-orange-600 to-orange-800",
        ready: false,
      },
      {
        title: "Mix",
        description: "Composição SKU",
        href: "/mix",
        icon: PieChart,
        color: "from-pink-600 to-pink-800",
        ready: false,
      },
    ],
  },
  {
    category: "Gestão",
    items: [
      {
        title: "Metas",
        description: "Cadastro metas",
        href: "/metas",
        icon: Target,
        color: "from-violet-600 to-violet-800",
        ready: true,
      },
      {
        title: "Coffee_IA",
        description: "Pergunte aos dados",
        href: "/coffee-ia",
        icon: Sparkles,
        color: "from-amber-500 to-yellow-600",
        ready: true,
      },
      {
        title: "Atendimento",
        description: "Regras PDV e UFs",
        href: "/atendimento",
        icon: Users,
        color: "from-fuchsia-600 to-fuchsia-800",
        ready: true,
      },
      {
        title: "Upload",
        description: "Importar planilhas",
        href: "/upload",
        icon: Upload,
        color: "from-rose-600 to-rose-800",
        ready: true,
      },
      {
        title: "Investimento",
        description: "Gestão por cliente",
        href: "/investimento",
        icon: TrendingUp,
        color: "from-emerald-600 to-emerald-800",
        ready: true,
      },
      {
        title: "Tributos",
        description: "Tributação SKU",
        href: "/tributos",
        icon: Receipt,
        color: "from-sky-600 to-sky-800",
        ready: true,
      },
      {
        title: "Bonif.",
        description: "Bonificações",
        href: "/bonif",
        icon: Package,
        color: "from-indigo-600 to-indigo-800",
        ready: false,
      },
      {
        title: "Devol.",
        description: "Devoluções",
        href: "/devol",
        icon: Layers,
        color: "from-slate-600 to-slate-800",
        ready: false,
      },
    ],
  },
  {
    category: "Smart Hub",
    items: [
      {
        title: "Alertas",
        description: "Ações de retenção",
        href: "/alertas",
        icon: AlertTriangle,
        color: "from-red-600 to-red-800",
        ready: true,
      },
      {
        title: "E-mails",
        description: "Envio de relatórios",
        href: "/emails",
        icon: Mail,
        color: "from-orange-500 to-orange-700",
        ready: true,
      },
    ],
  },
];

export default function HomePage() {
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
            </p>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
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
          {modules.map((group) => (
            <section key={group.category}>
              <h3 className="text-[0.6rem] font-semibold uppercase tracking-widest text-gold mb-3">
                {group.category}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {group.items.map((mod) => {
                  const Icon = mod.icon;
                  return (
                    <Link
                      key={mod.title}
                      href={mod.href}
                      className={`glass-card group relative overflow-hidden p-3 transition-all duration-200 hover:scale-[1.02] hover:border-gold/40 ${
                        !mod.ready ? "opacity-50 pointer-events-none" : ""
                      }`}
                    >
                      {/* Gradient orb background */}
                      <div
                        className={`absolute -top-6 -right-6 w-16 h-16 rounded-full bg-gradient-to-br ${mod.color} opacity-15 group-hover:opacity-25 transition-opacity blur-xl`}
                      />

                      <div className="relative z-10">
                        <div
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br ${mod.color} mb-2`}
                        >
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <h4 className="text-sm font-semibold text-foreground leading-tight">
                          {mod.title}
                        </h4>
                        <p className="text-[0.65rem] text-muted leading-snug mt-0.5">
                          {mod.description}
                        </p>
                        {!mod.ready && (
                          <span className="mt-1.5 inline-block text-[0.55rem] bg-border/50 text-dim px-1.5 py-0.5 rounded">
                            Em breve
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
