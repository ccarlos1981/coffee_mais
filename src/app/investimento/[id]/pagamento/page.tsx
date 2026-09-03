import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PagamentoForm } from "./PagamentoForm";
import { buildMatrizLookup, resolveClienteMatriz } from "@/lib/investimento/matriz-resolver";

export const metadata = {
  title: "Pagamento - Coffee Mais",
};

export const dynamic = 'force-dynamic';

export default async function PagamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const id = (await params).id;
  
  if (!id) notFound();

  const { data: investment, error } = await supabase
    .from("v_acoes_investimento_com_gerente")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !investment) notFound();

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

  // Only allow payment if phase is 5 (Aguardando Pagamento)
  if (investment.fase_atual !== 5) {
    notFound();
  }

  let resolvedMatriz = investment.rede;
  const { data: clients } = await supabase
    .from("cm_clientes")
    .select("codigo, codigo_matriz, matriz, uf, regional, responsavel, tipo_parceiro, nome_parceiro, razao_social");
  if (clients) {
    const lookup = buildMatrizLookup(clients);
    const res = resolveClienteMatriz({
      codigo: investment.codigo,
      codigo_matriz: investment.codigo_matriz,
      rede: investment.rede,
      responsavel: investment.gerente_responsavel,
      uf: investment.uf,
    }, lookup);
    resolvedMatriz = res.matriz;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-16 pt-8">
        <PagamentoForm investment={investment} matrizNome={resolvedMatriz} />
      </main>
    </div>
  );
}
