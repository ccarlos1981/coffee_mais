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

  // Buscar boletos em aberto para a rede
  const todayStr = new Date().toISOString().split('T')[0];
  let boletosAbertos: any[] = [];
  try {
    const cleanWord = resolvedMatriz.replace(/[\(\),]/g, ' ').trim().split(' ')[0];
    const { data: boletos } = await supabase
      .from("cm_boletos")
      .select("*")
      .or(`rede.ilike.%${cleanWord}%,rede.ilike.%${investment.rede}%`)
      .eq("status", "Aberto")
      .gte("vencimento", todayStr)
      .order("vencimento", { ascending: true })
      .limit(60);
    boletosAbertos = boletos || [];
  } catch (err) {
    console.error("Erro ao buscar boletos para apuração:", err);
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-16 pt-8">
        <ApuracaoForm investment={investment} matrizNome={resolvedMatriz} initialBoletos={boletosAbertos} />
      </main>
    </div>
  );
}
