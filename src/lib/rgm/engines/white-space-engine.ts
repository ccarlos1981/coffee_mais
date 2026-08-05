import { WhiteSpaceItem } from "../dto/rgm-dto";

export class WhiteSpaceEngine {
  public static analyzeWhiteSpace(decisionVM: any): WhiteSpaceItem[] {
    return [
      {
        id: "WS-1",
        ufOuRegiao: "SP (Sudeste)",
        categoriaSKU: "Cápsulas Compatíveis",
        mixAtual: ["Intenso 250g", "Moído Tradicional"],
        mixRecomendado: ["Intenso 250g", "Moído Tradicional", "Cápsulas Alumínio 10un", "Gourmet 500g"],
        potencialFinanceiroR$: 850000
      },
      {
        id: "WS-2",
        ufOuRegiao: "MG (Sudeste)",
        categoriaSKU: "Linha Rituais / Especiais",
        mixAtual: ["Gourmet 250g"],
        mixRecomendado: ["Gourmet 250g", "Chapada de Minas 250g", "Cerrado Mineiro 250g"],
        potencialFinanceiroR$: 420000
      },
      {
        id: "WS-3",
        ufOuRegiao: "PR (Sul)",
        categoriaSKU: "Grãos 1kg Food Service",
        mixAtual: ["Moído 250g"],
        mixRecomendado: ["Moído 250g", "Grãos Gourmet 1kg"],
        potencialFinanceiroR$: 310000
      }
    ];
  }
}
