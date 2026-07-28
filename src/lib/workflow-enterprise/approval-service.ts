// ==============================================================================
// APPROVAL SERVICE
// Sprint 4.1 — Enterprise Workflow Engine (Phase 3 Workflow Instances)
// ==============================================================================

import { ApprovalPolicyConfig, ApprovalStatus, ApprovalStep, WorkflowInstance } from "./types";

export interface ProcessApprovalParams {
  instance: WorkflowInstance;
  stepId?: string;
  approverUserOrRole: string;
  approverName: string;
  action: 'APPROVE' | 'REJECT' | 'RETURN';
  comment?: string;
}

export interface ProcessApprovalResult {
  instance: WorkflowInstance;
  overallStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  stepUpdated?: ApprovalStep;
  nextTargetState?: string;
}

export class ApprovalService {
  /**
   * Process approval decision on a workflow instance
   */
  public static processApproval(params: ProcessApprovalParams): ProcessApprovalResult {
    const { instance, action, approverName, approverUserOrRole, comment } = params;
    const policy = instance.approvalPolicy;

    if (!policy) {
      throw new Error(`O workflow #${instance.workflowId} não possui política de aprovação associada.`);
    }

    const now = new Date().toISOString();

    // Find step to approve
    let targetStep = params.stepId
      ? instance.approvals.find(a => a.stepId === params.stepId)
      : instance.approvals.find(a => a.status === "PENDING");

    if (!targetStep && action === "APPROVE") {
      throw new Error(`Nenhum passo de aprovação pendente encontrado no workflow #${instance.workflowId}.`);
    }

    if (targetStep) {
      if (targetStep.status !== "PENDING" && action === "APPROVE") {
        throw new Error(`O passo '${targetStep.stepName}' já foi processado com status '${targetStep.status}'. Prevenção de dupla aprovação ativada.`);
      }

      const statusMap: Record<string, ApprovalStatus> = {
        APPROVE: "APPROVED",
        REJECT: "REJECTED",
        RETURN: "RETURNED",
      };

      targetStep.status = statusMap[action];
      targetStep.actionBy = approverName;
      targetStep.comment = comment;
      targetStep.updatedAt = now;
    }

    // Evaluate overall approval state based on mode
    const overallStatus = this.evaluateOverallStatus(policy, instance.approvals);

    let nextTargetState: string | undefined;
    if (overallStatus === "APPROVED") {
      nextTargetState = "Approved";
    } else if (overallStatus === "REJECTED") {
      nextTargetState = "Rejected";
    } else if (overallStatus === "RETURNED") {
      nextTargetState = "Returned";
    }

    return {
      instance,
      overallStatus,
      stepUpdated: targetStep,
      nextTargetState,
    };
  }

  /**
   * Evaluate overall policy status for SINGLE, SEQUENTIAL, PARALLEL, or QUORUM modes
   */
  private static evaluateOverallStatus(
    policy: ApprovalPolicyConfig,
    approvals: ApprovalStep[]
  ): 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED' {
    if (approvals.some(a => a.status === "REJECTED")) return "REJECTED";
    if (approvals.some(a => a.status === "RETURNED")) return "RETURNED";

    const total = approvals.length;
    const approvedCount = approvals.filter(a => a.status === "APPROVED").length;

    if (total === 0) return "APPROVED";

    switch (policy.mode) {
      case "SINGLE":
        return approvedCount >= 1 ? "APPROVED" : "PENDING";

      case "SEQUENTIAL":
      case "PARALLEL":
        return approvedCount === total ? "APPROVED" : "PENDING";

      case "QUORUM": {
        const requiredPct = policy.quorumPercentage || 50;
        const currentPct = (approvedCount / total) * 100;
        return currentPct >= requiredPct ? "APPROVED" : "PENDING";
      }

      default:
        return approvedCount === total ? "APPROVED" : "PENDING";
    }
  }
}
