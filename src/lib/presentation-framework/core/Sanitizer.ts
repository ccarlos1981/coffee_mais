/**
 * Presentation Framework Core — Input Sanitizer & Security (ADR-001 Gate v1.0)
 *
 * 100% UI-Agnostic string sanitization preventing XSS and injection attacks in user slides.
 */

export class Sanitizer {
  /**
   * Sanitiza strings textuais removendo tags HTML e caracteres maliciosos.
   */
  public static sanitizeText(input: unknown): string {
    if (typeof input !== 'string') return '';

    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '')
      .replace(/onload=/gi, '')
      .replace(/onerror=/gi, '')
      .trim();
  }

  /**
   * Valida se um ID de slide ou widget é seguro.
   */
  public static isValidId(id: unknown): boolean {
    if (typeof id !== 'string') return false;
    return /^[a-zA-Z0-9_\-]+$/.test(id);
  }
}
