import { createClient } from "@/lib/supabase/server";
import { InvestmentForm } from "./InvestmentForm";
import { PRODUCT_FAMILIES } from "@/lib/investimento/constants";
import { obterRedesMatrizes } from "./actions";

export const metadata = {
  title: "Lançar Investimento - Coffee Mais",
};

export const dynamic = 'force-dynamic';

export default async function LancarInvestimentoPage() {
  const supabase = await createClient();

  // Fetch matrices with their codes from database
  const redesList = await obterRedesMatrizes();

  // Hardcoded product families as requested
  const familiasList = [...PRODUCT_FAMILIES];

  // Fetch SKUs
  let skusList: string[] = [];
  const { data: dbFilters } = await supabase.rpc('get_dashboard_filters_rpc');
  if (dbFilters?.produtos) {
    skusList = dbFilters.produtos;
  }

  // Verificar perfil para permissão de ação de teste (RBAC Estrito: Trade, Admin)
  const { data: { user } } = await supabase.auth.getUser();
  let canCreateTest = false;
  if (user) {
    const { data: profile } = await supabase
      .from('cm_user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile && ['Trade', 'Admin'].includes(profile.role)) {
      canCreateTest = true;
    }
  }

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
