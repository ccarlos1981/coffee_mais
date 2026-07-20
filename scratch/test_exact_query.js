const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ncncazbhpoxjlyvcbvqa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTc3MjcsImV4cCI6MjA5MTE3MzcyN30.oiasBJu4C-ULzhACvszrSn7O1vM_v0hyJ_AYjzVRtoA'
);

async function test() {
  // === TEST 1: Exactly what fetchClientes does ===
  // Line 155: getFilteredQuery("*", { count: "exact" })
  // Line 98: const select = selectStr ? selectStr : defaultSelect;
  // selectStr = "*", so select = "*" — NO atividade relation!
  console.log("=== TEST 1: fetchClientes actual query (select '*') ===");
  const { data: data1, error: err1 } = await supabase
    .from('cm_clientes')
    .select('*', { count: 'exact' })
    .eq('codigo', 178625)
    .limit(1);

  if (err1) console.error("Error:", err1);
  else {
    console.log("Keys returned:", Object.keys(data1[0]));
    console.log("Has 'atividade' key?", 'atividade' in data1[0]);
    console.log("atividade value:", data1[0].atividade);
    console.log("ultima_compra value:", data1[0].ultima_compra);
  }

  // === TEST 2: What the query SHOULD be (with atividade) ===
  console.log("\n=== TEST 2: correct query (select '*, atividade:cm_clientes_atividade(*)') ===");
  const { data: data2, error: err2 } = await supabase
    .from('cm_clientes')
    .select('*, atividade:cm_clientes_atividade(*)', { count: 'exact' })
    .eq('codigo', 178625)
    .limit(1);

  if (err2) console.error("Error:", err2);
  else {
    console.log("Has 'atividade' key?", 'atividade' in data2[0]);
    console.log("atividade value:", JSON.stringify(data2[0].atividade, null, 2));
  }
}

test();
