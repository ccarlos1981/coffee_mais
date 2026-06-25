import { createAdminClient } from "@/lib/supabase/admin";
import { Shield, AlertCircle } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { PermissionToggle } from "./PermissionToggle";
import Link from "next/link";
import { Fragment } from "react";


interface RolePermission {
  id?: string;
  role: string;
  module_name: string;
  has_access: boolean;
  created_at?: string;
}

export const metadata = {
  title: "Configurar Acesso - Coffee Mais",
};

const ROLES = [
  "Admin",
  "CEO",
  "Diretor",
  "Gerente Nacional",
  "Gerente Regional",
  "Trade",
  "Supervisor",
  "Vendedor",
  "Promotor",
  "Financeiro",
  "RH"
];

const CATEGORIZED_MODULES = [
  {
    category: "Faturamento e Volume",
    modules: [
      "Vendas",
      "Histórico",
      "Hist. Matriz",
      "Hist. p/ Matriz",
      "Preço",
      "Dia",
      "MaCo",
      "DRE"
    ]
  },
  {
    category: "Análise",
    modules: [
      "Matriz",
      "Positivação",
      "Posit. Matriz",
      "Carteira",
      "Mix"
    ]
  },
  {
    category: "Processo Comercial",
    modules: [
      "RPS",
      "RDM",
      "Agenda",
      "Follow Up"
    ]
  },
  {
    category: "Trade",
    modules: [
      "Dashboard",
      "Calendário de invest.",
      "Planej. de Invest.",
      "Invest. oficial",
      "Calendário Anual"
    ]
  },
  {
    category: "Módulo Promotor",
    modules: [
      "Ponto Promotor",
      "Agenda Promotor",
      "Painel Supervisor",
      "Central de Rotas e SLAs",
      "Command Center",
      "Compliance e KPIs",
      "Missões Trade"
    ]
  },
  {
    category: "Gestão",
    modules: [
      "Meta Cia",
      "Metas",
      "Coffee_IA",
      "Atendimento",
      "Upload",
      "Tributos",
      "Bonif.",
      "Devol."
    ]
  },
  {
    category: "Gente e Gestão",
    modules: [
      "Gente e Gestão",
      "Central de Treinamento"
    ]
  },
  {
    category: "Smart Hub",
    modules: [
      "Alertas"
    ]
  },
  {
    category: "Config Financeiro",
    modules: [
      "Cadastro",
      "Clientes"
    ]
  },
  {
    category: "Administração",
    modules: [
      "Usuários",
      "Logs"
    ]
  }
];

const MODULES = CATEGORIZED_MODULES.flatMap(group => group.modules);


export default async function AdminPermissoesPage() {
  let permissions: RolePermission[] = [];
  let fetchError = null;

  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('cm_role_permissions')
      .select('*');
      
    if (error) {
      // Se a tabela não existir ainda, vai dar erro
      if (error.code === '42P01') {
        fetchError = "Tabela de permissões não encontrada. Por favor, execute o script SQL de criação (create_access_control.sql) no banco de dados.";
      } else {
        throw error;
      }
    } else {
      permissions = data || [];
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Erro ao carregar permissões.";
  }

  // Mapa para acesso fácil: permissionsMap['CEO']['Resumo'] = true/false
  const permissionsMap: Record<string, Record<string, boolean>> = {};
  
  ROLES.forEach(role => {
    permissionsMap[role] = {};
    MODULES.forEach(moduleName => {
      // Valor padrão é falso (sem acesso) se não existir no banco
      permissionsMap[role][moduleName] = false;
    });
  });

  permissions.forEach(p => {
    if (permissionsMap[p.role] && permissionsMap[p.role][p.module_name] !== undefined) {
      permissionsMap[p.role][p.module_name] = p.has_access;
    }
  });

  return (
    <div className="flex h-screen bg-background font-sans transition-colors duration-300">
      <main className="flex-1 overflow-auto bg-[url('/noise.png')] bg-repeat opacity-95">
        <div className="p-8 max-w-full mx-auto space-y-8">
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                <Shield className="w-8 h-8 text-accent-gold" />
                Matriz de Acessos
              </h1>
              <p className="text-foreground-secondary mt-2">
                Configure quais módulos cada cargo (função) pode acessar na plataforma.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Link href="/admin/usuarios" className="px-4 py-2 text-sm text-foreground-secondary hover:text-foreground transition-colors">
                Voltar para Usuários
              </Link>
              <Link href="/" className="px-4 py-2 text-sm text-accent-gold border border-accent-gold/30 rounded-lg hover:bg-accent-gold/10 transition-colors">
                Voltar ao Dashboard
              </Link>
            </div>
          </div>

          {fetchError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3 max-w-4xl">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold">Aviso do Sistema</h3>
                <p className="text-sm mt-1">{fetchError}</p>
              </div>
            </div>
          )}

          <div className="bg-background-card border border-border rounded-2xl overflow-x-auto shadow-2xl pb-4">
            <table className="w-full text-left border-collapse min-w-max text-[10px]">
              <thead>
                <tr>
                  <th className="p-2 border-b border-border border-r font-semibold text-foreground bg-background-elevated sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    Módulos / Cargos
                  </th>
                  {ROLES.map(role => (
                    <th key={role} className="p-1 border-b border-border font-semibold text-foreground text-center bg-background-elevated min-w-[80px]">
                      {role}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {CATEGORIZED_MODULES.map(group => (
                  <Fragment key={group.category}>
                    {/* Categoria Header Row */}
                    <tr>
                      <td 
                        colSpan={ROLES.length + 1} 
                        className="p-2.5 sticky left-0 z-10 font-extrabold text-accent-gold uppercase tracking-widest text-[9.5px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)] border-y"
                        style={{ 
                          background: "color-mix(in srgb, var(--accent-gold) 12%, var(--background-elevated))",
                          borderColor: "color-mix(in srgb, var(--accent-gold) 25%, var(--border))"
                        }}
                      >
                        {group.category}
                      </td>
                    </tr>
                    
                    {/* Módulos de cada categoria */}
                    {group.modules.map(moduleName => (
                      <tr key={moduleName} className="hover:bg-foreground/5 transition-colors group">
                        <td className="p-2 pl-5 border-r border-border font-medium text-foreground sticky left-0 bg-background-card group-hover:bg-background-elevated z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                          {moduleName}
                        </td>
                        {ROLES.map(role => (
                          <td key={`${role}-${moduleName}`} className="p-0 border-r border-border last:border-r-0 text-center relative">
                            {!fetchError && (
                              <div className="flex items-center justify-center scale-75 transform origin-center">
                                <PermissionToggle 
                                  role={role} 
                                  moduleName={moduleName} 
                                  hasAccess={permissionsMap[role][moduleName]} 
                                />
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </main>
    </div>
  );
}
