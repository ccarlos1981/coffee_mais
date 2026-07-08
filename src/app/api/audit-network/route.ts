import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.trim() || '';
    const includeFaturamento = searchParams.get('include_faturamento') === 'true';

    if (!query) {
      return NextResponse.json({ success: false, error: 'O termo de busca é obrigatório.' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // 1. Busca Prioritária
    let cmClientes: any[] = [];
    let baseAtendimento: any[] = [];
    let cmRedesMatrizes: any[] = [];
    let networkMatrix: any[] = [];

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query);
    const isNumeric = /^\d+(\.\d+)?$/.test(query);

    if (isUUID) {
      // 1. Prioridade network_id / UUID
      const { data: c } = await supabase.from('cm_clientes').select('*').eq('id', query);
      if (c) cmClientes = c;
    } else if (isNumeric) {
      // 2. Prioridade matriz_id / codigo_integracao / codigo parceiro
      const numVal = parseInt(query, 10);
      
      // Query by numeric codes
      const { data: c } = await supabase
        .from('cm_clientes')
        .select('*')
        .or(`codigo.eq.${numVal},codigo_matriz.eq.${query},codigo_matriz.eq.${numVal}.0`);
      if (c) cmClientes = c;

      const { data: b } = await supabase
        .from('base_atendimento')
        .select('*')
        .eq('cod_parceiro', String(numVal));
      if (b) baseAtendimento = b;

      const { data: rm } = await supabase
        .from('cm_redes_matrizes')
        .select('*')
        .or(`codigo.eq.${query},codigo.eq.${numVal}.0`);
      if (rm) cmRedesMatrizes = rm;

      // Try numeric matching on network_matrix id
      const { data: nm } = await supabase
        .from('network_matrix')
        .select('*')
        .eq('id', numVal);
      if (nm) networkMatrix = nm;
    }

    // Se não encontrou nada específico por ID/Código, ou não é UUID/Numérico, realiza busca por nome (ILIKE)
    if (cmClientes.length === 0 && baseAtendimento.length === 0 && cmRedesMatrizes.length === 0 && networkMatrix.length === 0) {
      const { data: c } = await supabase
        .from('cm_clientes')
        .select('*')
        .or(`matriz.ilike.%${query}%,nome_parceiro.ilike.%${query}%`);
      if (c) cmClientes = c || [];

      const { data: b } = await supabase
        .from('base_atendimento')
        .select('*')
        .or(`rede.ilike.%${query}%,nome_parceiro.ilike.%${query}%`);
      if (b) baseAtendimento = b || [];

      const { data: rm } = await supabase
        .from('cm_redes_matrizes')
        .select('*')
        .ilike('nome', `%${query}%`);
      if (rm) cmRedesMatrizes = rm || [];

      const { data: nm } = await supabase
        .from('network_matrix')
        .select('*')
        .or(`network.ilike.%${query}%,network_uf.ilike.%${query}%`);
      if (nm) networkMatrix = nm || [];
    }

    // Se nenhuma tabela retornou registros, a rede é inexistente
    if (cmClientes.length === 0 && baseAtendimento.length === 0 && cmRedesMatrizes.length === 0 && networkMatrix.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          notFound: true,
          severity: '🔴 Crítico',
          diagnosis: 'Rede inexistente no ecossistema.',
          recommendations: 'Verifique se o nome, código ou ID digitado está correto. Caso o cliente seja novo, cadastre-o no portal de configuração de clientes.'
        }
      });
    }

    // 2. Extração de Chaves de Relacionamento Consolidadas
    const clientCodes = Array.from(new Set([
      ...cmClientes.map(c => c.codigo).filter(Boolean),
      ...baseAtendimento.map(b => b.cod_parceiro).filter(Boolean).map(Number)
    ]));

    const matrizCodes = Array.from(new Set([
      ...cmClientes.map(c => c.codigo_matriz).filter(Boolean),
      ...cmRedesMatrizes.map(rm => rm.codigo).filter(Boolean)
    ]));

    const networkNames = Array.from(new Set([
      ...cmClientes.map(c => c.matriz?.toUpperCase().trim()).filter(Boolean),
      ...baseAtendimento.map(b => b.rede?.toUpperCase().trim()).filter(Boolean),
      ...cmRedesMatrizes.map(rm => rm.nome?.toUpperCase().trim()).filter(Boolean)
    ]));

    const networkMatrixIds = Array.from(new Set([
      ...networkMatrix.map(nm => nm.id),
      // cross-match with network_matrix by name
      ...(await (async () => {
        if (networkNames.length === 0) return [];
        const matches: string[] = networkNames.map(n => `network.ilike.%${n}%`);
        const { data: nms } = await supabase
          .from('network_matrix')
          .select('id')
          .or(matches.join(','));
        return nms?.map(n => n.id) || [];
      })())
    ]));

    const mainNetworkName = networkNames[0] || query.toUpperCase();
    const mainMatrizCode = matrizCodes[0] || (clientCodes[0] ? String(clientCodes[0]) : null);

    // 3. Consultas Complementares (Investimentos, Promotores, Faturamento)
    // A. Investimentos
    let acoes: any[] = [];
    const acoesOrs: string[] = [];
    if (networkNames.length > 0) {
      networkNames.forEach(n => acoesOrs.push(`rede.ilike.%${n}%`));
    }
    if (matrizCodes.length > 0) {
      matrizCodes.forEach(c => acoesOrs.push(`codigo_matriz.eq.${c}`));
    }
    if (acoesOrs.length > 0) {
      const { data: acs } = await supabase
        .from('cm_acoes_investimento')
        .select('*')
        .or(acoesOrs.join(','));
      if (acs) acoes = acs;
    }

    const acoesIds = acoes.map(a => a.id);

    // B. Última alteração via audit logs
    let lastChange: any = null;
    if (acoesIds.length > 0) {
      const { data: logs } = await supabase
        .from('cm_audit_logs')
        .select('*')
        .or('action.eq.INSERT,action.eq.UPDATE')
        .order('created_at', { ascending: false });
      
      if (logs) {
        lastChange = logs.find(log => {
          const newId = log.new_data?.id;
          const oldId = log.old_data?.id;
          return acoesIds.includes(newId) || acoesIds.includes(oldId);
        }) || null;
      }
    }

    // C. Promotores
    // PDVs
    let pdvs: any[] = [];
    const pdvOrs: string[] = [];
    if (networkMatrixIds.length > 0) {
      pdvOrs.push(`network_id.in.(${networkMatrixIds.join(',')})`);
    }
    if (networkNames.length > 0) {
      networkNames.forEach(n => pdvOrs.push(`name.ilike.%${n}%`));
    }
    if (pdvOrs.length > 0) {
      const { data: pList } = await supabase
        .from('pdvs')
        .select('*')
        .or(pdvOrs.join(','));
      if (pList) pdvs = pList;
    }

    // Metas
    let metas: any[] = [];
    if (networkMatrixIds.length > 0) {
      const { data: mList } = await supabase
        .from('cm_promotor_meta_network')
        .select('*')
        .in('network_id', networkMatrixIds);
      if (mList) metas = mList;
    }

    // Visitas e Checkins
    let visitas: any[] = [];
    if (clientCodes.length > 0) {
      const { data: vList } = await supabase
        .from('cm_promotor_visita')
        .select('*')
        .in('cod_parceiro', clientCodes.map(String));
      if (vList) visitas = vList;
    }

    // D. Faturamento (Assíncrono sob demanda)
    let faturamento: any[] = [];
    if (includeFaturamento && networkNames.length > 0) {
      const { data: fatList } = await supabase
        .from('mv_vendas_mensal')
        .select('*')
        .in('rede', networkNames);
      if (fatList) faturamento = fatList;
    }

    // 4. Montar Timeline Cronológica da Rede
    const timeline: Array<{ date: string; title: string; desc: string; type: string }> = [];

    // Criação do cadastro
    cmClientes.forEach(c => {
      if (c.created_at) {
        timeline.push({
          date: c.created_at,
          title: `Cadastro Mestre Criado (${c.codigo || 'Sem Código'})`,
          desc: `Registrado sob responsabilidade de "${c.responsavel || 'Sem Responsável'}" na fase "${c.fase || 'comercial'}".`,
          type: 'cadastro'
        });
      }
    });

    // Lançamentos e aprovações de investimentos
    acoes.forEach(a => {
      if (a.created_at) {
        timeline.push({
          date: a.created_at,
          title: `Ação Lançada (Cód. ${a.codigo})`,
          desc: `Investimento de ${a.abrangencia || 'Ação'} em "${a.familia_produto || 'SKU'}" alocado para o mês ${a.mes_referencia || '-'}.`,
          type: 'investimento_lançado'
        });
      }
      if (a.trade_validado_em) {
        timeline.push({
          date: a.trade_validado_em,
          title: `Validação Trade (Cód. ${a.codigo})`,
          desc: `Ação validada e aprovada pelo Trade (${a.trade_validado_por || 'Sistema'}).`,
          type: 'investimento_aprovado'
        });
      }
      if (a.trade_conferido_em) {
        timeline.push({
          date: a.trade_conferido_em,
          title: `Conferência Financeira (Cód. ${a.codigo})`,
          desc: `Ação auditada pelo Trade e encaminhada para faturamento físico.`,
          type: 'investimento_conferido'
        });
      }
      if (a.financeiro_pago_em) {
        timeline.push({
          date: a.financeiro_pago_em,
          title: `Pagamento Efetuado (Cód. ${a.codigo})`,
          desc: `Liquidação financeira registrada pelo usuário ${a.financeiro_pago_por || ''}.`,
          type: 'investimento_pago'
        });
      }
    });

    // Visitas
    visitas.forEach(v => {
      if (v.created_at) {
        timeline.push({
          date: v.created_at,
          title: `Visita Programada`,
          desc: `Rota de atendimento programada para o parceiro ${v.cod_parceiro}. Status: ${v.status || 'Pendente'}.`,
          type: 'visita_programada'
        });
      }
      if (v.checkin_servidor) {
        timeline.push({
          date: v.checkin_servidor,
          title: `Check-in Realizado`,
          desc: `Promotor efetuou check-in presencial no ponto de venda (Distância: ${v.distancia_checkin_metros || 0}m).`,
          type: 'checkin_realizado'
        });
      }
    });

    // Ordenar timeline cronologicamente
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 5. Cálculo dos Scores
    // A. Health Score (Saúde de Dados - Max 100%)
    let hsCadastro = 0;
    if (cmClientes.length > 0) {
      const active = cmClientes.some(c => c.status === 'ativo');
      const hasCnpj = cmClientes.some(c => c.cnpj && c.cnpj.trim().length > 0);
      if (active) hsCadastro += 10;
      if (hasCnpj) hsCadastro += 10;
    }
    if (baseAtendimento.length > 0) hsCadastro += 10;
    if (cmRedesMatrizes.length > 0) hsCadastro += 10;
    if (networkMatrix.length > 0) hsCadastro += 10;
    // Normalize to 20%
    const scoreCadastroMestre = Math.min(hsCadastro, 20);

    const scoreInvestimentos = acoes.length > 0 ? 20 : 0;
    const scoreFaturamento = (faturamento.length > 0 || (includeFaturamento === false && acoes.length > 0)) ? 20 : 0; 
    const scorePromotores = (metas.length > 0 || visitas.length > 0) ? 20 : 0;
    const scorePDVs = pdvs.length > 0 ? 20 : 0;

    const healthScore = scoreCadastroMestre + scoreInvestimentos + scoreFaturamento + scorePromotores + scorePDVs;

    // B. Score Operacional (Prontidão / Execução - Max 100%)
    let opDadosMestres = 0;
    if (cmClientes.length > 0) {
      const completedPhase = cmClientes.some(c => c.fase === 'concluido');
      const inFinance = cmClientes.some(c => c.fase === 'financeiro' || c.fase === 'operacoes');
      const hasCnpj = cmClientes.some(c => c.cnpj && c.cnpj.trim().length > 0);
      if (completedPhase) opDadosMestres += 10;
      else if (inFinance) opDadosMestres += 5;
      if (hasCnpj) opDadosMestres += 10;
    }

    let opInvestimentos = 0;
    if (acoes.length > 0) {
      const checklistsDone = acoes.filter(a => a.checklist_garantia && a.checklist_comunicacao && a.checklist_logistica).length;
      opInvestimentos += Math.round((checklistsDone / acoes.length) * 10);
      const docsUploaded = acoes.filter(a => a.documento_url).length;
      opInvestimentos += Math.round((docsUploaded / acoes.length) * 10);
    }

    let opTrade = 0;
    if (acoes.length > 0) {
      const validated = acoes.filter(a => a.trade_validado_em || a.fase_atual >= 3).length;
      opTrade += Math.round((validated / acoes.length) * 20);
    }

    let opPromotores = 0;
    if (visitas.length > 0) {
      const realized = visitas.filter(v => v.checkin_servidor || v.status === 'Realizada').length;
      opPromotores += Math.round((realized / visitas.length) * 20);
    }

    let opFaturamento = 0;
    if (acoes.length > 0) {
      const hasRealizedSales = acoes.some(a => a.apuracao_valor_realizado && a.apuracao_valor_realizado > 0);
      if (hasRealizedSales) opFaturamento += 20;
      else if (faturamento.length > 0) opFaturamento += 15;
    }

    const scoreOperacional = Math.min(opDadosMestres, 20) + Math.min(opInvestimentos, 20) + Math.min(opTrade, 20) + Math.min(opPromotores, 20) + Math.min(opFaturamento, 20);

    // 6. Diagnóstico e Severidade
    let severity = '🟢 Informativo';
    let diagnosis = 'A rede não desapareceu.';
    let recommendations = 'A rede está ativa e totalmente visível sob os filtros atuais.';

    const clientActive = cmClientes.some(c => c.status === 'ativo');
    const clientIncomplete = cmClientes.some(c => c.fase === 'comercial' && !c.cnpj);

    if (cmClientes.length === 0) {
      severity = '🔴 Crítico';
      diagnosis = 'Inconsistência cadastral (Cadastro inexistente).';
      recommendations = 'A rede não possui registro ativo na tabela principal de Clientes. Crie o cadastro mestre na tela de Configuração Financeira.';
    } else if (clientIncomplete) {
      severity = '🟠 Alerta';
      diagnosis = 'Cadastro incompleto.';
      recommendations = 'A rede está travada na fase Comercial por ausência de CNPJ. Insira o CNPJ correspondente e conclua a fase comercial para liberar o fluxo.';
    } else if (acoes.length === 0) {
      severity = '🟡 Atenção';
      diagnosis = 'A rede não possui investimentos cadastrados.';
      recommendations = 'Nenhuma ação de investimento foi lançada para esta rede até o momento. Utilize o formulário de Lançamento para criar novas ações.';
    } else if (pdvs.length === 0) {
      severity = '🟡 Atenção';
      diagnosis = 'A rede não possui PDVs cadastrados.';
      recommendations = 'Nenhuma loja física desta rede está cadastrada no sistema. Importe as filiais via planilha ou pelo cadastro individual de PDVs.';
    }

    // Retorna os dados organizados
    return NextResponse.json({
      success: true,
      data: {
        rede: mainNetworkName,
        codigo: mainMatrizCode,
        cadastro: {
          cm_clientes: cmClientes,
          base_atendimento: baseAtendimento,
          cm_redes_matrizes: cmRedesMatrizes,
          network_matrix: networkMatrix,
          status: clientActive ? 'Ativo' : 'Inativo',
          fase: cmClientes[0]?.fase || 'Não Iniciado',
          cnpj: cmClientes[0]?.cnpj || null
        },
        investimentos: {
          totalAcoes: acoes.length,
          acoesList: acoes,
          lastChange: lastChange ? {
            user: lastChange.new_data?.trade_validado_por || lastChange.new_data?.approved_by || lastChange.new_data?.reopened_by || 'Administrador',
            date: lastChange.created_at,
            action: lastChange.action
          } : null
        },
        promotores: {
          totalPdvs: pdvs.length,
          totalMetas: metas.length,
          totalVisitas: visitas.length,
          totalCheckins: visitas.filter(v => v.checkin_servidor).length
        },
        faturamento: {
          vendas: faturamento,
          hasSales: faturamento.length > 0 || (includeFaturamento === false && acoes.length > 0)
        },
        timeline,
        scores: {
          healthScore,
          scoreOperacional,
          categories: {
            cadastro: scoreCadastroMestre,
            investimentos: scoreInvestimentos,
            faturamento: scoreFaturamento,
            promotores: scorePromotores,
            pdvs: scorePDVs
          },
          opCategories: {
            dadosMestres: Math.min(opDadosMestres, 20),
            investimentos: Math.min(opInvestimentos, 20),
            trade: Math.min(opTrade, 20),
            promotores: Math.min(opPromotores, 20),
            faturamento: Math.min(opFaturamento, 20)
          }
        },
        severity,
        diagnosis,
        recommendations
      }
    });

  } catch (error: any) {
    console.error('[AUDIT API GET]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
