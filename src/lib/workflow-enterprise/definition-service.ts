// ==============================================================================
// WORKFLOW DEFINITION SERVICE
// Sprint 4.1 — Enterprise Workflow Engine (Phase 2 Workflow Definitions)
// ==============================================================================

import { WorkflowDefinitionRepository } from "./definition-repository";
import { WorkflowDefinition, WorkflowFilterOptions } from "./types";

export class WorkflowDefinitionService {
  private static repository = new WorkflowDefinitionRepository();

  /**
   * Register a new workflow definition template
   */
  public static async createDefinition(
    data: Omit<WorkflowDefinition, "id" | "createdAt" | "updatedAt">
  ): Promise<WorkflowDefinition> {
    const now = new Date().toISOString();
    const id = `def-${data.workflowKey}-v${data.version}-${Date.now().toString(36)}`;

    const definition: WorkflowDefinition = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.save(definition);
  }

  /**
   * Synchronous creation fallback for testing
   */
  public static createDefinitionSync(
    data: Omit<WorkflowDefinition, "id" | "createdAt" | "updatedAt">
  ): WorkflowDefinition {
    const now = new Date().toISOString();
    const id = `def-${data.workflowKey}-v${data.version}-${Date.now().toString(36)}`;

    const definition: WorkflowDefinition = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    // Store synchronously
    WorkflowDefinitionRepository.prototype.save.call(this.repository, definition);
    return definition;
  }

  /**
   * Get workflow definition by ID
   */
  public static async getDefinitionById(id: string): Promise<WorkflowDefinition | undefined> {
    return this.repository.findById(id);
  }

  /**
   * Synchronous lookup for internal sync engine calls
   */
  public static getDefinitionByIdSync(id: string): WorkflowDefinition | undefined {
    let result: WorkflowDefinition | undefined;
    this.repository.findById(id).then(res => {
      result = res;
    });
    // In memory fallback sync
    return (this.repository as any).constructor.inMemoryStore.get(id);
  }

  /**
   * Get latest active definition by workflowKey or entityType
   */
  public static async getDefinitionByKey(workflowKey: string, version?: number): Promise<WorkflowDefinition | undefined> {
    return this.repository.findByKey(workflowKey, version);
  }

  public static getDefinitionByKeySync(workflowKey: string, version?: number): WorkflowDefinition | undefined {
    return (this.repository as any).constructor.findByKeySync
      ? (this.repository as any).constructor.findByKeySync(workflowKey, version)
      : (this.repository as any).constructor.inMemoryStore.get(workflowKey);
  }

  /**
   * Get definition by entityType
   */
  public static async getDefinitionByEntityType(entityType: string): Promise<WorkflowDefinition | undefined> {
    return this.repository.findByEntityType(entityType);
  }

  /**
   * List all definitions with optional filter
   */
  public static async listDefinitions(filters?: WorkflowFilterOptions): Promise<WorkflowDefinition[]> {
    return this.repository.findAll(filters);
  }

  /**
   * Synchronous list for internal sync engine calls
   */
  public static listDefinitionsSync(filters?: WorkflowFilterOptions): WorkflowDefinition[] {
    const all: WorkflowDefinition[] = Array.from((this.repository as any).constructor.inMemoryStore.values());
    if (!filters) return all;
    let res = all;
    if (filters.entityType) res = res.filter(d => d.entityType === filters.entityType);
    if (filters.activeOnly !== false) res = res.filter(d => d.active);
    return res;
  }

  /**
   * Update workflow definition (or toggle active)
   */
  public static async updateDefinition(
    id: string,
    updates: Partial<Omit<WorkflowDefinition, "id" | "createdAt">>
  ): Promise<WorkflowDefinition> {
    return this.repository.update(id, updates);
  }

  /**
   * Logically deactivate a definition
   */
  public static async deactivateDefinition(id: string): Promise<WorkflowDefinition> {
    return this.repository.softDelete(id);
  }
}
