/**
 * Presentation Framework Core — Widget Registry (ADR-001)
 *
 * 100% UI-Agnostic Central Registry implementing the Open/Closed Principle (OCP).
 * Maps Widget Types to their official specs and metadata.
 */

import { IWidgetSDK, WidgetType } from './types';
import { createWidgetSpec } from './WidgetSDK';

class WidgetRegistryImpl {
  private registry = new Map<WidgetType, IWidgetSDK>();

  constructor() {
    this.registerPhase1MVPWidgets();
  }

  /**
   * Registra um novo Widget SDK no catálogo central (OCP).
   */
  public register(spec: IWidgetSDK): void {
    if (this.registry.has(spec.id)) {
      console.warn(`[WidgetRegistry] Sobrescrevendo widget existente: ${spec.id}`);
    }
    this.registry.set(spec.id, createWidgetSpec(spec));
  }

  public get(id: WidgetType): IWidgetSDK | undefined {
    return this.registry.get(id);
  }

  public has(id: WidgetType): boolean {
    return this.registry.has(id);
  }

  public getAll(): IWidgetSDK[] {
    return Array.from(this.registry.values());
  }

  /**
   * Registra os 6 Widgets MVP oficiais da Fase 1.
   */
  private registerPhase1MVPWidgets(): void {
    // 1. KPI Card
    this.register({
      id: 'kpi_card',
      name: 'Cartões KPI',
      version: '1.0.0',
      iconName: 'LayoutGrid',
      category: 'kpis',
      supportsPreview: true,
      supportsExport: true,
      validate: (config) => ({
        valid: !!config.title,
      }),
    });

    // 2. Table
    this.register({
      id: 'table',
      name: 'Tabela de Dados',
      version: '1.0.0',
      iconName: 'Table',
      category: 'tables',
      supportsPreview: true,
      supportsExport: true,
      validate: (config) => ({
        valid: !!config.title,
      }),
    });

    // 3. Bar Chart
    this.register({
      id: 'bar_chart',
      name: 'Gráfico de Barras',
      version: '1.0.0',
      iconName: 'BarChart3',
      category: 'charts',
      supportsPreview: true,
      supportsExport: true,
      validate: (config) => ({
        valid: !!config.title,
      }),
    });

    // 4. Line Chart
    this.register({
      id: 'line_chart',
      name: 'Gráfico de Linha',
      version: '1.0.0',
      iconName: 'TrendingUp',
      category: 'charts',
      supportsPreview: true,
      supportsExport: true,
      validate: (config) => ({
        valid: !!config.title,
      }),
    });

    // 5. Ranking
    this.register({
      id: 'ranking',
      name: 'Ranking Comercial',
      version: '1.0.0',
      iconName: 'Award',
      category: 'tables',
      supportsPreview: true,
      supportsExport: true,
      validate: (config) => ({
        valid: !!config.title,
      }),
    });

    // 6. Text Block
    this.register({
      id: 'text_block',
      name: 'Bloco de Texto / Título',
      version: '1.0.0',
      iconName: 'FileText',
      category: 'text',
      supportsPreview: true,
      supportsExport: true,
      validate: (config) => ({
        valid: !!config.title,
      }),
    });

    // ── Sprint 3.1 Strategic Widgets ──
    // 7. Heatmap
    this.register({
      id: 'heatmap',
      name: 'Heatmap / Matriz Térmica',
      version: '1.0.0',
      iconName: 'Grid',
      category: 'advanced',
      supportsPreview: true,
      supportsExport: true,
      validate: (config) => ({
        valid: !!config.title,
      }),
    });

    // 8. Waterfall
    this.register({
      id: 'waterfall',
      name: 'Gráfico Waterfall (Ponte DRE)',
      version: '1.0.0',
      iconName: 'BarChartHorizontal',
      category: 'charts',
      supportsPreview: true,
      supportsExport: true,
      validate: (config) => ({
        valid: !!config.title,
      }),
    });

    // 9. Gauge
    this.register({
      id: 'gauge',
      name: 'Velocímetro / Indicador Meta',
      version: '1.0.0',
      iconName: 'Gauge',
      category: 'kpis',
      supportsPreview: true,
      supportsExport: true,
      validate: (config) => ({
        valid: !!config.title,
      }),
    });

    // ── Sprint 3.2 Collaboration & Decision Management ──
    // 10. Comments Widget
    this.register({
      id: 'comments',
      name: 'Caixa de Comentários / Contexto',
      version: '1.0.0',
      iconName: 'MessageSquare',
      category: 'text',
      supportsPreview: true,
      supportsExport: true,
      validate: (config) => ({
        valid: !!config.title,
      }),
    });

    // 11. Action Plan Widget
    this.register({
      id: 'action_plan',
      name: 'Plano de Ação Executivo',
      version: '1.0.0',
      iconName: 'CheckSquare',
      category: 'tables',
      supportsPreview: true,
      supportsExport: true,
      validate: (config) => ({
        valid: !!config.title,
      }),
    });

    // ── Sprint 3.3 Analytics Widgets ──
    // 12. Radar Chart
    this.register({
      id: 'radar',
      name: 'Gráfico Radar (Teia Analítica)',
      version: '1.0.0',
      iconName: 'PieChart',
      category: 'charts',
      supportsPreview: true,
      supportsExport: true,
      validate: (config) => ({
        valid: !!config.title,
      }),
    });
  }
}

export const WidgetRegistry = new WidgetRegistryImpl();
