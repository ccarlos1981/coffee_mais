import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PagamentoForm } from "./PagamentoForm";

export const metadata = {
  title: "Pagamento - Coffee Mais",
};

export const dynamic = 'force-dynamic';

export default async function PagamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const id = (await params).id;
  
  if (!id) notFound();

  const { data: investment, error } = await supabase
    .from("cm_acoes_investimento")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !investment) notFound();

  if (investment.fase_atual !== 4) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-16 pt-8">
        <PagamentoForm investment={investment} />
      </main>
    </div>
  );
}
