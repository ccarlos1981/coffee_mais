/**
 * Presentation Framework Core — Telemetry & Observability (ADR-001 Gate v1.0)
 *
 * 100% UI-Agnostic, decoupled telemetry service for logging framework events.
 */

export type TelemetryEventType =
  | 'slide_created'
  | 'template_used'
  | 'widget_used'
  | 'export_started'
  | 'export_completed'
  | 'export_failed'
  | 'render_error';

export interface TelemetryEventPayload {
  eventType: TelemetryEventType;
  timestamp: string;
  slideId?: string;
  templateId?: string;
  widgetType?: string;
  durationMs?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export type TelemetryListener = (event: TelemetryEventPayload) => void;

class PresentationTelemetryImpl {
  private listeners: TelemetryListener[] = [];

  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public track(eventType: TelemetryEventType, details: Partial<TelemetryEventPayload> = {}): void {
    const event: TelemetryEventPayload = {
      eventType,
      timestamp: new Date().toISOString(),
      ...details,
    };

    // Log em dev / notify listeners
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[PresentationTelemetry] Event: ${eventType}`, event);
    }

    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (err) {
        console.error('[PresentationTelemetry] Erro ao notificar listener:', err);
      }
    });
  }
}

export const PresentationTelemetry = new PresentationTelemetryImpl();
