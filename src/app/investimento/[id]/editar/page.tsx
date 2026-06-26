import { createClient } from "@/lib/supabase/server";
import { InvestmentForm } from "@/app/investimento/lancar/InvestmentForm";
import { notFound } from "next/navigation";
import { obterRedesMatrizes } from "@/app/investimento/lancar/actions";

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

  // Fetch matrices with their codes from database
  const redesList = await obterRedesMatrizes();

  // Hardcoded product families as requested
  const familiasList = [
    "Grão",
    "Moído",
    "Drip",
    "Capsula",
    "1KG"
  ];

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-16 pt-8">
        <InvestmentForm redes={redesList} familias={familiasList} initialData={investment} />
      </main>
    </div>
  );
}
