/**
 * Presentation Framework Core — Layout Engine (ADR-001)
 *
 * 100% UI-Agnostic Engine that computes layout grids and positioning specs.
 */

import { LayoutOrientation, WidgetConfig } from './types';

export interface LayoutCellSpec {
  widget: WidgetConfig;
  gridColumnSpan: number; // 1 a 12 (sistema flex de 12 colunas)
  gridRowSpan?: number;
  flexBasis?: string;
  minHeightPx?: number;
}

export interface LayoutGridSpec {
  orientation: LayoutOrientation;
  columnsCount: number; // 1, 2, 3 ou 12
  cells: LayoutCellSpec[];
  containerStyle: {
    display: 'flex' | 'grid';
    gridTemplateColumns?: string;
    gap: string;
    width: string;
    height: string;
  };
}

export class LayoutEngine {
  /**
   * Calcula a especificação de layout para uma lista de widgets em uma determinada orientação.
   */
  public static computeGridSpec(orientation: LayoutOrientation, widgets: WidgetConfig[]): LayoutGridSpec {
    const totalWidgets = widgets.length;

    if (orientation === 'full' || totalWidgets === 1) {
      return {
        orientation,
        columnsCount: 1,
        containerStyle: {
          display: 'flex',
          gap: '16px',
          width: '100%',
          height: '100%',
        },
        cells: widgets.map(w => ({
          widget: w,
          gridColumnSpan: 12,
          flexBasis: '100%',
          minHeightPx: 380,
        })),
      };
    }

    if (orientation === '2col') {
      return {
        orientation,
        columnsCount: 2,
        containerStyle: {
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          width: '100%',
          height: '100%',
        },
        cells: widgets.map((w, idx) => ({
          widget: w,
          gridColumnSpan: 6,
          minHeightPx: totalWidgets > 2 ? 220 : 360,
        })),
      };
    }

    if (orientation === '3col') {
      return {
        orientation,
        columnsCount: 3,
        containerStyle: {
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '14px',
          width: '100%',
          height: '100%',
        },
        cells: widgets.map(w => ({
          widget: w,
          gridColumnSpan: 4,
          minHeightPx: 260,
        })),
      };
    }

    if (orientation === 'dashboard') {
      // Grid 2x2 ou 1+2
      return {
        orientation,
        columnsCount: 2,
        containerStyle: {
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '14px',
          width: '100%',
          height: '100%',
        },
        cells: widgets.map((w, idx) => {
          // Se for 3 widgets, o primeiro ocupa full width (12 colunas)
          const isSpanFull = totalWidgets === 3 && idx === 0;
          return {
            widget: w,
            gridColumnSpan: isSpanFull ? 12 : 6,
            minHeightPx: isSpanFull ? 180 : 240,
          };
        }),
      };
    }

    // Default: responsive_grid ou horizontal / vertical
    return {
      orientation,
      columnsCount: Math.min(totalWidgets, 3),
      containerStyle: {
        display: 'flex',
        gap: '16px',
        width: '100%',
        height: '100%',
      },
      cells: widgets.map(w => ({
        widget: w,
        gridColumnSpan: Math.floor(12 / Math.min(totalWidgets, 3)),
        flexBasis: `${100 / Math.min(totalWidgets, 3)}%`,
        minHeightPx: 300,
      })),
    };
  }
}
