/**
 * Presentation Framework Core — Version Migrator (ADR-001)
 *
 * 100% UI-Agnostic Schema Version Migration Engine.
 * Guarantees permanent backward compatibility across template and slide schema updates.
 */

import { CustomSlideConfig, SlideTemplate } from './types';

export class VersionMigrator {
  public static readonly LATEST_VERSION = '1.0.0';

  /**
   * Migra um slide customizado legado para a versão mais recente do schema.
   */
  public static migrateSlide(rawSlide: any): CustomSlideConfig {
    if (!rawSlide) {
      throw new Error('[VersionMigrator] Slide inválido fornecido para migração.');
    }

    const version = rawSlide.version || '0.9.0';

    if (version === VersionMigrator.LATEST_VERSION) {
      return rawSlide as CustomSlideConfig;
    }

    // Migração de v0.9.0 para v1.0.0
    const migrated: CustomSlideConfig = {
      id: rawSlide.id || `slide_${Date.now()}`,
      key: rawSlide.key || rawSlide.id || `slide_${Date.now()}`,
      label: rawSlide.label || rawSlide.title || 'Slide Sem Título',
      subtitle: rawSlide.subtitle || '',
      layout: rawSlide.layout || 'full',
      widgets: Array.isArray(rawSlide.widgets) ? rawSlide.widgets : [],
      version: VersionMigrator.LATEST_VERSION,
      createdAt: rawSlide.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: rawSlide.author || 'Sistema',
      origin: rawSlide.origin || 'user',
    };

    return migrated;
  }

  /**
   * Migra um template legado para a versão mais recente do schema.
   */
  public static migrateTemplate(rawTemplate: any): SlideTemplate {
    if (!rawTemplate) {
      throw new Error('[VersionMigrator] Template inválido fornecido para migração.');
    }

    const version = rawTemplate.version || '0.9.0';

    if (version === VersionMigrator.LATEST_VERSION) {
      return rawTemplate as SlideTemplate;
    }

    return {
      id: rawTemplate.id || `template_${Date.now()}`,
      name: rawTemplate.name || 'Modelo Sem Nome',
      version: VersionMigrator.LATEST_VERSION,
      description: rawTemplate.description || '',
      category: rawTemplate.category || 'Geral',
      layout: rawTemplate.layout || 'full',
      widgets: Array.isArray(rawTemplate.widgets) ? rawTemplate.widgets : [],
      createdAt: rawTemplate.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: rawTemplate.author || 'Sistema',
      origin: rawTemplate.origin || 'system',
    };
  }
}
