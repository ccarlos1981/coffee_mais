import { createClient } from "@/lib/supabase/server";
import { encontrarCorrespondenciaCliente, normalizarNome } from "./clienteMatching";
import { avaliarRegrasComerciais, ResponsavelRegra } from "./motorResponsavel";
import { calcularScoreConfianca } from "./scoreConfianca";

export interface ExecutionStats {
  analisados: number;
  sugestoesGeradas: number;
  autoSugeridos: number; // confianca >= 90%
  pendentesRevisao: number; // confianca < 90%
  semCorrespondencia: number;
  tempoTotalMs: number;
  regrasAvaliadas: number;
}

export class AutoAssociacaoService {
  /**
   * Executa a orquestração completa da geração de sugestões de responsável comercial.
   */
  static async gerarSugestoes(
    strategy: 'faturamento' | 'frequencia' = 'faturamento',
    limitMonths: number = 12,
    minConfidenceThreshold: number = 90
  ): Promise<{ stats: ExecutionStats; suggestions: any[] }> {
    const startTime = Date.now();
    const supabase = await createClient();

    // 1. Carregar regras de associação ativas
    const { data: dbRegras, error: regrasErr } = await supabase
      .from("cm_responsavel_regras")
      .select("*")
      .eq("ativo", true)
      .order("prioridade", { ascending: true });

    if (regrasErr) {
      throw new Error(`Erro ao carregar regras comerciais: ${regrasErr.message}`);
    }

    const regras: ResponsavelRegra[] = (dbRegras || []).map((r: any) => ({
      id: r.id,
      prioridade: r.prioridade,
      tipo_regra: r.tipo_regra,
      campo_origem: r.campo_origem,
      operador: r.operador,
      valor_origem: r.valor_origem,
      responsavel_resultado: r.responsavel_resultado,
      ativo: r.ativo,
      observacao: r.observacao
    }));

    // 2. Carregar clientes elegíveis (sem responsável comercial)
    const { data: dbClientes, error: clientesErr } = await supabase
      .from("cm_clientes")
      .select("id, codigo, nome_parceiro, razao_social, cnpj, responsavel")
      .or("responsavel.is.null,responsavel.eq.,responsavel.eq.Não associado");

    if (clientesErr) {
      throw new Error(`Erro ao carregar clientes sem responsável: ${clientesErr.message}`);
    }

    const clientes = dbClientes || [];
    if (clientes.length === 0) {
      return {
        stats: {
          analisados: 0,
          sugestoesGeradas: 0,
          autoSugeridos: 0,
          pendentesRevisao: 0,
          semCorrespondencia: 0,
          tempoTotalMs: Date.now() - startTime,
          regrasAvaliadas: regras.length
        },
        suggestions: []
      };
    }

    // 3. Carregar base de atendimento
    const { data: baseAtendimento, error: atErr } = await supabase
      .from("base_atendimento")
      .select("cod_parceiro, nome_parceiro, cnpj, manager, canal");

    if (atErr) {
      throw new Error(`Erro ao carregar base de atendimento: ${atErr.message}`);
    }

    // 4. Carregar histórico de faturamento consolidado
    const faturamentoQuery = `
      SELECT 
        cod_parceiro,
        nome_parceiro,
        nome_vendedor,
        SUM(vlr_total_liq) as total_faturamento,
        COUNT(*) as frequencia,
        MAX(dt_faturamento) as latest_date
      FROM public.cm_faturamento
      WHERE dt_faturamento >= NOW() - INTERVAL '${limitMonths} months'
        AND status_nfe != 'CANCELADA'
      GROUP BY cod_parceiro, nome_parceiro, nome_vendedor
    `;

    const { data: dbFaturamento, error: fatErr } = await supabase.rpc('execute_readonly_query', {
      query_text: faturamentoQuery
    });

    if (fatErr) {
      throw new Error(`Erro ao carregar faturamento consolidado: ${fatErr.message}`);
    }

    const faturamentoConsolidado = dbFaturamento || [];

    // 5. Construir estruturas de busca otimizada (O(1) Map)
    const baseAtendimentoByCode = new Map<string, any>();
    const baseAtendimentoByName = new Map<string, any>();
    const faturamentoByCode = new Map<string, any[]>();
    const faturamentoByName = new Map<string, any[]>();

    (baseAtendimento || []).forEach(item => {
      if (item.cod_parceiro) baseAtendimentoByCode.set(item.cod_parceiro, item);
      if (item.nome_parceiro) baseAtendimentoByName.set(normalizarNome(item.nome_parceiro), item);
    });

    faturamentoConsolidado.forEach((item: any) => {
      if (item.cod_parceiro) {
        const arr = faturamentoByCode.get(item.cod_parceiro) || [];
        arr.push(item);
        faturamentoByCode.set(item.cod_parceiro, arr);
      }
      if (item.nome_parceiro) {
        const key = normalizarNome(item.nome_parceiro);
        const arr = faturamentoByName.get(key) || [];
        arr.push(item);
        faturamentoByName.set(key, arr);
      }
    });

    // 6. Executar pareamento e gerar sugestões
    const suggestionsToInsert: any[] = [];
    let stats = {
      analisados: clientes.length,
      sugestoesGeradas: 0,
      autoSugeridos: 0,
      pendentesRevisao: 0,
      semCorrespondencia: 0,
      tempoTotalMs: 0,
      regrasAvaliadas: regras.length
    };

    for (const client of clientes) {
      // Camada 1: Matching do Cliente
      // Executa pareamento otimizado usando Maps antes de Levenshtein
      const matchingResult = encontrarCorrespondenciaCliente(
        client,
        baseAtendimento || [],
        faturamentoConsolidado,
        0.90
      );

      if (!matchingResult) {
        stats.semCorrespondencia++;
        continue;
      }

      // Camada 2: Motor de Regras Comerciais
      const ruleResult = avaliarRegrasComerciais(
        matchingResult.matchedRecord,
        matchingResult.origem,
        regras
      );

      if (!ruleResult) {
        stats.semCorrespondencia++;
        continue;
      }

      // Obter histórico de faturamento para cálculo do Score (pelo código correspondente)
      const codCorrespondente = matchingResult.matchedRecord.cod_parceiro;
      const fatHistory = faturamentoByCode.get(codCorrespondente) || [];

      // Camada 3: Cálculo de Score e Explicabilidade
      const scoreResult = calcularScoreConfianca(matchingResult, fatHistory);

      // Formatar justificativa e explicabilidade
      const justificativaDetalhada = JSON.stringify({
        matching_strategy: matchingResult.matchingStrategy,
        matching_origem: matchingResult.origem,
        regra_id: ruleResult.regraAplicada.id,
        regra_motivo: ruleResult.motivo,
        fatores: scoreResult.fatores
      });

      suggestionsToInsert.push({
        cliente_id: client.id,
        responsavel_sugerido: ruleResult.responsavelSugerido,
        origem_sugestao: matchingResult.origem,
        confianca: scoreResult.confianca,
        motivo: justificativaDetalhada
      });

      stats.sugestoesGeradas++;
      if (scoreResult.confianca >= minConfidenceThreshold) {
        stats.autoSugeridos++;
      } else {
        stats.pendentesRevisao++;
      }
    }

    // 7. Persistência transacional (Idempotência via RPC)
    if (suggestionsToInsert.length > 0) {
      const { error: saveErr } = await supabase.rpc('fn_save_suggestions_transactional', {
        suggestions_to_insert: suggestionsToInsert
      });

      if (saveErr) {
        throw new Error(`Erro transacional ao salvar sugestões: ${saveErr.message}`);
      }
    } else {
      // Clear pending if no suggestions were generated
      await supabase.from("cm_responsavel_sugestoes").delete().eq("status", "pendente");
    }

    stats.tempoTotalMs = Date.now() - startTime;

    // 8. Gravar log de auditoria da execução
    await supabase.from("cm_ai_decision_log").insert({
      decision_type: "auto_associacao_summary",
      model_confidence: 1.0,
      approved_by_human: true,
      input_payload: {
        strategy,
        limitMonths,
        minConfidenceThreshold
      },
      decision_payload: {
        stats,
        tempo_ms: stats.tempoTotalMs
      }
    });

    return {
      stats,
      suggestions: suggestionsToInsert
    };
  }

  /**
   * Processa a decisão do usuário (Aprovar ou Rejeitar) sobre uma sugestão específica.
   */
  static async processarSugestao(
    sugestaoId: string,
    acao: 'aprovar' | 'rejeitar',
    usuarioExecutor: string,
    motivoRejeicao?: string
  ): Promise<{ success: boolean }> {
    const supabase = await createClient();

    // Carregar a sugestão
    const { data: sugestao, error: findErr } = await supabase
      .from("cm_responsavel_sugestoes")
      .select("*")
      .eq("id", sugestaoId)
      .single();

    if (findErr || !sugestao) {
      throw new Error("Sugestão não encontrada");
    }

    if (sugestao.status !== "pendente") {
      throw new Error(`A sugestão já foi processada anteriormente com o status: ${sugestao.status}`);
    }

    if (acao === "aprovar") {
      // 1. Atualizar o responsável no cliente
      const { error: clientErr } = await supabase
        .from("cm_clientes")
        .update({ responsavel: sugestao.responsavel_sugerido })
        .eq("id", sugestao.cliente_id);

      if (clientErr) {
        throw new Error(`Erro ao atualizar responsável do cliente: ${clientErr.message}`);
      }

      // 2. Registrar decisão na tabela de auditoria
      const { error: logErr } = await supabase
        .from("cm_responsavel_sugestoes")
        .update({
          status: "aprovado",
          approved_by: usuarioExecutor,
          approved_at: new Date().toISOString()
        })
        .eq("id", sugestaoId);

      if (logErr) {
        throw new Error(`Erro ao atualizar status da sugestão: ${logErr.message}`);
      }

      // 3. Registrar log genérico de IA
      await supabase.from("cm_ai_decision_log").insert({
        decision_type: "auto_associacao_aprovacao",
        model_confidence: Number(sugestao.confianca),
        approved_by_human: true,
        input_payload: {
          sugestao_id: sugestaoId,
          cliente_id: sugestao.cliente_id,
          responsavel: sugestao.responsavel_sugerido
        },
        decision_payload: {
          usuario_executor: usuarioExecutor,
          confianca: sugestao.confianca,
          motivo: sugestao.motivo
        }
      });
    } else {
      // Rejeitar
      const { error: logErr } = await supabase
        .from("cm_responsavel_sugestoes")
        .update({
          status: "rejeitado",
          rejected_by: usuarioExecutor,
          rejected_at: new Date().toISOString(),
          rejection_reason: motivoRejeicao || "Rejeitado manualmente pelo usuário"
        })
        .eq("id", sugestaoId);

      if (logErr) {
        throw new Error(`Erro ao rejeitar sugestão: ${logErr.message}`);
      }

      // Registrar log genérico de IA
      await supabase.from("cm_ai_decision_log").insert({
        decision_type: "auto_associacao_rejeicao",
        model_confidence: Number(sugestao.confianca),
        approved_by_human: false,
        input_payload: {
          sugestao_id: sugestaoId,
          cliente_id: sugestao.cliente_id
        },
        decision_payload: {
          usuario_executor: usuarioExecutor,
          rejection_reason: motivoRejeicao || "Rejeitado manualmente"
        }
      });
    }

    return { success: true };
  }
}
