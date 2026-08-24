import { createAdminClient } from "@/lib/supabase/admin";
import { CommercialDomainService } from "@/lib/domain";
import { logAuditAction } from "@/lib/supabase/auth-helpers";
import { AnalyticsEngine } from "@/lib/governance/analytics/engine";

export type FollowUpStatus = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'NAO_EFETIVA' | 'CANCELADA';
export type FollowUpOrigem = 'COCKPIT_PRESCRITIVO' | 'RANKING_PERFORMANCE' | 'ALERTA_QUEDA' | 'RPS_COMPROMISSO' | 'MANUAL';
export type FollowUpTipo = 'REATIVACAO_CLIENTE' | 'EXPANSAO_MIX' | 'RECUPERACAO_VOLUME' | 'NEGOCIACAO_REDE' | 'VISITA_COMERCIAL' | 'ENVIO_PROPOSTA' | 'OUTRO';
export type FollowUpPrioridade = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA';

export interface FollowUpActionRecord {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  rede: string | null;
  manager_id: string;
  manager_name: string;
  origem: FollowUpOrigem;
  origem_ref: string | null;
  tipo_acao: FollowUpTipo;
  motivo: string;
  descricao: string | null;
  prazo: string;
  status: FollowUpStatus;
  prioridade: FollowUpPrioridade;
  resultado: string | null;
  motivo_cancelamento: string | null;
  efetividade: boolean | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  concluded_at: string | null;
  is_atrasada?: boolean;
}

export interface FollowUpHistoryRecord {
  id: string;
  follow_up_id: string;
  status_anterior: FollowUpStatus | null;
  status_novo: FollowUpStatus;
  observacao: string | null;
  user_id: string;
  created_at: string;
}

export interface FollowUpListFilters {
  managerId?: string;
  status?: FollowUpStatus | 'ALL';
  origem?: FollowUpOrigem | 'ALL';
  prioridade?: FollowUpPrioridade | 'ALL';
  searchCliente?: string;
  dataInicio?: string;
  dataFim?: string;
  isAtrasada?: boolean;
}

export interface FollowUpListOptions {
  page?: number;
  pageSize?: number;
}

export interface FollowUpKpis {
  acoesAbertas: number;
  acoesConcluidas: number;
  acoesAtrasadas: number;
  taxaConclusao: number; // percentage 0-100
  tempoMedioResolucaoDias: number;
  // Efetividade Comercial Oficial (Sprint 3)
  clientesRecuperadosCount: number;
  totalElegiveisCount: number;
  taxaEfetividade: number; // percentage 0-100
  faturamentoRecuperadoTotal: number;
  rankingGerentesEfetividade: { managerName: string; elegiveisCount: number; recuperadosCount: number; taxaEfetividade: number; faturamentoRecuperado: number }[];
  efetividadePorOrigem: { origem: string; elegiveisCount: number; recuperadosCount: number; taxaEfetividade: number; faturamentoRecuperado: number }[];
}


export interface CreateFollowUpInput {
  cliente_id: string;
  tipo_acao: FollowUpTipo;
  motivo: string;
  descricao?: string;
  prazo: string; // YYYY-MM-DD
  prioridade?: FollowUpPrioridade;
  origem?: FollowUpOrigem;
  origem_ref?: string;
  manager_id?: string;
}

export interface UpdateFollowUpInput {
  tipo_acao?: FollowUpTipo;
  motivo?: string;
  descricao?: string;
  prazo?: string;
  prioridade?: FollowUpPrioridade;
}

export interface UpdateStatusInput {
  status: FollowUpStatus;
  resultado?: string;
  motivo_cancelamento?: string;
  observacao?: string;
}

const ADMIN_ROLES = new Set(['Admin', 'Admin Master']);

export class FollowUpService {
  /**
   * List follow-up actions with filters and pagination.
   */
  static async list(
    filters: FollowUpListFilters = {},
    options: FollowUpListOptions = {}
  ): Promise<{ data: FollowUpActionRecord[]; total: number; page: number; pageSize: number }> {
    const adminClient = createAdminClient();
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));
    const offset = (page - 1) * pageSize;

    let query = adminClient
      .from('cm_follow_up_actions')
      .select('*', { count: 'exact' });

    if (filters.managerId && filters.managerId !== 'ALL' && filters.managerId !== 'all') {
      query = query.eq('manager_id', filters.managerId);
    }

    if (filters.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status);
    }

    if (filters.origem && filters.origem !== 'ALL') {
      query = query.eq('origem', filters.origem);
    }

    if (filters.prioridade && filters.prioridade !== 'ALL') {
      query = query.eq('prioridade', filters.prioridade);
    }

    if (filters.searchCliente && filters.searchCliente.trim()) {
      const term = `%${filters.searchCliente.trim()}%`;
      query = query.or(`cliente_nome.ilike.${term},rede.ilike.${term}`);
    }

    if (filters.dataInicio) {
      query = query.gte('prazo', filters.dataInicio);
    }

    if (filters.dataFim) {
      query = query.lte('prazo', filters.dataFim);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('Error fetching follow-ups:', error);
      throw new Error(`Erro ao listar follow-ups: ${error.message}`);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const enriched = (data || []).map((item: any) => ({
      ...item,
      is_atrasada: ['PENDENTE', 'EM_ANDAMENTO'].includes(item.status) && item.prazo < todayStr,
    }));

    return {
      data: enriched,
      total: count || 0,
      page,
      pageSize,
    };
  }

  /**
   * Get single follow-up by ID with timeline history.
   */
  static async getById(
    id: string
  ): Promise<{ action: FollowUpActionRecord; history: FollowUpHistoryRecord[] }> {
    const adminClient = createAdminClient();

    const { data: action, error: actionErr } = await adminClient
      .from('cm_follow_up_actions')
      .select('*')
      .eq('id', id)
      .single();

    if (actionErr || !action) {
      throw new Error('Follow-up não encontrado.');
    }

    const { data: history, error: historyErr } = await adminClient
      .from('cm_follow_up_history')
      .select('*')
      .eq('follow_up_id', id)
      .order('created_at', { ascending: true });

    if (historyErr) {
      console.error('Error fetching follow-up history:', historyErr);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const isAtrasada = ['PENDENTE', 'EM_ANDAMENTO'].includes(action.status) && action.prazo < todayStr;

    return {
      action: { ...action, is_atrasada: isAtrasada },
      history: history || [],
    };
  }

  /**
   * Create a new follow-up action.
   */
  static async create(
    input: CreateFollowUpInput,
    userId: string,
    profileRole: string,
    profileManagerName?: string
  ): Promise<FollowUpActionRecord> {
    const adminClient = createAdminClient();

    if (!input.cliente_id) {
      throw new Error('cliente_id é obrigatório.');
    }
    if (!input.motivo || !input.motivo.trim()) {
      throw new Error('motivo é obrigatório.');
    }
    if (!input.prazo) {
      throw new Error('prazo é obrigatório.');
    }

    // 1. Validate client in cm_clientes
    const { data: cliente, error: cliErr } = await adminClient
      .from('cm_clientes')
      .select('id, nome, matriz, manager_id, responsavel')
      .eq('id', input.cliente_id)
      .single();

    if (cliErr || !cliente) {
      throw new Error('Cliente informado não existe no cadastro mestre.');
    }

    // 2. Validate and resolve manager via CommercialDomainService SSOT
    let targetManagerId = input.manager_id || cliente.manager_id || profileManagerName;
    if (!targetManagerId) {
      targetManagerId = CommercialDomainService.resolveManagerId(cliente.responsavel || '');
    }

    const resolvedManager = CommercialDomainService.resolveManager(targetManagerId);
    const managerName = resolvedManager.managerName || targetManagerId || 'Gerente Não Atribuído';
    const managerId = resolvedManager.managerId || targetManagerId || '9999';

    const recordPayload = {
      cliente_id: cliente.id,
      cliente_nome: cliente.nome || 'Cliente sem nome',
      rede: cliente.matriz || null,
      manager_id: managerId,
      manager_name: managerName,
      origem: input.origem || 'MANUAL',
      origem_ref: input.origem_ref || null,
      tipo_acao: input.tipo_acao || 'OUTRO',
      motivo: input.motivo.trim(),
      descricao: input.descricao ? input.descricao.trim() : null,
      prazo: input.prazo,
      status: 'PENDENTE' as FollowUpStatus,
      prioridade: input.prioridade || 'MEDIA',
      created_by: userId,
    };

    // 3. Idempotency check: if origem and origem_ref are provided, check for existing active action
    if (input.origem && input.origem_ref) {
      const { data: existingActive } = await adminClient
        .from('cm_follow_up_actions')
        .select('*')
        .eq('origem', input.origem)
        .eq('origem_ref', input.origem_ref)
        .in('status', ['PENDENTE', 'EM_ANDAMENTO'])
        .maybeSingle();

      if (existingActive) {
        return existingActive as FollowUpActionRecord;
      }
    }

    const { data: created, error: createErr } = await adminClient
      .from('cm_follow_up_actions')
      .insert(recordPayload)
      .select('*')
      .single();

    if (createErr || !created) {
      console.error('Error creating follow-up:', createErr);
      throw new Error(`Erro ao criar follow-up: ${createErr?.message}`);
    }

    // Insert history for creation
    await adminClient.from('cm_follow_up_history').insert({
      follow_up_id: created.id,
      status_anterior: null,
      status_novo: 'PENDENTE',
      observacao: 'Ação registrada no sistema.',
      user_id: userId,
    });

    await logAuditAction(userId, 'CREATE_FOLLOW_UP', 'cm_follow_up_actions', {
      follow_up_id: created.id,
      cliente_nome: created.cliente_nome,
      manager_name: created.manager_name,
    });

    return created;
  }

  /**
   * Update editable fields of a follow-up action (only if PENDENTE or EM_ANDAMENTO).
   */
  static async update(
    id: string,
    input: UpdateFollowUpInput,
    userId: string,
    profileRole: string,
    profileManagerName?: string
  ): Promise<FollowUpActionRecord> {
    const adminClient = createAdminClient();

    const { data: existing, error: getErr } = await adminClient
      .from('cm_follow_up_actions')
      .select('*')
      .eq('id', id)
      .single();

    if (getErr || !existing) {
      throw new Error('Follow-up não encontrado.');
    }

    const isAdmin = ADMIN_ROLES.has(profileRole);
    if (!isAdmin && profileManagerName && existing.manager_name !== profileManagerName) {
      throw new Error('Acesso não autorizado para alterar este follow-up.');
    }

    if (!isAdmin && !['PENDENTE', 'EM_ANDAMENTO'].includes(existing.status)) {
      throw new Error(`Não é possível editar uma ação com status ${existing.status}.`);
    }

    const updatePayload: Record<string, any> = {};
    if (input.tipo_acao) updatePayload.tipo_acao = input.tipo_acao;
    if (input.motivo) updatePayload.motivo = input.motivo.trim();
    if (input.descricao !== undefined) updatePayload.descricao = input.descricao ? input.descricao.trim() : null;
    if (input.prazo) updatePayload.prazo = input.prazo;
    if (input.prioridade) updatePayload.prioridade = input.prioridade;

    const { data: updated, error: updateErr } = await adminClient
      .from('cm_follow_up_actions')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr || !updated) {
      throw new Error(`Erro ao atualizar follow-up: ${updateErr?.message}`);
    }

    await logAuditAction(userId, 'UPDATE_FOLLOW_UP', 'cm_follow_up_actions', {
      follow_up_id: id,
      changes: Object.keys(updatePayload),
    });

    return updated;
  }

  /**
   * Transition status of a follow-up action following strict lifecycle rules.
   */
  static async updateStatus(
    id: string,
    input: UpdateStatusInput,
    userId: string,
    profileRole: string,
    profileManagerName?: string
  ): Promise<FollowUpActionRecord> {
    const adminClient = createAdminClient();

    const { data: existing, error: getErr } = await adminClient
      .from('cm_follow_up_actions')
      .select('*')
      .eq('id', id)
      .single();

    if (getErr || !existing) {
      throw new Error('Follow-up não encontrado.');
    }

    const isAdmin = ADMIN_ROLES.has(profileRole);
    if (!isAdmin && profileManagerName && existing.manager_name !== profileManagerName) {
      throw new Error('Acesso não autorizado para alterar este follow-up.');
    }

    const currentStatus = existing.status as FollowUpStatus;
    const newStatus = input.status;

    // Validate lifecycle transitions
    this.validateStatusTransition(currentStatus, newStatus, isAdmin);

    // Validate required fields per transition
    if (newStatus === 'CONCLUIDA') {
      const resText = input.resultado || existing.resultado;
      if (!resText || !resText.trim()) {
        throw new Error('O campo resultado é obrigatório para concluir a ação.');
      }
    }

    if (newStatus === 'NAO_EFETIVA') {
      const resText = input.resultado || existing.resultado;
      const motText = input.motivo_cancelamento || existing.motivo_cancelamento;
      if (!resText || !resText.trim()) {
        throw new Error('O campo resultado é obrigatório para marcar ação como não efetiva.');
      }
      if (!motText || !motText.trim()) {
        throw new Error('O motivo da não efetividade é obrigatório.');
      }
    }

    if (newStatus === 'CANCELADA') {
      const motText = input.motivo_cancelamento || existing.motivo_cancelamento;
      if (!motText || !motText.trim()) {
        throw new Error('O motivo do cancelamento é obrigatório.');
      }
    }

    const updatePayload: Record<string, any> = {
      status: newStatus,
    };

    if (input.resultado !== undefined) {
      updatePayload.resultado = input.resultado ? input.resultado.trim() : null;
    }
    if (input.motivo_cancelamento !== undefined) {
      updatePayload.motivo_cancelamento = input.motivo_cancelamento ? input.motivo_cancelamento.trim() : null;
    }
    if (newStatus === 'CONCLUIDA' || newStatus === 'NAO_EFETIVA') {
      updatePayload.concluded_at = new Date().toISOString();
    } else if (newStatus === 'EM_ANDAMENTO' || newStatus === 'PENDENTE') {
      updatePayload.concluded_at = null;
    }

    const { data: updated, error: updateErr } = await adminClient
      .from('cm_follow_up_actions')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr || !updated) {
      throw new Error(`Erro ao alterar status: ${updateErr?.message}`);
    }

    // Insert history
    await adminClient.from('cm_follow_up_history').insert({
      follow_up_id: id,
      status_anterior: currentStatus,
      status_novo: newStatus,
      observacao: input.observacao || input.resultado || input.motivo_cancelamento || null,
      user_id: userId,
    });

    await logAuditAction(userId, 'UPDATE_FOLLOW_UP_STATUS', 'cm_follow_up_actions', {
      follow_up_id: id,
      status_anterior: currentStatus,
      status_novo: newStatus,
    });

    return updated;
  }

  /**
   * Validate lifecycle transitions matrix.
   */
  private static validateStatusTransition(
    current: FollowUpStatus,
    next: FollowUpStatus,
    isAdmin: boolean
  ) {
    if (current === next) return;

    // Reopening rules (CONCLUIDA -> EM_ANDAMENTO or NAO_EFETIVA -> EM_ANDAMENTO)
    if (['CONCLUIDA', 'NAO_EFETIVA'].includes(current) && next === 'EM_ANDAMENTO') {
      if (!isAdmin) {
        throw new Error('Apenas administradores podem reabrir uma ação concluída ou não efetiva.');
      }
      return;
    }

    const allowedMap: Record<FollowUpStatus, FollowUpStatus[]> = {
      PENDENTE: ['EM_ANDAMENTO', 'CANCELADA'],
      EM_ANDAMENTO: ['CONCLUIDA', 'NAO_EFETIVA', 'CANCELADA'],
      CONCLUIDA: isAdmin ? ['EM_ANDAMENTO'] : [],
      NAO_EFETIVA: isAdmin ? ['EM_ANDAMENTO'] : [],
      CANCELADA: [],
    };

    const allowed = allowedMap[current] || [];
    if (!allowed.includes(next)) {
      throw new Error(`Transição de status inválida: de ${current} para ${next}.`);
    }
  }

  /**
   * Calculate operational KPIs for Follow-up actions.
   */
  static async getKpis(filters: FollowUpListFilters = {}): Promise<FollowUpKpis> {
    const adminClient = createAdminClient();

    let query = adminClient
      .from('cm_follow_up_actions')
      .select('id, status, prazo, created_at, concluded_at');

    if (filters.managerId && filters.managerId !== 'ALL' && filters.managerId !== 'all') {
      query = query.eq('manager_id', filters.managerId);
    }
    if (filters.origem && filters.origem !== 'ALL') {
      query = query.eq('origem', filters.origem);
    }
    if (filters.dataInicio) {
      query = query.gte('prazo', filters.dataInicio);
    }
    if (filters.dataFim) {
      query = query.lte('prazo', filters.dataFim);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error calculating follow-up KPIs:', error);
      throw new Error(`Erro ao calcular KPIs: ${error.message}`);
    }

    const items = data || [];
    const todayStr = new Date().toISOString().slice(0, 10);

    let acoesAbertas = 0;
    let acoesConcluidas = 0;
    let acoesAtrasadas = 0;
    let acoesNaoEfetivas = 0;
    let totalDuracaoMs = 0;
    let concluidasComDuracaoCount = 0;

    for (const item of items) {
      const isAberta = ['PENDENTE', 'EM_ANDAMENTO'].includes(item.status);
      const isConcluida = item.status === 'CONCLUIDA';
      const isNaoEfetiva = item.status === 'NAO_EFETIVA';

      if (isAberta) {
        acoesAbertas++;
        if (item.prazo < todayStr) {
          acoesAtrasadas++;
        }
      }

      if (isConcluida) {
        acoesConcluidas++;
        if (item.concluded_at && item.created_at) {
          const t1 = new Date(item.created_at).getTime();
          const t2 = new Date(item.concluded_at).getTime();
          if (t2 >= t1) {
            totalDuracaoMs += (t2 - t1);
            concluidasComDuracaoCount++;
          }
        }
      }

      if (isNaoEfetiva) {
        acoesNaoEfetivas++;
      }
    }

    const totalFinalizadas = acoesConcluidas + acoesNaoEfetivas;
    const taxaConclusao = totalFinalizadas > 0
      ? Number(((acoesConcluidas / totalFinalizadas) * 100).toFixed(1))
      : 0;

    const tempoMedioResolucaoDias = concluidasComDuracaoCount > 0
      ? Number(((totalDuracaoMs / concluidasComDuracaoCount) / (1000 * 60 * 60 * 24)).toFixed(1))
      : 0;

    // Fetch official read-only Efetividade analytics from AnalyticsEngine
    let efetividadeAnalytics = {
      clientesRecuperadosCount: 0,
      totalElegiveisCount: 0,
      taxaEfetividade: 0,
      faturamentoRecuperadoTotal: 0,
      rankingGerentesEfetividade: [] as any[],
      efetividadePorOrigem: [] as any[],
    };

    try {
      efetividadeAnalytics = await AnalyticsEngine.getFollowUpEfetividadeAnalytics(filters.managerId);
    } catch (efErr) {
      console.error('Error fetching Efetividade analytics:', efErr);
    }

    return {
      acoesAbertas,
      acoesConcluidas,
      acoesAtrasadas,
      taxaConclusao,
      tempoMedioResolucaoDias,
      clientesRecuperadosCount: efetividadeAnalytics.clientesRecuperadosCount,
      totalElegiveisCount: efetividadeAnalytics.totalElegiveisCount,
      taxaEfetividade: efetividadeAnalytics.taxaEfetividade,
      faturamentoRecuperadoTotal: efetividadeAnalytics.faturamentoRecuperadoTotal,
      rankingGerentesEfetividade: efetividadeAnalytics.rankingGerentesEfetividade,
      efetividadePorOrigem: efetividadeAnalytics.efetividadePorOrigem,
    };
  }
}

