/**
 * RDM Consumer Storage Adapter — RdmStorageAdapter (ADR-001)
 *
 * Implements IStorageProvider for RDM by wrapping LocalStorageStorageProvider.
 */

import { LocalStorageStorageProvider } from '@/lib/presentation-framework/core';

export class RdmStorageAdapter extends LocalStorageStorageProvider {
  constructor(manager: string, month: number, year: number) {
    const key = `rdm_custom_slides_${manager.replace(/\s+/g, '_')}_${year}_${month}`;
    const tplKey = `rdm_templates_${manager.replace(/\s+/g, '_')}`;
    super(key, tplKey);
  }
}
