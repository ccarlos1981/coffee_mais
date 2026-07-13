import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  Users,
  LogOut,
  Bell
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { DashboardClient } from "@/components/DashboardClient";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function HomePage() {
  const supabase = await createClient();
  
  // Obter usuário logado
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }

  // Registrar log de acesso do usuário usando service role (contorna RLS)
  try {
    const adminClient = createAdminClient();
    await adminClient.from("cm_audit_logs").insert({
      user_id: user!.id,
      action: "Acesso",
      table_name: "dashboard"
    });
  } catch (e) {
    console.error("Erro ao gravar log de acesso:", e);
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
  let initialFavorites: string[] = [];
  
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

    // Buscar favoritos do usuário ordenados por display_order (com nulls last) e criados em ordem crescente
    const { data: favoritesData } = await supabase
      .from("cm_user_favorites")
      .select("module_key")
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (favoritesData) {
      initialFavorites = favoritesData.map(f => f.module_key);
    }
  }

  const isSuperAdmin = role === 'CEO' && allowedModuleNames.length === 0;
  const canManageUsers = isSuperAdmin || allowedModuleNames.includes('Usuários');

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

        <DashboardClient
          role={role}
          allowedModuleNames={allowedModuleNames}
          hasConfigInDb={hasConfigInDb}
          initialFavorites={initialFavorites}
        />
      </main>
    </div>
  );
}
