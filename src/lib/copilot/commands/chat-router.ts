import { ChatMessageResponse } from "../dto/copilot-dto";
import {
  CommandHandler,
  TopManagersCommand,
  ForecastCommand,
  GapCommand,
  RiskCommand,
  RankingCommand
} from "./chat-commands";

/**
 * ChatRouter
 * Dynamic Command Registry Pattern for Executive Chat Engine.
 * Allows adding new command handlers dynamically via registerCommand() without modifying the router class.
 */
export class ChatRouter {
  private static handlers: CommandHandler[] = [
    new TopManagersCommand(),
    new ForecastCommand(),
    new GapCommand(),
    new RiskCommand(),
    new RankingCommand()
  ];

  /**
   * Registers a new command handler dynamically (Open/Closed Principle).
   */
  public static registerCommand(handler: CommandHandler): void {
    this.handlers.unshift(handler);
  }

  /**
   * Clears or returns current handlers.
   */
  public static getHandlers(): CommandHandler[] {
    return [...this.handlers];
  }

  public static routeQuery(query: string, context: any): ChatMessageResponse {
    for (const handler of this.handlers) {
      if (handler.canHandle(query)) {
        return handler.execute(query, context);
      }
    }

    const exec = context.executive || context.executiveSummary;
    return {
      pergunta: query,
      resposta: `Resposta Corporativa: Meta Nacional de R$ ${(exec.metaNacional / 1000000).toFixed(2)}M com Faturamento de R$ ${(exec.faturamentoAtual / 1000000).toFixed(2)}M (Pace: ${exec.pace}%).`,
      fonteDados: ["AnalyticsEngine", "CockpitService"],
      confiancaPct: 100,
      commandExecuted: "DefaultCommand"
    };
  }
}
