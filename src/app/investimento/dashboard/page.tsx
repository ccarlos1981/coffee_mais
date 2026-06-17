import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";

export const metadata = {
  title: "Dashboard de Investimentos - Coffee Mais",
};

export const dynamic = 'force-dynamic';

export default async function InvestimentoDashboardPage() {
  const supabase = await createClient();

  const { data: acoes } = await supabase.from('cm_acoes_investimento').select('*').eq('is_planejamento', false);
  
  // Need to loop because there could be more than 1000 PDVs
  let allPdvs: any[] = [];
  let hasMore = true;
  let page = 0;
  
  while (hasMore) {
    const { data } = await supabase
      .from("base_atendimento")
      .select("rede, uf")
      .not("rede", "is", null)
      .range(page * 1000, (page + 1) * 1000 - 1);
      
    if (data && data.length > 0) {
      allPdvs = [...allPdvs, ...data];
      page++;
      if (data.length < 1000) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  return <DashboardClient acoes={acoes || []} pdvs={allPdvs} />;
}
