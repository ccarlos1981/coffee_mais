// Definição canônica das linhas do DRE — sem "use server"
// Importar deste arquivo em qualquer componente client ou server

export const DRE_LINHAS = [
  { codigo: "volume_tons",       nome: "Volume (Tons)",          ordem: 1,  isBold: false, isHighlight: false, isUnit: false },
  { codigo: "receita_bruta",     nome: "Receita Bruta",          ordem: 2,  isBold: false, isHighlight: true,  isUnit: false },
  { codigo: "impostos",          nome: "Impostos",               ordem: 3,  isBold: false, isHighlight: false, isUnit: false },
  { codigo: "invest_comerciais", nome: "Invest. Comerciais",     ordem: 4,  isBold: false, isHighlight: false, isUnit: false },
  { codigo: "receita_liquida",   nome: "Receita Líquida",        ordem: 5,  isBold: true,  isHighlight: true,  isUnit: false },
  { codigo: "custo_produtos",    nome: "Custo de Produtos",      ordem: 6,  isBold: false, isHighlight: false, isUnit: false },
  { codigo: "fretes",            nome: "Fretes",                 ordem: 7,  isBold: false, isHighlight: false, isUnit: false },
  { codigo: "mrg_contribuicao",  nome: "Mrg de Contribuição",    ordem: 8,  isBold: true,  isHighlight: true,  isUnit: false },
  { codigo: "ggf",               nome: "GGF",                    ordem: 9,  isBold: false, isHighlight: false, isUnit: false },
  { codigo: "depreciacao",       nome: "Depreciação",            ordem: 10, isBold: false, isHighlight: false, isUnit: false },
  { codigo: "armazenagem",       nome: "Armazenagem",            ordem: 11, isBold: false, isHighlight: false, isUnit: false },
  { codigo: "mrg_bruta",         nome: "Mrg Bruta",              ordem: 12, isBold: true,  isHighlight: true,  isUnit: false },
  { codigo: "desp_comerciais",   nome: "Desp. Comerciais",       ordem: 13, isBold: false, isHighlight: false, isUnit: false },
  { codigo: "marketing",         nome: "Marketing",              ordem: 14, isBold: false, isHighlight: false, isUnit: false },
  { codigo: "mrg_mercado",       nome: "Mrg de Mercado",         ordem: 15, isBold: true,  isHighlight: true,  isUnit: false },
  // ─── Indicadores Unitários ───────────────────────────────────────────────
  { codigo: "preco_kg",          nome: "Preço/Kg",               ordem: 16, isBold: false, isHighlight: false, isUnit: true, isPercent: false },
  { codigo: "pct_impostos",      nome: "% Impostos",             ordem: 17, isBold: false, isHighlight: false, isUnit: true, isPercent: true  },
  { codigo: "pct_invest",        nome: "% Invest Comerciais",    ordem: 18, isBold: false, isHighlight: false, isUnit: true, isPercent: true  },
  { codigo: "custo_kg",          nome: "Custo/Kg",               ordem: 19, isBold: false, isHighlight: false, isUnit: true, isPercent: false },
  { codigo: "frete_kg",          nome: "Frete/Kg",               ordem: 20, isBold: false, isHighlight: false, isUnit: true, isPercent: false },
  { codigo: "mc_kg",             nome: "MC/Kg",                  ordem: 21, isBold: true,  isHighlight: false, isUnit: true, isPercent: false },
  { codigo: "pct_mc",            nome: "%MC",                    ordem: 22, isBold: false, isHighlight: false, isUnit: true, isPercent: true  },
  { codigo: "ggf_kg",            nome: "GGF/Kg",                 ordem: 23, isBold: false, isHighlight: false, isUnit: true, isPercent: false },
  { codigo: "armazenagem_kg",    nome: "Armazenagem/Kg",         ordem: 24, isBold: false, isHighlight: false, isUnit: true, isPercent: false },
  { codigo: "mb_kg",             nome: "MB/Kg",                  ordem: 25, isBold: true,  isHighlight: false, isUnit: true, isPercent: false },
  { codigo: "pct_mb",            nome: "% MB",                   ordem: 26, isBold: false, isHighlight: false, isUnit: true, isPercent: true  },
  { codigo: "pct_desp_com",      nome: "% Despesas Comerciais",  ordem: 27, isBold: false, isHighlight: false, isUnit: true, isPercent: true  },
  { codigo: "pct_marketing",     nome: "% Marketing",            ordem: 28, isBold: false, isHighlight: false, isUnit: true, isPercent: true  },
  { codigo: "mm_kg",             nome: "MM/Kg",                  ordem: 29, isBold: true,  isHighlight: false, isUnit: true, isPercent: false },
  { codigo: "pct_mm",            nome: "% MM",                   ordem: 30, isBold: false, isHighlight: false, isUnit: true, isPercent: true  },
  { codigo: "ebitda_kg",         nome: "Ebitda/Kg",              ordem: 31, isBold: false, isHighlight: false, isUnit: true, isPercent: false },
  { codigo: "pct_ebitda",        nome: "% Ebitda",               ordem: 32, isBold: false, isHighlight: false, isUnit: true, isPercent: true  },
] as const;

export type LinhaCodigo = typeof DRE_LINHAS[number]["codigo"];

export interface DREItemInput {
  linha_codigo: string;
  linha_nome: string;
  valor: number | null;
  ordem: number;
}

export interface DRESalvarInput {
  ano: number;
  mes: number;
  cenario: "REAL" | "BUDGET" | "FORECAST";
  gerente_id: string | null;
  items: DREItemInput[];
}

export interface DREHistoricoRow {
  linha_codigo: string;
  linha_nome: string;
  ordem: number;
  isBold: boolean;
  isHighlight: boolean;
  isUnit: boolean;
  isPercent?: boolean;
  meses: (number | null)[];
  acum: number | null;
  media3m: number | null;
  media12m: number | null;
  rolling6m: number | null;
}
