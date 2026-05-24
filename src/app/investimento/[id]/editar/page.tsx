import { createClient } from "@/lib/supabase/server";
import { InvestmentForm } from "@/app/investimento/lancar/InvestmentForm";
import { notFound } from "next/navigation";

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
    .from("cm_acoes_investimento")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !investment) {
    notFound();
  }

  // Fetch unique redes handling Supabase 1000 rows limit
  let allRedesData: any[] = [];
  let hasMore = true;
  let page = 0;
  
  while (hasMore) {
    const { data } = await supabase
      .from("base_atendimento")
      .select("rede")
      .not("rede", "is", null)
      .range(page * 1000, (page + 1) * 1000 - 1);
      
    if (data && data.length > 0) {
      allRedesData = [...allRedesData, ...data];
      page++;
      if (data.length < 1000) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  const redesList = allRedesData ? Array.from(new Set(allRedesData.map(r => r.rede))).filter(Boolean) as string[] : [];
  redesList.sort();

  // Hardcoded product families as requested
  const familiasList = [
    "Grão",
    "Moído",
    "Drip",
    "Capsula",
    "KG"
  ];

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-16 pt-8">
        <InvestmentForm redes={redesList} familias={familiasList} initialData={investment} />
      </main>
    </div>
  );
}
