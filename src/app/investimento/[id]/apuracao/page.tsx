import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ApuracaoForm } from "./ApuracaoForm";
import { buildMatrizLookup, resolveClienteMatriz } from "@/lib/investimento/matriz-resolver";

export const metadata = {
  title: "Apuração - Coffee Mais",
};

export const dynamic = 'force-dynamic';

export default async function ApuracaoPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const id = (await params).id;
  
  if (!id) notFound();

  const { data: investment, error } = await supabase
    .from("cm_acoes_investimento")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !investment) notFound();

  // Only allow apuração if phase is 3 (Apuração Comercial)
  if (investment.fase_atual !== 3) {
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
        <ApuracaoForm investment={investment} matrizNome={resolvedMatriz} />
      </main>
    </div>
  );
}
