/**
 * Presentation Framework Core — Template Engine (ADR-001)
 *
 * 100% UI-Agnostic Engine that creates, composes, and transforms slide templates.
 */

import { CustomSlideConfig, SlideTemplate } from './types';

export class TemplateEngine {
  public static readonly CURRENT_VERSION = '1.0.0';

  /**
   * Converte uma configuração de slide em um template reutilizável.
   */
  public static slideToTemplate(slide: CustomSlideConfig, name: string, description?: string): SlideTemplate {
    const now = new Date().toISOString();
    return {
      id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name,
      version: TemplateEngine.CURRENT_VERSION,
      description,
      layout: slide.layout,
      widgets: JSON.parse(JSON.stringify(slide.widgets)),
      createdAt: now,
      updatedAt: now,
      author: slide.author || 'Usuário',
      origin: 'user',
    };
  }

  /**
   * Instancia um novo CustomSlideConfig a partir de um SlideTemplate.
   */
  public static templateToSlide(template: SlideTemplate, title?: string): CustomSlideConfig {
    const now = new Date().toISOString();
    const id = `slide_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    return {
      id,
      key: id,
      label: title || template.name,
      subtitle: template.description,
      layout: template.layout,
      widgets: JSON.parse(JSON.stringify(template.widgets)),
      version: template.version || TemplateEngine.CURRENT_VERSION,
      createdAt: now,
      updatedAt: now,
      author: template.author || 'Sistema',
      origin: template.origin,
    };
  }
}
