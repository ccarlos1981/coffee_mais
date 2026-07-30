'use client';

import React from 'react';
import { NormalizedWidgetData, WidgetType } from '../core/types';
import { KpiCardWidget } from './widgets/KpiCardWidget';
import { TableWidget } from './widgets/TableWidget';
import { BarChartWidget } from './widgets/BarChartWidget';
import { LineChartWidget } from './widgets/LineChartWidget';
import { RankingWidget } from './widgets/RankingWidget';
import { TextBlockWidget } from './widgets/TextBlockWidget';
import { HeatmapWidget } from './widgets/HeatmapWidget';
import { WaterfallWidget } from './widgets/WaterfallWidget';
import { GaugeWidget } from './widgets/GaugeWidget';
import { CommentsWidget } from './widgets/CommentsWidget';
import { ActionPlanWidget } from './widgets/ActionPlanWidget';

export function renderWidgetUI(type: WidgetType, data: NormalizedWidgetData): React.ReactNode {
  switch (type) {
    case 'kpi_card':
      return <KpiCardWidget data={data} />;
    case 'table':
      return <TableWidget data={data} />;
    case 'bar_chart':
      return <BarChartWidget data={data} />;
    case 'line_chart':
      return <LineChartWidget data={data} />;
    case 'ranking':
      return <RankingWidget data={data} />;
    case 'text_block':
      return <TextBlockWidget data={data} />;
    case 'heatmap':
      return <HeatmapWidget data={data} />;
    case 'waterfall':
      return <WaterfallWidget data={data} />;
    case 'gauge':
      return <GaugeWidget data={data} />;
    case 'comments':
      return <CommentsWidget data={data} />;
    case 'action_plan':
      return <ActionPlanWidget data={data} />;
    default:
      return (
        <div style={{ padding: '16px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', border: '1px border-white/10' }}>
          Widget [{type}] registrado no Core — visualização UI prevista para a Fase 3.
        </div>
      );
  }
}
