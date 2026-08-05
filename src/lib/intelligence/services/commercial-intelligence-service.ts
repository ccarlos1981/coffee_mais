import { AnalyticsFilters } from "@/lib/governance/analytics";
import { CommercialIntelligenceViewModel } from "../dto/intelligence-dto";
import { CommercialIntelligenceOrchestrator } from "../orchestrators/commercial-intelligence-orchestrator";

/**
 * CommercialIntelligenceService
 * Facade service layer handling authorization, RLS manager scoping, telemetry, and delegating to Orchestrator.
 */
export class CommercialIntelligenceService {
  public static async getIntelligenceViewModel(
    filters: AnalyticsFilters = {},
    year: number = 2026,
    month: number = 8,
    limit: number = 50,
    offset: number = 0
  ): Promise<CommercialIntelligenceViewModel> {
    return CommercialIntelligenceOrchestrator.orchestrate(filters, year, month, limit, offset);
  }
}
