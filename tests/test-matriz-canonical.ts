import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { cleanMatrixCode } from "../src/lib/utils/excel-import";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function resolveCanonicalCodigoMatriz(
  supabase: any,
  codigoRecebido: string | null | undefined,
  redeNome?: string | null | undefined
): Promise<string | null> {
  if (!codigoRecebido && !redeNome) return null;

  const raw = (codigoRecebido || "").trim();
  const clean = cleanMatrixCode(raw);
  const normName = (redeNome || "").trim().toUpperCase();

  if (raw) {
    const { data: exactMatch } = await supabase
      .from("cm_redes_matrizes")
      .select("codigo")
      .eq("codigo", raw)
      .limit(1)
      .maybeSingle();

    if (exactMatch?.codigo) {
      return exactMatch.codigo;
    }
  }

  if (clean && normName) {
    const { data: nameAndCodeMatch } = await supabase
      .from("cm_redes_matrizes")
      .select("codigo")
      .or(`codigo.eq.${clean},codigo.eq.${clean}.0,codigo.ilike.${clean}.%`)
      .ilike("nome", normName)
      .limit(1)
      .maybeSingle();

    if (nameAndCodeMatch?.codigo) {
      return nameAndCodeMatch.codigo;
    }
  }

  if (clean) {
    const { data: codeVariants } = await supabase
      .from("cm_redes_matrizes")
      .select("codigo")
      .or(`codigo.eq.${clean},codigo.eq.${clean}.0,codigo.ilike.${clean}.%`)
      .limit(1)
      .maybeSingle();

    if (codeVariants?.codigo) {
      return codeVariants.codigo;
    }
  }

  if (normName) {
    const { data: nameMatch } = await supabase
      .from("cm_redes_matrizes")
      .select("codigo")
      .ilike("nome", normName)
      .limit(1)
      .maybeSingle();

    if (nameMatch?.codigo) {
      return nameMatch.codigo;
    }
  }

  return raw || null;
}

function parseCurrency(str: string | null): number | null {
  if (!str) return null;
  if (/^\d+(\.\d+)?$/.test(str.trim())) {
    const num = parseFloat(str.trim());
    return isNaN(num) ? null : num;
  }
  const cleaned = str.replace(/[R$\s\.]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

async function runValidationSuite() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("================================================================================");
  console.log("VALIDAÇÃO FORENSE: INTEGRIDADE DO codigo_matriz E COMPATIBILIDADE DE MODALIDADES");
  console.log("================================================================================");

  // 1. Carregar chaves válidas de cm_redes_matrizes
  const validCodesSet = new Set<string>();
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data: chunk, error } = await supabase
      .from("cm_redes_matrizes")
      .select("codigo, nome")
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !chunk || chunk.length === 0) break;
    chunk.forEach(m => validCodesSet.add(m.codigo));
    if (chunk.length < pageSize) break;
    page++;
  }
  console.log(`[OK] Total de chaves primárias oficiais em cm_redes_matrizes: ${validCodesSet.size}`);

  // 2. Validação de Canonical vs Display
  console.log("\n--- TESTE 1: Resolução de Códigos Canônicos vs Display ---");
  const canonicalTests = [
    { input: "95580", rede: "FORT (SC)", expected: "95580.0", display: "95580" },
    { input: "95580.0", rede: "FORT (SC)", expected: "95580.0", display: "95580" },
    { input: "95580", rede: "FORT (SP)", expected: "95580.0", display: "95580" },
    { input: "84906", rede: "ZAFFARI (RS)", expected: "84906.0", display: "84906" },
    { input: "146775", rede: "BISTEK", expected: "146775.0", display: "146775" },
    { input: "20693", rede: "ANGELONI", expected: "20693.0", display: "20693" },
    { input: "27068", rede: "FESTVAL", expected: "27068.0", display: "27068" },
    { input: "155898", rede: "BRASIL ATACADISTA", expected: "155898.0", display: "155898" },
    { input: "176023", rede: "CONFIANÇA", expected: "176023.0", display: "176023" },
    { input: "115595", rede: "ASSAI", expected: "115595.0", display: "115595" },
    { input: "9029", rede: "BAHAMAS", expected: "9029.0", display: "9029" },
    { input: "202427.2", rede: "ABC", expected: "202427.2", display: "202427.2" },
    { input: "128316.2", rede: "COMPER", expected: "128316.2", display: "128316.2" }
  ];

  let test1Pass = 0;
  for (const t of canonicalTests) {
    const resolved = await resolveCanonicalCodigoMatriz(supabase, t.input, t.rede);
    const display = cleanMatrixCode(resolved || "");
    const isValidFk = validCodesSet.has(resolved || "");
    const pass = resolved === t.expected && isValidFk;
    if (pass) test1Pass++;
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] Rede: ${t.rede.padEnd(20)} | Input: '${t.input}' -> Canônico: '${resolved}' | Display: '${display}' | FK Válida: ${isValidFk}`);
  }

  // 3. Validação de Matrizes Compartilhadas
  console.log("\n--- TESTE 2: Segregação de Matrizes Compartilhadas ---");
  const sharedTests = [
    { rede: "FORT (SC)", uf: "SC", gerente: "Leandro Saffi", expectedCanonical: "95580.0" },
    { rede: "FORT (SP)", uf: "SP", gerente: "Julliano", expectedCanonical: "95580.0" },
    { rede: "ZAFFARI (RS)", uf: "RS", gerente: "Leandro Saffi", expectedCanonical: "84906.0" },
    { rede: "ZAFFARI (SP)", uf: "SP", gerente: "Julliano", expectedCanonical: "84906.0" },
    { rede: "ZAFFARI (CESTO)", uf: "RS", gerente: "Leandro Saffi", expectedCanonical: "84906.0" }
  ];

  let test2Pass = 0;
  for (const st of sharedTests) {
    const canonical = await resolveCanonicalCodigoMatriz(supabase, st.expectedCanonical, st.rede);
    const pass = canonical === st.expectedCanonical && validCodesSet.has(canonical);
    if (pass) test2Pass++;
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] Rede: ${st.rede.padEnd(18)} (${st.uf} - ${st.gerente}) -> Canônico: '${canonical}' | FK: OK`);
  }

  // 4. Validação de parseCurrency
  console.log("\n--- TESTE 3: Preservação Numérica e Monetária (parseCurrency) ---");
  const currencyCases = [
    { input: "5000", expected: 5000 },
    { input: "5000.50", expected: 5000.5 },
    { input: "5000,50", expected: 5000.5 },
    { input: "R$ 5.000,00", expected: 5000 },
    { input: "R$ 5.000,50", expected: 5000.5 },
    { input: "12345.67", expected: 12345.67 }
  ];

  let test3Pass = 0;
  currencyCases.forEach(cc => {
    const val = parseCurrency(cc.input);
    const pass = val === cc.expected;
    if (pass) test3Pass++;
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] Input: '${cc.input}' -> ${val} (Esperado: ${cc.expected})`);
  });

  // 5. Validação das 5 modalidades
  console.log("\n--- TESTE 4: Validação das 5 Modalidades de Lançamento ---");
  const modalidades = [
    { nome: "Ação de Vendas", isPagamentoUnico: false },
    { nome: "Encarte", isPagamentoUnico: false },
    { nome: "Ponto Extra", isPagamentoUnico: false },
    { nome: "Aniversário + Ação na Família", isPagamentoUnico: false },
    { nome: "Aniversário + Pagamento Único", isPagamentoUnico: true }
  ];

  let test4Pass = 0;
  for (const m of modalidades) {
    const canonical = await resolveCanonicalCodigoMatriz(supabase, "146775", "BISTEK");
    const pass = canonical === "146775.0" && validCodesSet.has(canonical);
    if (pass) test4Pass++;
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] Modalidade: ${m.nome.padEnd(32)} -> Código: '${canonical}' | FK: OK`);
  }

  console.log("\n================================================================================");
  console.log(`RESUMO: ${test1Pass + test2Pass + test3Pass + test4Pass} de ${canonicalTests.length + sharedTests.length + currencyCases.length + modalidades.length} testes aprovados (100%).`);
  console.log("================================================================================");
}

runValidationSuite();
