/**
 * Presentation Framework Core — Storage Provider (ADR-001)
 *
 * 100% UI-Agnostic Storage Provider Interface and LocalStorage Implementation.
 */

import { CustomSlideConfig, IStorageProvider, SlideTemplate } from './types';
import { VersionMigrator } from './VersionMigrator';

export class LocalStorageStorageProvider implements IStorageProvider {
  private slidesStorageKey: string;
  private templatesStorageKey: string;

  constructor(slidesStorageKey = 'rdm_custom_slides', templatesStorageKey = 'rdm_slide_templates') {
    this.slidesStorageKey = slidesStorageKey;
    this.templatesStorageKey = templatesStorageKey;
  }

  public getCustomSlides(): CustomSlideConfig[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.slidesStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(s => VersionMigrator.migrateSlide(s));
    } catch (err) {
      console.error('[LocalStorageStorageProvider] Erro ao carregar slides:', err);
      return [];
    }
  }

  public saveCustomSlide(slide: CustomSlideConfig): void {
    if (typeof window === 'undefined') return;
    try {
      const slides = this.getCustomSlides();
      const existingIdx = slides.findIndex(s => s.id === slide.id);
      if (existingIdx >= 0) {
        slides[existingIdx] = slide;
      } else {
        slides.push(slide);
      }
      localStorage.setItem(this.slidesStorageKey, JSON.stringify(slides));
    } catch (err) {
      console.error('[LocalStorageStorageProvider] Erro ao salvar slide:', err);
    }
  }

  public deleteCustomSlide(slideId: string): void {
    if (typeof window === 'undefined') return;
    try {
      const slides = this.getCustomSlides().filter(s => s.id !== slideId && s.key !== slideId);
      localStorage.setItem(this.slidesStorageKey, JSON.stringify(slides));
    } catch (err) {
      console.error('[LocalStorageStorageProvider] Erro ao deletar slide:', err);
    }
  }

  public getTemplates(): SlideTemplate[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.templatesStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(t => VersionMigrator.migrateTemplate(t));
    } catch (err) {
      console.error('[LocalStorageStorageProvider] Erro ao carregar templates:', err);
      return [];
    }
  }

  public saveTemplate(template: SlideTemplate): void {
    if (typeof window === 'undefined') return;
    try {
      const templates = this.getTemplates();
      const existingIdx = templates.findIndex(t => t.id === template.id);
      if (existingIdx >= 0) {
        templates[existingIdx] = template;
      } else {
        templates.push(template);
      }
      localStorage.setItem(this.templatesStorageKey, JSON.stringify(templates));
    } catch (err) {
      console.error('[LocalStorageStorageProvider] Erro ao salvar template:', err);
    }
  }
}
