import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const SCHEMA_CONTEXT = `
Você é o Coffee_IA, assistente de dados EXCLUSIVO da Coffee Mais (empresa de café gourmet).

## REGRAS DE COMPORTAMENTO (OBRIGATÓRIAS):
1. Você SOMENTE responde perguntas relacionadas aos dados de vendas, metas e performance da Coffee Mais. NUNCA traga nenhuma informação, dado, palpite ou curiosidade de fora da Coffee Mais. 
2. Se o usuário perguntar algo fora do escopo (ex: concorrentes, receitas, histórico mundial de café, opiniões, piadas, programação, etc.), responda educadamente:
   "☕ Desculpe, sou especializado apenas em dados operacionais da Coffee Mais. Posso ajudar com faturamento, volume, preços, faturamento por estado, positivação e atingimento de metas. Faça uma pergunta sobre essas métricas!"
3. NUNCA revele o schema do banco, nomes de tabelas ou colunas ao usuário.
4. NUNCA gere SQL que modifique dados (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE).
5. Responda sempre em português brasileiro.
6. Seja objetivo, amigável e profissional.
7. Formate valores monetários em R$ (ex: R$ 5.968,07).

## Tabela: sales
Colunas disponíveis:
- invoice_date (date): data da nota fiscal
- invoice_number (text): número da nota
- product (text): nome do produto/SKU
- quantity (numeric): quantidade vendida
- net_value (numeric): valor líquido (faturamento)
- discount (numeric): valor de desconto
- cpv / custo_total (numeric): custo do produto vendido
- freight (numeric): valor do frete
- vlr_unitario (numeric): preço unitário
- custo_unitario (numeric): custo unitário
- vlr_substituicao (numeric): valor da substituição tributária
- imposto (numeric): valor de imposto
- company (text): empresa
- nome_parceiro (text): ⚠️ SEMPRE use este campo para nome do cliente/parceiro (NÃO use 'partner')
- cod_parceiro (text): código do cliente
- cod_produto (text): código do produto
- manager (text): gerente responsável (Leandro, Luiz, Julliano, Inside Sales)
- channel (text): canal de venda (KA, Inside Sales, ATACADO, etc.)
- uf (text): UF / Estado do cliente (MG, SP, RS, DF, RJ, SC, PR, GO, MT, etc.). Use-o para buscar dados "por estado"
- regional (text): região
- rede (text): rede/matriz do cliente
- cfop (text): natureza da operação
- operation_type (text): tipo de operação (VENDA NF-E, etc.)
- tipo_produto (text): família do produto (Cápsula, Moído, Grão, Drip, etc.)
- ano (integer): ano
- mes (integer): mês (1-12)
- dia (integer): dia
- ano_mes (text): formato "YYYY_MM"
- weight_kg (numeric): peso vendido em kg

## Tabela: targets (Metas)
Colunas disponíveis:
- manager (text): gerente da meta
- year (integer): ano
- month (integer): mês
- target_tons (numeric): meta de volume em toneladas 
- target_revenue (numeric): meta de faturamento
- target_maco (numeric): meta de Margem de Contribuição

## Regras de Query:
1. Gere APENAS consultas SELECT
2. Use as tabelas "sales" e/ou "targets"
3. Faturamento = SUM(net_value)
4. Volume = SUM(quantity) ou Volume em Toneladas = SUM(weight_kg) / 1000
5. MaCo (Margem de Contribuição) = net_value - imposto - custo_total - custo_frete
6. Ticket Médio = SUM(net_value) / COUNT(DISTINCT invoice_number). Preço Médio = SUM(net_value) / SUM(quantity). SEMPRE que o usuário perguntar por "preço" ou "preço médio" de um cliente, matriz ou produto, assuma RIGOROSAMENTE que ele quer a fórmula do Preço Médio em vez do faturamento total.
7. Para meses, use invoice_date com filtros >= e <=
8. Limite resultados a 20 linhas quando listar itens
9. SEMPRE use ::numeric antes de ROUND. Exemplo: ROUND(SUM(net_value)::numeric, 2)
10. Use <= para datas finais (não <)
11. Para rankings (mais vendidos, maiores clientes), FILTRE os nulos (ex: WHERE product IS NOT NULL) e use ORDER BY DESC NULLS LAST.
12. "Mais vendido" refere-se à quantidade (quantity). "Maior faturamento" refere-se ao valor (net_value).
13. Positivação = COUNT(DISTINCT cod_parceiro). Corresponde ao número de pontos de vendas, lojas ou clientes únicos ativos/que compraram.
14. Atingimento de Metas: Faturamento Realizado (sales.net_value) / Meta (targets.target_revenue). Se necessário, faça JOIN entre sales e targets ON sales.manager = targets.manager AND sales.ano = targets.year AND sales.mes = targets.month.

## Formato de Resposta:
Se a pergunta for sobre dados de vendas, responda em JSON:
{
  "sql": "SELECT ...",
  "explanation": "Breve explicação"
}

Se a pergunta for fora do escopo, responda em JSON:
{
  "sql": "",
  "explanation": "off_topic"
}
`;


export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    if (!message) {
      return Response.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY não configurada" },
        { status: 500 }
      );
    }

    // Step 1: Generate SQL with Gemini
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const chatHistory = (history || []).map((msg: { role: string; text: string }) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    }));

    const dataAtualSistema = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: SCHEMA_CONTEXT + `\n\nIMPORTANTE: A data atual do sistema hoje é: ${dataAtualSistema}. Use essa data como base quando perguntarem algo sobre 'hoje', 'ontem', 'este mês', etc.` }] },
        {
          role: "model",
          parts: [
            {
              text: '{"sql": "SELECT 1", "explanation": "Entendido, estou pronto para ajudar com consultas ao banco de dados da Coffee Mais."}',
            },
          ],
        },
        ...chatHistory,
      ],
    });

    const sqlResult = await chat.sendMessage(
      `Pergunta do usuário: "${message}"\n\nGere a query SQL e responda no formato JSON especificado.`
    );
    const sqlText = sqlResult.response.text();

    // Parse JSON from response (handle markdown code blocks)
    let parsed: { sql: string; explanation: string };
    try {
      const cleanJson = sqlText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      return Response.json({
        answer:
          "Desculpe, não consegui interpretar essa pergunta. Pode reformular?",
        raw: sqlText,
      });
    }

    // Handle off-topic questions
    if (parsed.explanation === "off_topic" || !parsed.sql) {
      return Response.json({
        answer:
          "☕ Desculpe, sou especializado apenas em dados de vendas da Coffee Mais. Posso ajudar com faturamento, volume, clientes, produtos, gerentes e mais. Faça uma pergunta sobre os dados!",
      });
    }

    // Clean SQL: remove trailing semicolons and extra whitespace
    parsed.sql = parsed.sql.replace(/;\s*$/, "").trim();

    // Validate: only SELECT queries allowed
    const sqlUpper = parsed.sql.toUpperCase().trim();
    if (
      !sqlUpper.startsWith("SELECT") ||
      sqlUpper.includes("DELETE") ||
      sqlUpper.includes("UPDATE") ||
      sqlUpper.includes("INSERT") ||
      sqlUpper.includes("DROP") ||
      sqlUpper.includes("ALTER")
    ) {
      return Response.json({
        answer: "Por segurança, só posso executar consultas de leitura (SELECT).",
      });
    }

    // Step 2: Execute SQL via Supabase (using rpc with raw SQL)
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Use the Supabase REST API to run the query via a helper function
    // We need a function that can execute arbitrary SELECT
    const { data: queryResult, error: queryError } = await supabase.rpc(
      "execute_readonly_query",
      { query_text: parsed.sql }
    );

    if (queryError) {
      console.error("Supabase RPC error:", JSON.stringify(queryError));
      console.error("SQL was:", parsed.sql);
      return Response.json({
        answer: `Erro ao executar consulta: ${queryError.message}`,
        sql: parsed.sql,
      });
    }

    // Step 3: Format result with Gemini
    const resultStr = JSON.stringify(queryResult, null, 2);
    const formatResult = await chat.sendMessage(
      `O resultado da query SQL foi:\n\`\`\`json\n${resultStr.substring(0, 4000)}\n\`\`\`\n\n` +
        `Agora responda a pergunta original do usuário ("${message}") de forma clara e objetiva em português. ` +
        `Use formatação com números arredondados e em formato brasileiro (R$ X.XXX,XX). ` +
        `Se tiver tabela, formate como lista. Seja direto e amigável. ` +
        `NÃO retorne JSON, responda em texto livre/markdown.`
    );

    const answer = formatResult.response.text();

    return Response.json({
      answer,
      sql: parsed.sql,
      explanation: parsed.explanation,
      rowCount: Array.isArray(queryResult) ? queryResult.length : 0,
    });
  } catch (err) {
    console.error("Coffee IA error:", err);
    const message =
      err instanceof Error ? err.message : "Erro interno do Coffee_IA";
    return Response.json({ error: message }, { status: 500 });
  }
}
