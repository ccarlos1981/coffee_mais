// ==============================================================================
// WORKFLOW STATE MACHINE SERVICE
// Sprint 4.1 — Enterprise Workflow Engine (Phase 1 Infrastructure)
// ==============================================================================

import { StateMachineConfig, StateTransitionRule, WorkflowDefinition } from "./types";

export interface TransitionValidationResult {
  allowed: boolean;
  reason?: string;
  rule?: StateTransitionRule;
}

export class WorkflowStateMachineService {
  /**
   * Validate if a transition from currentState to targetState is permitted by the state machine
   */
  public static validateTransition(
    definition: WorkflowDefinition,
    currentState: string,
    targetState: string,
    userRole?: string
  ): TransitionValidationResult {
    const { stateMachine } = definition;

    // Check if terminal state
    if (stateMachine.terminalStates.includes(currentState)) {
      return {
        allowed: false,
        reason: `O estado atual '${currentState}' é um estado terminal. Não são permitidas transições subsequentes.`,
      };
    }

    // Find transition rule
    const rule = stateMachine.transitions.find(
      t => t.fromState === currentState && t.toState === targetState
    );

    if (!rule) {
      return {
        allowed: false,
        reason: `Não existe regra de transição permitida de '${currentState}' para '${targetState}' na definição do workflow.`,
      };
    }

    // Role check if configured
    if (userRole && rule.allowedRoles && rule.allowedRoles.length > 0) {
      const roleAllowed = rule.allowedRoles.includes(userRole) || userRole === "Admin" || userRole === "Admin Master";
      if (!roleAllowed) {
        return {
          allowed: false,
          reason: `O perfil '${userRole}' não possui permissão para executar a transição de '${currentState}' para '${targetState}'.`,
          rule,
        };
      }
    }

    return {
      allowed: true,
      rule,
    };
  }

  /**
   * Compute valid next available states for a given current state and user role
   */
  public static getNextAvailableStates(
    definition: WorkflowDefinition,
    currentState: string,
    userRole?: string
  ): string[] {
    const { stateMachine } = definition;

    if (stateMachine.terminalStates.includes(currentState)) {
      return [];
    }

    const availableTransitions = stateMachine.transitions.filter(t => t.fromState === currentState);

    return availableTransitions
      .filter(rule => {
        if (!userRole || !rule.allowedRoles || rule.allowedRoles.length === 0) return true;
        return rule.allowedRoles.includes(userRole) || userRole === "Admin" || userRole === "Admin Master";
      })
      .map(rule => rule.toState);
  }

  /**
   * Check if a state is terminal
   */
  public static isTerminalState(definition: WorkflowDefinition, state: string): boolean {
    return definition.stateMachine.terminalStates.includes(state);
  }
}
