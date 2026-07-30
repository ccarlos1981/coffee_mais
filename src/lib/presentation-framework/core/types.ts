/**
 * Presentation Framework Core — Types & Contracts (ADR-001)
 *
 * 100% UI-Agnostic: Zero dependencies on React, Next.js, or DOM.
 */

export type WidgetType =
  | 'kpi_card'
  | 'table'
  | 'bar_chart'
  | 'line_chart'
  | 'ranking'
  | 'text_block'
  // Reservados para Fases 3/4
  | 'heatmap'
  | 'waterfall'
  | 'gauge'
  | 'radar'
  | 'doughnut'
  | 'pareto'
  | 'timeline'
  | 'pivot'
  | 'comments'
  | 'action_plan'
  | 'image'
  | 'ai_insights';

export type LayoutOrientation =
  | 'full'
  | '2col'
  | '3col'
  | 'dashboard'
  | 'responsive_grid'
  | 'custom';

export type PeriodType =
  | 'month'
  | '3m'
  | '6m'
  | '12m'
  | 'quarter'
  | 'semester'
  | 'year'
  | 'ytd'
  | 'custom';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  subtitle?: string;
  indicators?: string[];
  period?: {
    type: PeriodType;
    startMonth?: number;
    endMonth?: number;
    year?: number;
  };
  comparatives?: {
    prevMonth?: boolean;
    prevYear?: boolean;
    average?: boolean;
    target?: boolean;
    forecast?: boolean;
    quarter?: boolean;
    ytd?: boolean;
  };
  customProps?: Record<string, unknown>;
}

export interface CustomSlideConfig {
  id: string;
  key: string;
  label: string;
  subtitle?: string;
  layout: LayoutOrientation;
  widgets: WidgetConfig[];
  version: string;
  createdAt: string;
  updatedAt: string;
  author: string;
  origin: 'system' | 'user';
}

export interface SlideTemplate {
  id: string;
  name: string;
  version: string;
  description?: string;
  category?: string;
  layout: LayoutOrientation;
  widgets: WidgetConfig[];
  createdAt: string;
  updatedAt: string;
  author: string;
  origin: 'system' | 'user';
}

export type ActionPriority = 'alta' | 'media' | 'baixa' | 'urgente';
export type ActionStatus = 'pendente' | 'em_andamento' | 'concluido' | 'cancelado';

export interface ActionItem {
  id: string;
  title: string;
  description?: string;
  owner: string;
  dueDate: string;
  priority: ActionPriority;
  status: ActionStatus;
  origin?: string;
  createdAt: string;
  completedAt?: string;
  notes?: string;
}

export type CommentCategory = 'observacao' | 'alerta' | 'oportunidade' | 'risco';

export interface CommentItem {
  id: string;
  author: string;
  createdAt: string;
  text: string;
  category: CommentCategory;
  isResolved?: boolean;
}

export interface AnalyticsWidgetSpec {
  metric?: string;
  dimensions?: string[];
  filters?: Record<string, unknown>;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  formatting?: 'currency' | 'number' | 'percentage';
  drillDownSupport?: boolean;
  legend?: boolean;
  colorScheme?: string[];
}

export interface NormalizedWidgetData {
  title?: string;
  subtitle?: string;
  analyticsSpec?: AnalyticsWidgetSpec;
  metrics?: Array<{
    label: string;
    value: string | number;
    target?: string | number;
    delta?: string | number;
    percentage?: number;
    trend?: 'up' | 'down' | 'neutral';
    status?: 'green' | 'red' | 'yellow' | 'neutral';
  }>;
  tableData?: {
    columns: Array<{ key: string; label: string; align?: 'left' | 'center' | 'right' }>;
    rows: Array<Record<string, unknown>>;
  };
  chartData?: Array<{
    name: string;
    [key: string]: string | number;
  }>;
  radarData?: Array<{
    subject: string;
    [key: string]: string | number;
  }>;
  rankingData?: Array<{
    rank: number;
    name: string;
    value: string | number;
    subtitle?: string;
    highlight?: boolean;
  }>;
  textData?: {
    content: string;
  };
  commentsData?: CommentItem[];
  actionPlanData?: ActionItem[];
  raw?: unknown;
}

export interface IDataProvider {
  getWidgetData(widget: WidgetConfig): Promise<NormalizedWidgetData> | NormalizedWidgetData;
}

export interface IStorageProvider {
  getCustomSlides(): Promise<CustomSlideConfig[]> | CustomSlideConfig[];
  saveCustomSlide(slide: CustomSlideConfig): Promise<void> | void;
  deleteCustomSlide(slideId: string): Promise<void> | void;
  getTemplates(): Promise<SlideTemplate[]> | SlideTemplate[];
  saveTemplate(template: SlideTemplate): Promise<void> | void;
}

export interface IWidgetSDK {
  id: WidgetType;
  name: string;
  version: string;
  iconName: string;
  category: 'kpis' | 'tables' | 'charts' | 'text' | 'advanced';
  supportsPreview: boolean;
  supportsExport: boolean;
  validate(config: WidgetConfig): { valid: boolean; errors?: string[] };
}
