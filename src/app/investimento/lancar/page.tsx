import { createClient } from "@/lib/supabase/server";
import { InvestmentForm } from "./InvestmentForm";
import { PRODUCT_FAMILIES } from "@/lib/investimento/constants";
import { obterRedesMatrizes } from "./actions";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Lançar Investimento - Coffee Mais",
};

export const dynamic = 'force-dynamic';

export default async function LancarInvestimentoPage() {
  const supabase = await createClient();

  // 1. Verificação obrigatória de autenticação e redirecionamento seguro
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Verificar se o perfil existe e está aprovado
  const { data: profile } = await supabase
    .from('cm_user_profiles')
    .select('role, approved')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.approved) {
    redirect("/investimento");
  }

  // 3. Fetch matrices with their codes from database com fallback resiliente
  let redesList: any[] = [];
  try {
    redesList = (await obterRedesMatrizes()) || [];
  } catch (err) {
    console.error("[LancarInvestimentoPage] Erro ao carregar redes:", err);
    redesList = [];
  }

  // Hardcoded product families as requested
  const familiasList = [...PRODUCT_FAMILIES];

  // 4. Fetch SKUs: busca prioritariamente em v_produtos_detalhes (rápido e SSOT de produtos),
  // com fallback resiliente para get_dashboard_filters_rpc para evitar timeout em SSR
  let skusList: string[] = [];
  try {
    const { data: produtosData } = await supabase
      .from('v_produtos_detalhes')
      .select('product_name')
      .order('product_name');

    if (produtosData && produtosData.length > 0) {
      skusList = produtosData.map((p: any) => p.product_name).filter(Boolean);
    } else {
      const { data: dbFilters } = await supabase.rpc('get_dashboard_filters_rpc');
      if (dbFilters?.produtos) {
        skusList = dbFilters.produtos;
      }
    }
  } catch (skuErr) {
    console.warn("[LancarInvestimentoPage] Erro ao carregar SKUs:", skuErr);
  }

  const canCreateTest = Boolean(profile && ['Trade', 'Admin'].includes(profile.role));

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-16 pt-8">
        <InvestmentForm 
          redes={redesList} 
          familias={familiasList} 
          skus={skusList} 
          canCreateTest={canCreateTest}
        />
      </main>
    </div>
  );
}
