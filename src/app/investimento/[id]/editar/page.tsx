import { createClient } from "@/lib/supabase/server";
import { InvestmentForm } from "@/app/investimento/lancar/InvestmentForm";
import { notFound } from "next/navigation";
import { obterRedesMatrizes } from "@/app/investimento/lancar/actions";
import { PRODUCT_FAMILIES } from "@/lib/investimento/constants";

export const metadata = {
  title: "Editar Investimento - Coffee Mais",
};

export const dynamic = 'force-dynamic';

export default async function EditarInvestimentoPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const id = (await params).id;
  
  if (!id) {
    notFound();
  }

  // Fetch the current investment data
  const { data: investment, error } = await supabase
    .from("v_acoes_investimento_com_gerente")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !investment) {
    notFound();
  }

  // Validação estrita de visibilidade/ownership para Gerente Regional
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("role, name, manager_name, email")
      .eq("id", user.id)
      .single();

    if (profile?.role === "Gerente Regional") {
      const userEmail = profile.email || user.email || "";
      const emailPrefix = userEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanProf = (profile.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanMgr = (profile.manager_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanGerente = (investment.gerente_responsavel || "").toLowerCase().replace(/[^a-z0-9]/g, "");

      const isOwner = cleanGerente && (
        (emailPrefix && (emailPrefix.startsWith(cleanGerente) || cleanGerente.startsWith(emailPrefix))) ||
        (cleanProf && (cleanProf.startsWith(cleanGerente) || cleanGerente.startsWith(cleanProf))) ||
        (cleanMgr && (cleanMgr.startsWith(cleanGerente) || cleanGerente.startsWith(cleanMgr)))
      );

      if (!isOwner) {
        notFound();
      }
    }
  }

  // Verificar permissão para ação de teste (RBAC Estrito: Trade, Admin)
  let canCreateTest = false;
  if (user) {
    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile && ["Trade", "Admin"].includes(profile.role)) {
      canCreateTest = true;
    }
  }

  // Fetch matrices with their codes from database
  const redesList = await obterRedesMatrizes();

  // Hardcoded product families as requested
  const familiasList = [...PRODUCT_FAMILIES];

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-16 pt-8">
        <InvestmentForm 
          redes={redesList} 
          familias={familiasList} 
          initialData={investment} 
          canCreateTest={canCreateTest}
        />
      </main>
    </div>
  );
}
