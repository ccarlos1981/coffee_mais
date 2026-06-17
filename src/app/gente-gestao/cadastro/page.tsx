import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmployeeDashboard } from "./EmployeeDashboard";
import { AlertTriangle, Coffee } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Cadastro de Funcionários - Coffee Mais",
  description: "Gerenciamento de dados cadastrais e cargos de colaboradores.",
};

export default async function GenteGestaoCadastroPage() {
  const supabase = await createClient();
  
  // 1. Obter usuário logado
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Buscar perfil para descobrir a role
  const { data: profile } = await supabase
    .from('cm_user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  const role = profile?.role;
  let hasAccess = false;
  
  if (role === 'CEO') {
    hasAccess = true;
  } else if (role) {
    // Buscar se o cargo tem permissão ativa para o módulo Gente e Gestão
    const { data: permission } = await supabase
      .from('cm_role_permissions')
      .select('has_access')
      .eq('role', role)
      .eq('module_name', 'Gente e Gestão')
      .eq('has_access', true)
      .maybeSingle();
      
    if (permission) {
      hasAccess = true;
    }
  }

  // 3. Se não tiver acesso, renderizar tela de erro amigável
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
        <div className="max-w-md w-full p-8 rounded-2xl bg-background-card border border-border text-center space-y-4 shadow-2xl relative overflow-hidden">
          {/* Accent line */}
          <div className="absolute top-0 inset-x-0 h-1 bg-red-500" />
          
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          
          <h1 className="text-xl font-bold tracking-tight">Acesso Não Autorizado</h1>
          
          <p className="text-sm text-foreground-secondary leading-relaxed">
            Seu cargo ({role || "Sem cargo definido"}) não possui permissões necessárias para visualizar ou alterar o Cadastro de Funcionários.
          </p>
          
          <div className="pt-4 flex flex-col gap-2">
            <Link 
              href="/" 
              id="btn-access-denied-home"
              className="w-full py-2.5 px-4 bg-foreground/5 text-foreground hover:bg-foreground/10 font-semibold rounded-xl text-sm border border-border transition-colors flex items-center justify-center gap-2"
            >
              Voltar ao Início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. Buscar funcionários cadastrados
  const { data: employees, error } = await supabase
    .from("cm_employees")
    .select("*")
    .order("nome_completo", { ascending: true });

  if (error) {
    console.error("Erro ao carregar funcionários:", error);
  }

  return (
    <EmployeeDashboard employees={employees || []} />
  );
}
