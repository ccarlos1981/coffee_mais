import { NextResponse } from "next/server";
import { OFFICIAL_ANALYTICS_SOURCES, resolveSupabaseTableName } from "@/lib/governance/analytics";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(supabaseUrl, supabaseKey);
}

export async function GET(request: Request) {
  try {
    const supabaseServer = await createClient();
    const { data: { user: authUser }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ success: false, error: 'Não autenticado.' }, { status: 401 });
    }

    // Buscar Perfil do Usuário para controle de RLS e Roles
    const { data: profile } = await supabaseServer
      .from('cm_user_profiles')
      .select('role, email')
      .eq('id', authUser.id)
      .single();

    const userRole = profile?.role || 'Comercial';
    const userEmail = profile?.email || authUser.email || '';
    const emailPrefix = userEmail.split('@')[0].split('.')[0].toUpperCase(); // 'LEANDRO'

    // Definir permissões de perfis
    const isManagerOrComercial = !['CEO', 'Admin', 'Trade', 'Financeiro', 'Supervisor'].includes(userRole);

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
      const { data: c } = await supabase.from('cm_clientes').select('*').eq('id', query);
      if (c) cmClientes = c;
    } else if (isNumeric) {
      const numVal = parseInt(query, 10);
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

      const { data: nm } = await supabase
        .from('network_matrix')
        .select('*')
        .eq('id', numVal);
      if (nm) networkMatrix = nm;
    }

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
          diagnosis: 'A rede não foi encontrada no cadastro mestre.',
          recommendations: 'Verifique se o nome, código ou ID digitado está correto. Caso o cliente seja novo, cadastre-o no portal de configuração de clientes.'
        }
      });
    }

    // CONTROLE DE ACESSO (RLS COMERCIAL / GERENTE):
    // Se o usuário for Gerente ou Comercial, ele só pode auditar redes sob sua gerência direta.
    if (isManagerOrComercial) {
      const isOwner = cmClientes.some(c => {
        const resp = (c.responsavel || '').toUpperCase();
        return resp.includes(emailPrefix) || resp.includes(userEmail.toUpperCase());
      }) || baseAtendimento.some(b => {
        const resp = (b.responsavel || '').toUpperCase();
        return resp.includes(emailPrefix) || resp.includes(userEmail.toUpperCase());
      });

      if (!isOwner && cmClientes.length > 0) {
        try {
          await supabase.from("cm_audit_logs").insert({
            user_id: authUser.id,
            action: 'AUDIT_NETWORK_RESTRICTED',
            table_name: 'cm_clientes',
            new_data: { query }
          });
        } catch (logErr) {
          console.error('[Telemetry Audit Restricted]', logErr);
        }

        return NextResponse.json({
          success: true,
          data: {
            restricted: true,
            severity: '🔴 Crítico',
            diagnosis: 'Acesso restrito: rede sob responsabilidade de outro gerente.',
            recommendations: 'Você não possui permissão de segurança para visualizar dados comerciais ou auditar redes de outros gerentes.'
          }
        });
      }
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
        .from('v_acoes_investimento_com_gerente')
        .select('*')
        .or(acoesOrs.join(','));
      if (acs) acoes = acs;
    }

    // SEGURANÇA: Filtrar investimentos apenas do gerente comercial logado
    if (isManagerOrComercial) {
      acoes = acoes.filter(a => {
        const mgr = (a.gerente_responsavel || '').toUpperCase();
        return mgr.includes(emailPrefix) || mgr.includes(userEmail.toUpperCase());
      });
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

    // Visitas
    let visitas: any[] = [];
    if (clientCodes.length > 0) {
      const { data: vList } = await supabase
        .from('cm_promotor_visita')
        .select('*')
        .in('cod_parceiro', clientCodes.map(String));
      if (vList) visitas = vList;
    }

    // D. Faturamento (Assíncrono sob demanda + Bloqueio para Regional Manager)
    let faturamento: any[] = [];
    if (includeFaturamento && !isManagerOrComercial && networkNames.length > 0) {
      const { data: fatList } = await supabase
        .from(resolveSupabaseTableName(OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL))
        .select('*')
        .in('rede', networkNames);
      if (fatList) faturamento = fatList;
    }

    // 4. Montar Timeline Cronológica (Filtrada se Manager)
    const timeline: Array<{ date: string; title: string; desc: string; type: string }> = [];

    // Cadastro Mestre (somente para trade/admin ou se for dono)
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

    // Lançamentos
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
    });

    // Visitas (somente se não comercial para evitar vazamento operacional profundo de rotas)
    if (!isManagerOrComercial) {
      visitas.forEach(v => {
        if (v.checkin_servidor) {
          timeline.push({
            date: v.checkin_servidor,
            title: `Check-in Realizado`,
            desc: `Promotor efetuou check-in presencial no ponto de venda (Distância: ${v.distancia_checkin_metros || 0}m).`,
            type: 'checkin_realizado'
          });
        }
      });
    }

    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 5. Cálculo dos Scores
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
    const scoreCadastroMestre = Math.min(hsCadastro, 20);

    const scoreInvestimentos = acoes.length > 0 ? 20 : 0;
    const scoreFaturamento = (faturamento.length > 0 || (includeFaturamento === false && acoes.length > 0)) ? 20 : 0; 
    const scorePromotores = (metas.length > 0 || visitas.length > 0) ? 20 : 0;
    const scorePDVs = pdvs.length > 0 ? 20 : 0;

    const healthScore = scoreCadastroMestre + scoreInvestimentos + scoreFaturamento + scorePromotores + scorePDVs;

    // Operational Score
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

    // Diagnóstico
    let severity = '🟢 Informativo';
    let diagnosis = 'A rede está visível e operacional.';
    let recommendations = 'A rede está ativa e visível sob os filtros atuais.';

    const clientActive = cmClientes.some(c => c.status === 'ativo');
    const clientIncomplete = cmClientes.some(c => c.fase === 'comercial' && !c.cnpj);

    if (cmClientes.length === 0) {
      severity = '🔴 Crítico';
      diagnosis = 'A rede não foi encontrada no cadastro mestre.';
      recommendations = 'A rede não possui cadastro ativo. Crie o cadastro mestre na tela de Configuração Financeira.';
    } else if (clientIncomplete) {
      severity = '🟠 Alerta';
      diagnosis = 'A rede possui inconsistências cadastrais.';
      recommendations = 'Falta CNPJ no cadastro mestre Comercial. Insira o CNPJ para liberar.';
    } else if (acoes.length === 0) {
      severity = '🟠 Alerta';
      diagnosis = 'A rede existe, porém ainda não possui investimentos cadastrados.';
      recommendations = 'Nenhuma ação de investimento foi criada.';
    }


    try {
      await supabase.from("cm_audit_logs").insert({
        user_id: authUser.id,
        action: 'AUDIT_NETWORK',
        table_name: 'cm_clientes',
        new_data: { query, diagnosis, severity }
      });
    } catch (logErr) {
      console.error('[Telemetry Audit]', logErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        rede: mainNetworkName,
        codigo: mainMatrizCode,
        isManagerOrComercial,
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
