import { createAdminClient } from "@/lib/supabase/admin";
import { createUser, deleteUser } from "./actions";
import { DeleteUserButton } from "./DeleteUserButton";
import { EditUserRoleSelect } from "./EditUserRoleSelect";
import { EditUserPdfPreferences } from "./EditUserPdfPreferences";
import { UserList } from "./UserList";
import { Coffee, Mail, Lock, Plus, Trash2, UserPlus, AlertCircle } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";

export const metadata = {
  title: "Gestão de Usuários - Coffee Mais",
};

export default async function AdminUsuariosPage() {
  let users: any[] = [];
  let profilesMap: Record<string, any> = {};
  let fetchError = null;

  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.auth.admin.listUsers();
    
    if (error) throw error;
    users = data.users || [];

    // Busca os perfis (funções) tentando as novas colunas de PDF
    let profilesData: any[] | null = null;
    const response = await adminClient
      .from('cm_user_profiles')
      .select('id, role, receber_pdf_vendas, receber_pdf_investimento');

    if (response.error) {
      // Se deu erro (ex: colunas não existem ainda), faz fallback apenas para role
      const fallbackResponse = await adminClient
        .from('cm_user_profiles')
        .select('id, role');
      profilesData = fallbackResponse.data;
    } else {
      profilesData = response.data;
    }

    if (profilesData) {
      profilesMap = profilesData.reduce((acc: any, curr: any) => {
        acc[curr.id] = curr;
        return acc;
      }, {});
    }
  } catch (err: any) {
    fetchError = err.message || "Erro ao carregar usuários. Verifique se a SUPABASE_SERVICE_ROLE_KEY está configurada.";
  }

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

  return (
    <div className="flex h-screen bg-background font-sans transition-colors duration-300">
      <main className="flex-1 overflow-auto bg-[url('/noise.png')] bg-repeat opacity-95">
        <div className="p-8 max-w-6xl mx-auto space-y-8">
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                <Coffee className="w-8 h-8 text-accent-gold" />
                Gestão de Usuários
              </h1>
              <p className="text-foreground-secondary mt-2">
                Controle quem tem acesso à plataforma Coffee Mais.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <a href="/admin/permissoes" className="px-4 py-2 text-sm text-foreground-secondary border border-border rounded-lg hover:bg-foreground/5 transition-colors">
                Configurar Acessos
              </a>
              <a href="/" className="px-4 py-2 text-sm text-accent-gold border border-accent-gold/30 rounded-lg hover:bg-accent-gold/10 transition-colors">
                Voltar ao Dashboard
              </a>
            </div>
          </div>

          {fetchError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold">Erro de Configuração</h3>
                <p className="text-sm mt-1">{fetchError}</p>
                <p className="text-sm mt-2 text-foreground-secondary">
                  ⚠️ Adicione <code className="bg-black/30 px-2 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code> no seu arquivo <code>.env.local</code>.
                </p>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Lista de Usuários */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Usuários Cadastrados ({users.length})</h2>
              
              <UserList 
                users={users} 
                profilesMap={profilesMap} 
                roles={ROLES} 
                deleteAction={deleteUser} 
              />
            </div>

            {/* Form de Criação */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4">Adicionar Acesso</h2>
              <div className="bg-background-card border border-border rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                {/* Glow Effect */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent-gold/30 to-transparent" />
                
                <form action={async (formData) => { "use server"; await createUser(formData); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground-secondary mb-1.5 ml-1">
                      E-mail Corporativo
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 w-5 h-5 text-foreground-muted" />
                      <input
                        type="email"
                        name="email"
                        required
                        placeholder="nome@coffeemais.com"
                        className="w-full bg-background-elevated border border-border rounded-xl py-2.5 pl-11 pr-4 text-foreground placeholder-foreground-muted focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground-secondary mb-1.5 ml-1">
                      Função (Cargo)
                    </label>
                    <div className="relative">
                      <select
                        name="role"
                        required
                        defaultValue="Vendedor"
                        className="w-full bg-background-elevated border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all appearance-none"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-foreground-muted">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground-secondary mb-1.5 ml-1">
                      Senha Inicial
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 w-5 h-5 text-foreground-muted" />
                      <input
                        type="password"
                        name="password"
                        required
                        minLength={6}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-background-elevated border border-border rounded-xl py-2.5 pl-11 pr-4 text-foreground placeholder-foreground-muted focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all"
                      />
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <label className="block text-sm font-medium text-foreground-secondary mb-1.5 ml-1">
                      Relatórios Automáticos (PDF)
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-background-elevated border border-border rounded-xl hover:border-accent-gold/30 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        name="receber_pdf_vendas"
                        className="w-4 h-4 text-accent-gold border-border rounded focus:ring-accent-gold/20"
                      />
                      <span className="text-sm font-medium text-foreground">
                        Receber PDF: <span className="font-semibold">Venda do dia anterior</span>
                      </span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-background-elevated border border-border rounded-xl hover:border-accent-gold/30 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        name="receber_pdf_investimento"
                        className="w-4 h-4 text-accent-gold border-border rounded focus:ring-accent-gold/20"
                      />
                      <span className="text-sm font-medium text-foreground">
                        Receber PDF: <span className="font-semibold">Investimento</span>
                      </span>
                    </label>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      className="w-full bg-accent-gold text-black font-semibold rounded-xl py-3 px-4 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-5 h-5" />
                      Criar Usuário
                    </button>
                  </div>
                  
                  <p className="text-xs text-foreground-muted text-center mt-4">
                    O usuário já poderá logar com esta senha imediatamente.
                  </p>
                </form>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
