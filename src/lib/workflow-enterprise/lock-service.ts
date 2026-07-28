// ==============================================================================
// WORKFLOW LOCK SERVICE
// Sprint 4.1 — Enterprise Workflow Engine (Phase 3 Workflow Instances)
// ==============================================================================

import { WorkflowInstance } from "./types";

export interface LockAcquisitionResult {
  acquired: boolean;
  lockToken?: string;
  reason?: string;
}

/**
 * WorkflowLockService
 * 
 * Provides transactional consistency and concurrency guards during concurrent
 * mutations on Workflow Instances.
 * Prevents double approval, race conditions, and conflicting state transitions using
 * optimistic version checks and in-memory execution mutex locks per workflowId.
 */
export class WorkflowLockService {
  private static activeLocks: Map<string, { token: string; acquiredAt: number; holder: string }> = new Map();
  private static LOCK_TIMEOUT_MS = 5000; // 5 seconds lock auto-release fallback

  /**
   * Acquire execution lock for a workflow instance to prevent race conditions
   */
  public static async acquireLock(workflowId: string, holder: string): Promise<LockAcquisitionResult> {
    const now = Date.now();
    const existing = this.activeLocks.get(workflowId);

    if (existing) {
      // Check if lock timed out
      if (now - existing.acquiredAt < this.LOCK_TIMEOUT_MS) {
        return {
          acquired: false,
          reason: `Operação concorrente em andamento no workflow #${workflowId} por '${existing.holder}'. Tente novamente em alguns instantes.`,
        };
      }
    }

    const token = `lock-${workflowId}-${now}-${Math.random().toString(36).substring(2, 6)}`;
    this.activeLocks.set(workflowId, { token, acquiredAt: now, holder });

    return {
      acquired: true,
      lockToken: token,
    };
  }

  /**
   * Release lock for a workflow instance
   */
  public static async releaseLock(workflowId: string, token: string): Promise<boolean> {
    const existing = this.activeLocks.get(workflowId);
    if (existing && existing.token === token) {
      this.activeLocks.delete(workflowId);
      return true;
    }
    return false;
  }

  /**
   * Validate optimistic concurrency version/updatedAt timestamp before mutation
   */
  public static validateOptimisticLock(instance: WorkflowInstance, expectedUpdatedAt?: string): void {
    if (expectedUpdatedAt && instance.updatedAt !== expectedUpdatedAt) {
      throw new Error(
        `Conflito de concorrência detectado: O workflow #${instance.workflowId} foi alterado por outro usuário (Versão gravada: ${instance.updatedAt}, Versão enviada: ${expectedUpdatedAt}). Por favor, recarregue a página.`
      );
    }
  }

  /**
   * Execute an async operation with automatic lock acquisition and release
   */
  public static async executeWithLock<T>(
    workflowId: string,
    holder: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const lockResult = await this.acquireLock(workflowId, holder);
    if (!lockResult.acquired) {
      throw new Error(lockResult.reason || `Não foi possível adquirir o bloqueio transacional para #${workflowId}.`);
    }

    try {
      return await operation();
    } finally {
      if (lockResult.lockToken) {
        await this.releaseLock(workflowId, lockResult.lockToken);
      }
    }
  }
}
