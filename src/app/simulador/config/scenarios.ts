import { SimulationParams } from "@/lib/governance/analytics/simulation";

export interface SimulationScenarioConfig {
  id: string;
  titulo: string;
  descricao: string;
  categoria: "PRECO" | "TRADE" | "EXPANSAO" | "MIX";
  iconName: "TrendingUp" | "DollarSign" | "Zap" | "Building2" | "Users" | "Sparkles";
  params: SimulationParams;
}

export const SIMULATION_SCENARIOS: SimulationScenarioConfig[] = [
  {
    id: "aumento_preco",
    titulo: "Aumento de Preço",
    descricao: "Reajuste de 4% no preço médio com queda estimada de 1% no volume.",
    categoria: "PRECO",
    iconName: "TrendingUp",
    params: {
      nomeCenario: "Aumento de Preço (+4%)",
      tipoAcao: "ALTERAR_PRECO",
      variacaoFaturamentoPct: 4.0,
      variacaoMacoPct: 3.2,
      investimentoAdicionalR$: 0,
      targetRedeOuCliente: "Todas as Redes",
    }
  },
  {
    id: "desconto_comercial",
    titulo: "Desconto Comercial",
    descricao: "Concessão de 2.5% de desconto visando ganho de 6.0% em volume.",
    categoria: "PRECO",
    iconName: "DollarSign",
    params: {
      nomeCenario: "Desconto Comercial (-2.5%)",
      tipoAcao: "ALTERAR_PRECO",
      variacaoFaturamentoPct: 3.5,
      variacaoMacoPct: -1.2,
      investimentoAdicionalR$: 0,
      targetRedeOuCliente: "Key Accounts",
    }
  },
  {
    id: "investimento_trade",
    titulo: "Investimento em Trade",
    descricao: "Aporte de R$ 50.000 em encartes e pontas de gôndola (+8.0% faturamento).",
    categoria: "TRADE",
    iconName: "Zap",
    params: {
      nomeCenario: "Investimento em Trade (R$ 50k)",
      tipoAcao: "ALTERAR_INVESTIMENTO",
      variacaoFaturamentoPct: 8.0,
      variacaoMacoPct: 4.5,
      investimentoAdicionalR$: 50000,
      targetRedeOuCliente: "Redes Top 10",
    }
  },
  {
    id: "novo_distribuidor",
    titulo: "Novo Distribuidor",
    descricao: "Entrada de novo parceiro regional gerando R$ 180.000 adicionais no mês.",
    categoria: "EXPANSAO",
    iconName: "Building2",
    params: {
      nomeCenario: "Novo Distribuidor Regional",
      tipoAcao: "NOVO_CLIENTE",
      variacaoFaturamentoPct: 12.0,
      variacaoMacoPct: 6.8,
      investimentoAdicionalR$: 30000,
      targetRedeOuCliente: "Canal Distribuição",
    }
  },
  {
    id: "expansao_carteira",
    titulo: "Expansão de Carteira",
    descricao: "Ativação de 10% de clientes inativos da base comercial.",
    categoria: "EXPANSAO",
    iconName: "Users",
    params: {
      nomeCenario: "Expansão de Carteira (+10%)",
      tipoAcao: "RECUPERAR_REDE",
      variacaoFaturamentoPct: 9.5,
      variacaoMacoPct: 5.0,
      investimentoAdicionalR$: 20000,
      targetRedeOuCliente: "Base de Clientes",
    }
  },
  {
    id: "mix_premium",
    titulo: "Mix Premium",
    descricao: "Aumento do mix de Drip Coffee e Cápsulas (+5% R$/Kg médio).",
    categoria: "MIX",
    iconName: "Sparkles",
    params: {
      nomeCenario: "Foco em Mix Premium",
      tipoAcao: "ALTERAR_MIX",
      variacaoFaturamentoPct: 6.5,
      variacaoMacoPct: 4.8,
      investimentoAdicionalR$: 10000,
      targetRedeOuCliente: "Canais Especiais",
    }
  }
];
