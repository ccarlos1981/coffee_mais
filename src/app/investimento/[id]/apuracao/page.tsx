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
      .select("role, name, manager_name")
      .eq("id", user.id)
      .single();

    if (profile?.role === "Gerente Regional") {
      const userEmail = user.email || "";
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

  // Buscar contexto da Campanha e Ações Irmãs para avaliação de Multi-Action e Prontidão Financeira
  let campanha: any = null;
  let isMultiAction = false;
  let todasAcoesProntas = true;
  let totalCampanha = Math.round((Number(investment.valor_investimento) || 0) * 100) / 100;
  let acoesAtivasCount = 1;
  let acoesNaoProntasCount = 0;

  let acoesCampanha: any[] = [];

  if (investment.campanha_id) {
    const [campanhaRes, acoesRes] = await Promise.all([
      supabase
        .from("cm_campanhas")
        .select("id, tipo_plano_financeiro, saldo_financeiro_devedor, valor_total_projetado, status_financeiro")
        .eq("id", investment.campanha_id)
        .single(),
      supabase
        .from("cm_acoes_investimento")
        .select("id, fase_atual, valor_investimento, cancel_reason, tipo_acao, apuracao_valor_realizado, apuracao_qtd_vendida")
        .eq("campanha_id", investment.campanha_id)
        .is("cancel_reason", null)
    ]);

    campanha = campanhaRes.data || null;
    const acoesAtivas = (acoesRes.data || []).filter((a: any) => !a.cancel_reason);
    acoesCampanha = acoesAtivas;
    acoesAtivasCount = Math.max(1, acoesAtivas.length);
    isMultiAction = acoesAtivas.length > 1;

    // Regra oficial: todasAcoesProntas = COUNT(ações ativas com fase_atual < 3) = 0
    const acoesAbaixoFase3 = acoesAtivas.filter((a: any) => Number(a.fase_atual || 1) < 3);
    acoesNaoProntasCount = acoesAbaixoFase3.length;
    todasAcoesProntas = acoesNaoProntasCount === 0;

    // Total financeiro canônico da campanha: SUM(valor_investimento das ações ativas)
    // PROIBIDO multiplicar por volume ou alterar valor_investimento (SSOT Gate 5.15)
    if (acoesAtivas.length > 0) {
      const sumTotal = acoesAtivas.reduce((acc: number, a: any) => acc + (Number(a.valor_investimento) || 0), 0);
      totalCampanha = Math.round(sumTotal * 100) / 100;
    }
  } else {
    acoesCampanha = [investment];
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-16 pt-8">
        <ApuracaoForm 
          investment={investment} 
          matrizNome={resolvedMatriz} 
          initialBoletos={boletosAbertos}
          campanha={campanha}
          isMultiAction={isMultiAction}
          todasAcoesProntas={todasAcoesProntas}
          totalCampanha={totalCampanha}
          acoesAtivasCount={acoesAtivasCount}
          acoesNaoProntasCount={acoesNaoProntasCount}
          acoesCampanha={acoesCampanha}
        />
      </main>
    </div>
  );
}
