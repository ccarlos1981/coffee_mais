import { MixOpportunityItem } from "../dto/rgm-dto";

export class MixOpportunityEngine {
  public static detectMixOpportunities(decisionVM: any): MixOpportunityItem[] {
    return [
      {
        id: "MIX-OPP-1",
        clienteOuRede: "Rede ZAFFARI",
        skusAusentes: ["Supermoka 250g", "Cápsula Gourmet 10un"],
        potencialCrossSellR$: 450000,
        potencialUpSellR$: 180000,
        recomendacaoMix: "Introdução da linha de Cápsulas Premium para elevação de ticket médio"
      },
      {
        id: "MIX-OPP-2",
        clienteOuRede: "Rede CARREFOUR",
        skusAusentes: ["Grãos Especiais 1kg"],
        potencialCrossSellR$: 380000,
        potencialUpSellR$: 150000,
        recomendacaoMix: "Cross-selling da linha de grãos inteiros para o segmento gourmet"
      }
    ];
  }
}
