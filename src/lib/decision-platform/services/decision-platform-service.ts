import { AnalyticsFilters } from "@/lib/governance/analytics";
import { CommercialIntelligenceService } from "@/lib/intelligence/services/commercial-intelligence-service";
import { DecisionViewModel } from "../dto/decision-dto";
import { DecisionPipeline } from "../pipeline/decision-pipeline";

/**
 * DecisionPlatformService
 * Enterprise Facade Service orchestrating the Decision Pipeline V2 without altering any existing locked services.
 */
export class DecisionPlatformService {
  public static async getDecisionViewModel(
    filters: AnalyticsFilters = {},
    year: number = 2026,
    month: number = 8,
    limit: number = 50,
    offset: number = 0
  ): Promise<DecisionViewModel> {
    // Consome exclusivamente CommercialIntelligenceService (LOCKED)
    const intelVM = await CommercialIntelligenceService.getIntelligenceViewModel(filters, year, month, limit, offset);

    // Executa o Decision Pipeline V2
    return DecisionPipeline.executePipeline(intelVM);
  }
}
