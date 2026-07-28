"use client";

import React from "react";
import { Search, Filter, RefreshCw } from "lucide-react";

interface WorkflowFilterBarProps {
  search: string;
  setSearch: (v: string) => void;
  entityTypeFilter: string;
  setEntityTypeFilter: (v: string) => void;
  stateFilter: string;
  setStateFilter: (v: string) => void;
  priorityFilter: string;
  setPriorityFilter: (v: string) => void;
  onRefresh: () => void;
}

export const WorkflowFilterBar: React.FC<WorkflowFilterBarProps> = ({
  search,
  setSearch,
  entityTypeFilter,
  setEntityTypeFilter,
  stateFilter,
  setStateFilter,
  priorityFilter,
  setPriorityFilter,
  onRefresh,
}) => {
  return (
    <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 mb-6 shadow-sm backdrop-blur-md">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar workflows por título, ID ou entidade..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 transition"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Entity Type */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-500/50"
            >
              <option value="">Todas Entidades</option>
              <option value="CRM_OPPORTUNITY">CRM Opportunity</option>
              <option value="SOP_PLAN">S&OP Plan</option>
              <option value="INVESTMENT_ACTION">Investment Action</option>
              <option value="PROMOTOR_ROUTINE">Promotor Routine</option>
              <option value="HR_REQUEST">HR Request</option>
            </select>
          </div>

          {/* State */}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-500/50"
          >
            <option value="">Todos os Estados</option>
            <option value="Draft">Draft</option>
            <option value="Under Review">Under Review</option>
            <option value="Approved">Approved</option>
            <option value="Executing">Executing</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Rejected">Rejected</option>
            <option value="Returned">Returned</option>
          </select>

          {/* Priority */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-500/50"
          >
            <option value="">Todas Prioridades</option>
            <option value="LOW">Baixa (LOW)</option>
            <option value="MEDIUM">Média (MEDIUM)</option>
            <option value="HIGH">Alta (HIGH)</option>
            <option value="URGENT">Urgente (URGENT)</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-2 rounded-lg text-xs font-medium transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
        </div>
      </div>
    </div>
  );
};
