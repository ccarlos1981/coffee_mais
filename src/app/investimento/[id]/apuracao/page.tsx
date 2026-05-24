import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ApuracaoForm } from "./ApuracaoForm";

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

  // Only allow apuração if phase is 2
  if (investment.fase_atual !== 2) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-16 pt-8">
        <ApuracaoForm investment={investment} />
      </main>
    </div>
  );
}
