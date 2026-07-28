"use client";

import React, { useState } from "react";
import { WorkflowInstance } from "@/lib/workflow-enterprise/types";
import { CheckCircle2, XCircle, RotateCcw, ShieldCheck, Clock } from "lucide-react";

interface WorkflowApprovalsPanelProps {
  instance: WorkflowInstance;
  onApprovalAction: (action: 'APPROVE' | 'REJECT' | 'RETURN', stepId?: string, comment?: string) => Promise<void>;
}

export const WorkflowApprovalsPanel: React.FC<WorkflowApprovalsPanelProps> = ({
  instance,
  onApprovalAction,
}) => {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");

  const policy = instance.approvalPolicy;

  const handleAction = async (action: 'APPROVE' | 'REJECT' | 'RETURN', stepId?: string) => {
    try {
      setLoading(true);
      setActionSuccess("");
      await onApprovalAction(action, stepId, comment);
      setComment("");
      setActionSuccess(`Ação '${action}' processada com sucesso via ApprovalService.`);
    } catch (err: any) {
      alert(err.message || "Erro ao processar ação de aprovação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            Cadeia de Aprovação (Approval Service)
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Modo da política: <span className="font-semibold text-amber-400">{policy?.mode || "SINGLE"}</span>
          </p>
        </div>
      </div>

      {actionSuccess && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs">
          {actionSuccess}
        </div>
      )}

      {/* Steps List */}
      <div className="space-y-3 mb-6">
        {instance.approvals.map((step) => (
          <div
            key={step.stepId}
            className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-neutral-200">{step.stepName}</span>
                <span className="text-[10px] font-mono bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">
                  {step.approverRoleOrUser}
                </span>
              </div>
              {step.actionBy && (
                <span className="text-[11px] text-neutral-400 block mt-1">
                  Ação por: <strong className="text-neutral-300">{step.actionBy}</strong> em{" "}
                  {step.updatedAt ? new Date(step.updatedAt).toLocaleString("pt-BR") : "-"}
                </span>
              )}
              {step.comment && (
                <p className="text-xs text-neutral-400 italic mt-1 bg-neutral-900/60 p-2 rounded border border-neutral-800">
                  &quot;{step.comment}&quot;
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {step.status === "PENDING" ? (
                <>
                  <button
                    disabled={loading}
                    onClick={() => handleAction("APPROVE", step.stepId)}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => handleAction("RETURN", step.stepId)}
                    className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Devolver
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => handleAction("REJECT", step.stepId)}
                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-medium px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Rejeitar
                  </button>
                </>
              ) : (
                <span
                  className={`px-2.5 py-1 rounded text-xs font-semibold border ${
                    step.status === "APPROVED"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : step.status === "REJECTED"
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}
                >
                  {step.status}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Global Action Comment */}
      <div>
        <label className="text-xs text-neutral-400 font-medium block mb-1">
          Parecer da Aprovação / Justificativa da Ação:
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Escreva a justificativa para a decisão de aprovação..."
          rows={2}
          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
        />
      </div>
    </div>
  );
};
