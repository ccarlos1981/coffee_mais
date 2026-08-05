import { ChatMessageResponse } from "../dto/copilot-dto";
import { ChatRouter } from "../commands/chat-router";

export interface AIProvider {
  name: string;
  generateResponse(query: string, context: any): Promise<ChatMessageResponse>;
}

export class DeterministicAIProvider implements AIProvider {
  name = "DeterministicAIProvider";
  async generateResponse(query: string, context: any): Promise<ChatMessageResponse> {
    return ChatRouter.routeQuery(query, context);
  }
}

export class OpenAIProvider implements AIProvider {
  name = "OpenAIProvider";
  async generateResponse(query: string, context: any): Promise<ChatMessageResponse> {
    return ChatRouter.routeQuery(query, context);
  }
}

export class AzureOpenAIProvider implements AIProvider {
  name = "AzureOpenAIProvider";
  async generateResponse(query: string, context: any): Promise<ChatMessageResponse> {
    return ChatRouter.routeQuery(query, context);
  }
}

export class ClaudeProvider implements AIProvider {
  name = "ClaudeProvider";
  async generateResponse(query: string, context: any): Promise<ChatMessageResponse> {
    return ChatRouter.routeQuery(query, context);
  }
}

export class GeminiProvider implements AIProvider {
  name = "GeminiProvider";
  async generateResponse(query: string, context: any): Promise<ChatMessageResponse> {
    return ChatRouter.routeQuery(query, context);
  }
}
