import { createClient } from "@/lib/supabase/server";
import { InvestmentForm } from "./InvestmentForm";
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
  const familiasList = [
    "Grão",
    "Moído",
    "Drip",
    "Capsula",
    "KG"
  ];

  // Fetch SKUs
  let skusList: string[] = [];
  const { data: dbFilters } = await supabase.rpc('get_dashboard_filters_rpc');
  if (dbFilters?.produtos) {
    skusList = dbFilters.produtos;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-16 pt-8">
        <InvestmentForm redes={redesList} familias={familiasList} skus={skusList} />
      </main>
    </div>
  );
}
