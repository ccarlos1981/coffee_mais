/**
 * Presentation Framework Core — Data Provider (ADR-001)
 *
 * 100% UI-Agnostic Data Provider Interfaces and Resolver Contracts.
 */

import { IDataProvider, NormalizedWidgetData, WidgetConfig } from './types';

export class RdmDataResolver {
  private provider: IDataProvider;

  constructor(provider: IDataProvider) {
    this.provider = provider;
  }

  public async resolve(widget: WidgetConfig): Promise<NormalizedWidgetData> {
    try {
      const data = await this.provider.getWidgetData(widget);
      return data;
    } catch (err) {
      console.error(`[RdmDataResolver] Erro ao resolver dados para o widget ${widget.id}:`, err);
      return {
        title: widget.title,
        subtitle: 'Erro ao carregar dados',
        textData: {
          content: 'Não foi possível carregar os dados para este widget.',
        },
      };
    }
  }
}
