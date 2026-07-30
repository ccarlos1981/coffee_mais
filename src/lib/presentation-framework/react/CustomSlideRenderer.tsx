'use client';

import React, { useEffect, useState } from 'react';
import { CustomSlideConfig, IDataProvider, NormalizedWidgetData } from '../core/types';
import { LayoutEngine } from '../core/LayoutEngine';
import { RdmDataResolver } from '../core/DataProvider';
import { renderWidgetUI } from './ReactWidgetResolver';

interface CustomSlideRendererProps {
  slide: CustomSlideConfig;
  dataProvider: IDataProvider;
  monthName: string;
}

export function CustomSlideRenderer({ slide, dataProvider, monthName }: CustomSlideRendererProps) {
  const [widgetDataMap, setWidgetDataMap] = useState<Record<string, NormalizedWidgetData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadAllWidgetData() {
      setLoading(true);
      const resolver = new RdmDataResolver(dataProvider);
      const map: Record<string, NormalizedWidgetData> = {};

      for (const widget of slide.widgets) {
        const data = await resolver.resolve(widget);
        map[widget.id] = data;
      }

      if (isMounted) {
        setWidgetDataMap(map);
        setLoading(false);
      }
    }

    loadAllWidgetData();
    return () => { isMounted = false; };
  }, [slide, dataProvider]);

  const layoutSpec = LayoutEngine.computeGridSpec(slide.layout, slide.widgets);

  return (
    <div className="rdm-slide" style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', height: '100%', background: '#09090b', color: '#ffffff' }}>
      {/* Header */}
      <div className="rdm-slide-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(201, 169, 110, 0.25)', paddingBottom: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Georgia, serif', margin: 0 }}>
            {slide.label} <span style={{ color: '#c9a96e', fontWeight: 400 }}>| {monthName}</span>
          </h2>
          {slide.subtitle && (
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px', margin: 0 }}>
              {slide.subtitle}
            </p>
          )}
        </div>

        <div style={{ textAlign: 'right', userSelect: 'none' }}>
          <div style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 700, fontFamily: 'Georgia, serif' }}>Coffee</div>
          <div style={{ color: '#c9a96e', fontSize: '0.75rem', fontWeight: 800, marginTop: '-2px' }}>++</div>
        </div>
      </div>

      {/* Body: Layout Engine Grid */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#c9a96e', fontSize: '0.85rem' }}>
            Carregando widgets do slide...
          </div>
        ) : (
          <div style={layoutSpec.containerStyle as React.CSSProperties}>
            {layoutSpec.cells.map(cell => {
              const data = widgetDataMap[cell.widget.id] || { title: cell.widget.title };
              return (
                <div
                  key={cell.widget.id}
                  style={{
                    flex: cell.flexBasis ? `0 0 ${cell.flexBasis}` : undefined,
                    minHeight: cell.minHeightPx ? `${cell.minHeightPx}px` : undefined,
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'rgba(18, 18, 18, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  {cell.widget.title && (
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c9a96e', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {cell.widget.title}
                    </div>
                  )}
                  {renderWidgetUI(cell.widget.type, data)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
