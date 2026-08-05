import { ShareOfWalletItem } from "../dto/rgm-dto";

export class ShareOfWalletEngine {
  public static calculateShareOfWallet(decisionVM: any): ShareOfWalletItem[] {
    const graph = decisionVM.decisionGraph || [];
    const items: ShareOfWalletItem[] = [];

    graph.slice(0, 5).forEach((node: any, idx: number) => {
      const shareAtual = Math.round(35 + (idx * 5));
      const sharePotencial = Math.min(85, shareAtual + 20);
      const gapShare = sharePotencial - shareAtual;
      const rec = Math.round((node.expectedFinancialImpactR$ || 400000) * 1.25);

      items.push({
        id: `SOW-${idx + 1}`,
        rede: node.targetEntity,
        shareAtualPct: shareAtual,
        sharePotencialPct: sharePotencial,
        gapSharePct: gapShare,
        receitaAdicionalR$: rec
      });
    });

    if (items.length === 0) {
      items.push({
        id: "SOW-DEF-1",
        rede: "ZAFFARI",
        shareAtualPct: 42,
        sharePotencialPct: 65,
        gapSharePct: 23,
        receitaAdicionalR$: 780000
      });
    }

    return items;
  }
}
