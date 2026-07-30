/**
 * Presentation Framework Core — Widget SDK (ADR-001)
 *
 * 100% UI-Agnostic spec and validation helper for Widget SDK compliant implementations.
 */

import { IWidgetSDK, WidgetConfig, WidgetType } from './types';

export function createWidgetSpec(spec: IWidgetSDK): IWidgetSDK {
  return Object.freeze({ ...spec });
}

export function validateWidgetConfig(spec: IWidgetSDK, config: WidgetConfig): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!config.id) {
    errors.push('Widget ID é obrigatório.');
  }

  if (config.type !== spec.id) {
    errors.push(`Tipo de widget inválido. Esperado '${spec.id}', recebido '${config.type}'.`);
  }

  if (!config.title || config.title.trim().length === 0) {
    errors.push('Título do widget é obrigatório.');
  }

  const specValidation = spec.validate(config);
  if (!specValidation.valid && specValidation.errors) {
    errors.push(...specValidation.errors);
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
