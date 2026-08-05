import { PriceOpportunityItem } from "../dto/rgm-dto";

export class PriceOpportunityEngine {
  public static detectPriceOpportunities(decisionVM: any): PriceOpportunityItem[] {
    return [
      {
        id: "PRC-OPP-1",
        entidadeOuSKU: "Gourmet Moído 250g",
        precoAtualR$: 14.80,
        precoMedioMercadoR$: 16.20,
        desvioPrecoPct: -8.6,
        perdaMargemR$: 340000,
        recomendacaoReajuste: "Ajustar preço em +5% no ciclo Q4 para alinhar à margem média"
      },
      {
        id: "PRC-OPP-2",
        entidadeOuSKU: "Cápsula Alumínio 10un",
        precoAtualR$: 19.50,
        precoMedioMercadoR$: 21.00,
        desvioPrecoPct: -7.1,
        perdaMargemR$: 220000,
        recomendacaoReajuste: "Revisar bonificação excessiva em contratos institucionais"
      }
    ];
  }
}
