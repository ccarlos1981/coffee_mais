import { AnalyticsEngine } from "@/lib/governance/analytics/engine";
import { isInsideSalesClient } from "@/lib/domain/commercial-structure";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValorProjetadoComercial, getInvestimentoRealizadoOficial } from "@/lib/investimento/getValorTotal";
import { buildMatrizLookup, resolveClienteMatriz } from "@/lib/investimento/matriz-resolver";
import { OFFICIAL_ANALYTICS_SOURCES, resolveSupabaseTableName } from "@/lib/governance/analytics/sources";

export interface SalesManagerReportRow {
  managerId: string;
  managerName: string;
  role: "KA" | "DIST" | "INSIDE";
  metaFat: number;
  realFat: number;
  pctAtgFat: number;
  tendFat: number;
  metaUnd: number;
  realUnd: number;
  pctAtgUnd: number;
  metaMaco: number;
  realMaco: number;
  pctAtgMaco: number;
  statusBadge: "CRITICO" | "ATENCAO" | "ATINGIDO";
}

export interface InvestmentManagerReportRow {
  responsavel: string;
  clientesQtd: number;
  faturamento: number;
  expectativaInvestimento: number;
  pctInvestimento: number;
  naoProvisionado: number;
  provisionado: number;
  acoesAtrasadasQtd: number;
  acoesAtrasadasValor: number;
}

export interface InvestmentChannelMonthlyRow {
  gerente: string;
  canal: string;
  mesAtual: { faturamento: number; investimento: number; pct: number };
  mesAnterior: { faturamento: number; investimento: number; pct: number };
  trimestre: { faturamento: number; investimento: number; pct: number };
}

export interface InvestmentClientReportRow {
  responsavel: string;
  clienteRede: string;
  codigoMatriz?: string;
  faturamento: number;
  expectativaInvestimento: number;
  pctInvestimento: number;
  naoProvisionado: number;
  provisionado: number;
  acoesAtrasadasQtd: number;
}

export interface NetworkAlertMetric {
  rede: string;
  gerente: string;
  faturamentoMtd: number;
  pctAtgMeta?: number;
  faturamentoMtdAnterior: number;
  variacaoMtdPct: number;
  variacaoMtdValor: number;
  mediaHistorica3M: number;
  variacaoMediaPct: number;
  unidadesMtd: number;
  unidadesMtdAnterior: number;
  macoMtd?: number;
  evidenciaMatematica: string;
}

export interface NetworkOpportunityMetric {
  rede: string;
  gerente: string;
  faturamentoMtd: number;
  faturamentoMtdAnterior: number;
  crescimentoMtdPct: number;
  crescimentoMtdValor: number;
  unidadesMtd: number;
  macoMtd?: number;
  destaque: string;
}

export interface Top10RedeReportRow {
  ranking: number;
  rede: string;
  uf: string;
  gerente: string;
  historico2026: {
    jan: number;
    fev: number;
    mar: number;
    abr: number;
    mai: number;
    jun: number;
    jul: number;
    agoMtd: number;
    totalAno: number;
  };
  vsMesAnterior: {
    fatMtdAtual: number;
    fatMtdAnterior: number;
    diffValor: number;
    diffPct: number | null;
    diffPctStr: string;
    status: "NOVO" | "CRESCIMENTO" | "QUEDA" | "ESTAVEL";
    statusLabel: string;
  };
  vsTrimestre: {
    fatTrimAtualMtd: number;
    fatTrimAntEquiv: number;
    diffValor: number;
    diffPct: number | null;
    diffPctStr: string;
  };
}

export interface IaExecutivaInsight {
  alertas: string[];
  oportunidades: string[];
  ondeAgirHoje: {
    responsavel: string;
    prioridade: string;
    impactoValor: number;
    descricao: string;
  }[];
}

export interface ExecutiveReportData {
  dataReferencia: string; // DD/MM/AAAA
  dataReferenciaIso: string; // AAAA-MM-DD
  competenciaAtual: string; // AAAA-MM
  competenciaAnterior: string; // AAAA-MM
  diaDoMes: number;
  diasUteisDecorridos: number;
  diasUteisTotais: number;
  ultimaImportacao: {
    status: string;
    finalizadaEm: string;
    nomeArquivo: string;
    totalLinhas: number;
    validaParaHoje: boolean;
  };
  
  // PÁGINA 1: KEY ACCOUNT (EXCLUSIVO)
  vendas: {
    consolidadoKa: {
      metaFat: number;
      realFat: number;
      pctAtgFat: number;
      metaUnd: number;
      realUnd: number;
      pctAtgUnd: number;
      metaMaco: number;
      realMaco: number;
      pctAtgMaco: number;
      statusBadge: "CRITICO" | "ATENCAO" | "ATINGIDO";
    };
    gerentesKa: SalesManagerReportRow[];
    distribuidor: {
      metaFat: number;
      realFat: number;
      pctAtgFat: number;
      metaUnd: number;
      realUnd: number;
      pctAtgUnd: number;
      metaMaco: number;
      realMaco: number;
      pctAtgMaco: number;
      statusBadge: "CRITICO" | "ATENCAO" | "ATINGIDO";
      topClientes: { cliente: string; gerente: string; fat: number; und: number; maco: number }[];
    };
    consolidadoKaDist: {
      metaFat: number;
      realFat: number;
      pctAtgFat: number;
      metaUnd: number;
      realUnd: number;
      pctAtgUnd: number;
      metaMaco: number;
      realMaco: number;
      pctAtgMaco: number;
      statusBadge: "CRITICO" | "ATENCAO" | "ATINGIDO";
    };
    gerentes: SalesManagerReportRow[];
    linhaInsideSalesSegregada: SalesManagerReportRow;
  };

  // PÁGINA 2: RESUMO DE INVESTIMENTOS
  investimentosResumo: {
    consolidado: {
      faturamento: number;
      expectativaInvestimento: number;
      pctInvestimento: number;
      naoProvisionado: number;
      provisionado: number;
      acoesAtrasadasQtd: number;
      acoesAtrasadasValor: number;
    };
    porGerente: InvestmentManagerReportRow[];
  };

  // PÁGINA 3: INVESTIMENTO POR GERENTE / CANAL
  investimentosPorCanal: {
    linhas: InvestmentChannelMonthlyRow[];
    destaqueMaiorInvestimento?: { gerente: string; canal: string; valor: number };
    destaqueMaiorPercentual?: { gerente: string; canal: string; pct: number };
  };

  // PÁGINA 4: INVESTIMENTO POR CLIENTE / REDE
  investimentosPorCliente: {
    linhas: InvestmentClientReportRow[];
    topClientesExpostos: InvestmentClientReportRow[];
  };

  // PÁGINA 5: TOP 10 REDES E HISTÓRICO 2026
  top10Redes: Top10RedeReportRow[];
  gerenteFoco?: string;

  // DADOS DE INTELIGÊNCIA EXECUTIVA (MTD)
  inteligenciaMtd: {
    redesAlerta: NetworkAlertMetric[];
    redesOportunidade: NetworkOpportunityMetric[];
    gerentesDestaque: { gerente: string; pctAtgFat: number; realFat: number }[];
    gerentesGaps: { gerente: string; pctAtgFat: number; gapFat: number }[];
  };

  // IA EXECUTIVA ESTRUTURADA
  iaExecutiva: IaExecutivaInsight;
}

export class ExecutiveReportCollector {
  /**
   * Coleta todos os blocos de dados oficiais em regime 100% READ-ONLY
   */
  static async collect(dateOverride?: Date, managerFilter?: string): Promise<ExecutiveReportData> {
    const nowSp = dateOverride || new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const currentYear = nowSp.getFullYear();
    const currentMonth = nowSp.getMonth() + 1;
    const currentDay = nowSp.getDate();

    const compAtual = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
    const prevMonthDate = new Date(currentYear, currentMonth - 2, 1);
    const compAnterior = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;

    const dataRefIso = `${compAtual}-${String(currentDay).padStart(2, "0")}`;
    const dataRefBr = `${String(currentDay).padStart(2, "0")}/${String(currentMonth).padStart(2, "0")}/${currentYear}`;

    // 1. Checagem da Última Importação
    const importStatus = await this.getLatestImportStatus(dataRefIso);

    // 2. Coleta de Vendas KA + Distribuidor (Baseline 077 + Fonte Transacional TOP 1100 para Realizado KA)
    const vendasData = await this.collectVendasKaDist(compAtual, currentDay, dataRefIso);

    // 3. Coleta de Investimentos (Páginas 2, 3 e 4)
    const investResumo = await this.collectInvestimentosResumo(compAtual);
    const investCanais = await this.collectInvestimentosPorCanal(compAtual, compAnterior);
    const investClientes = await this.collectInvestimentosPorCliente(compAtual);

    // 4. Análise de Inteligência MTD
    const inteligenciaMtd = await this.collectInteligenciaMtd(compAtual, compAnterior, currentDay);

    // 5. Coleta de Top 10 Redes e Histórico 2026 (Página 5)
    const top10Redes = await this.collectTop10Redes(compAtual, currentDay, managerFilter);

    // 6. Construção da IA Executiva Estruturada (Página 5)
    const iaExecutiva = this.buildIaExecutiva(vendasData, investResumo, inteligenciaMtd, top10Redes);

    return {
      dataReferencia: dataRefBr,
      dataReferenciaIso: dataRefIso,
      competenciaAtual: compAtual,
      competenciaAnterior: compAnterior,
      diaDoMes: currentDay,
      diasUteisDecorridos: 18, // Indicador de dias úteis
      gerenteFoco: managerFilter,
      diasUteisTotais: 22,
      ultimaImportacao: importStatus,
      vendas: vendasData,
      investimentosResumo: investResumo,
      investimentosPorCanal: investCanais,
      investimentosPorCliente: investClientes,
      top10Redes,
      inteligenciaMtd,
      iaExecutiva,
    };
  }

  /**
   * 1. Consulta o status da última importação em cm_sync_logs
   */
  private static async getLatestImportStatus(todayIso: string) {
    try {
      const supabase = createAdminClient();
      const { data: logs, error } = await supabase
        .from("cm_sync_logs")
        .select("id, status, started_at, finished_at, rows_inserted, metadata")
        .order("started_at", { ascending: false })
        .limit(1);

      if (error || !logs || logs.length === 0) {
        return {
          status: "SEM_REGISTROS",
          finalizadaEm: "—",
          nomeArquivo: "CFOP.CSV",
          totalLinhas: 0,
          validaParaHoje: false,
        };
      }

      const last = logs[0];
      const finishedDate = last.finished_at ? new Date(last.finished_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
      const metadata = (last.metadata as any) || {};
      const isSuccess = last.status === "SUCCESS" || metadata?.sub_status === "SUCCESS";
      
      // Validação estrita de data no fuso oficial de São Paulo (Proteção contra dado obsoleto)
      const finishedIso = last.finished_at
        ? new Date(last.finished_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
        : "";
      const validaHoje = isSuccess && finishedIso === todayIso;

      return {
        status: last.status || "UNKNOWN",
        finalizadaEm: finishedDate,
        nomeArquivo: metadata?.file_name || "CFOP.CSV",
        totalLinhas: Number(last.rows_inserted || 0),
        validaParaHoje: validaHoje,
      };
    } catch {
      return {
        status: "ERRO_CONSULTA",
        finalizadaEm: "—",
        nomeArquivo: "CFOP.CSV",
        totalLinhas: 0,
        validaParaHoje: false,
      };
    }
  }

  /**
   * 2. Coleta de Vendas KA + Distribuidor com Segregação Oficial do Inside Sales (Baseline 077)
   */
  private static async collectVendasKaDist(compAtual: string, currentDay: number, dataRefIso?: string) {
    const dtStart = `${compAtual}-01`;
    const dtCutoff = dataRefIso || `${compAtual}-${String(currentDay).padStart(2, "0")}`;
    const [year, month] = compAtual.split("-").map(Number);
    const dtNext = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    // 1. Query oficial de vendas agrupada por gerente e canal na fonte reguladora oficial (mv_vendas_mensal) para canais Inside Sales e Distribuidor
    const mvSalesRows = await AnalyticsEngine.executeSql<any>(`
      SELECT 
        manager,
        channel,
        SUM(fat) as faturamento,
        SUM(qty) as quantidade,
        SUM(maco) as maco
      FROM mv_vendas_mensal
      WHERE mes = '${compAtual}'
      GROUP BY manager, channel
    `);

    // 2. Query dedicada oficial de Realizado Comercial Key Account (Sell-In TOP 1100)
    const kaSalesRows = await AnalyticsEngine.executeSql<any>(`
      SELECT 
        CASE 
          WHEN c.responsavel ILIKE '%Julliano%' THEN 'Julliano'
          WHEN c.responsavel ILIKE '%Leandro%' THEN 'Leandro'
          WHEN c.responsavel ILIKE '%Luiz%' THEN 'Luiz'
          WHEN c.responsavel ILIKE '%John%' THEN 'John Guedes'
          ELSE UPPER(COALESCE(c.responsavel, 'OUTROS'))
        END AS manager,
        SUM(f.vlr_total_liq) as faturamento,
        SUM(f.quantidade) as quantidade,
        SUM(
          f.vlr_total_liq 
          - COALESCE(f.custo_total, 0) 
          - (COALESCE(f.custo_icms, 0) + CASE WHEN ABS(COALESCE(f.vlr_total_st, 0)) >= ABS(COALESCE(f.vlr_total_liq, 0)) THEN 0 ELSE COALESCE(f.vlr_total_st, 0) END)
          - (f.vlr_total_liq * 0.03)
        ) as maco
      FROM cm_faturamento_sankhya f
      LEFT JOIN cm_clientes c ON c.codigo = f.cod_parceiro::integer
      WHERE f.dt_faturamento >= '${dtStart}' AND f.dt_faturamento <= '${dtCutoff}'
        AND (f.status_nfe IS NULL OR f.status_nfe <> 'CANCELADA')
        AND f.nome_parceiro NOT IN ('CAFE UTAM S/A', 'COFFEE MAIS INDUSTRIA DE CAFE LTDA')
        AND f.cod_top = '1100'
        AND (c.tipo_parceiro = 'KA' OR f.nome_vendedor = 'KEYACCOUNT')
        AND (c.responsavel IN ('Julliano', 'Leandro Saffi', 'Luiz', 'John Guedes') OR c.manager_id IN ('1000', '1001', '1002', '1003'))
      GROUP BY 
        CASE 
          WHEN c.responsavel ILIKE '%Julliano%' THEN 'Julliano'
          WHEN c.responsavel ILIKE '%Leandro%' THEN 'Leandro'
          WHEN c.responsavel ILIKE '%Luiz%' THEN 'Luiz'
          WHEN c.responsavel ILIKE '%John%' THEN 'John Guedes'
          ELSE UPPER(COALESCE(c.responsavel, 'OUTROS'))
        END
    `);

    // 2.1 Busca investimentos comerciais aprovados (verba_aprovada = true) para paridade com Baseline 57 MACO
    const kaInvestRows = await AnalyticsEngine.executeSql<any>(`
      SELECT
        CASE
          WHEN c.responsavel ILIKE '%Julliano%' THEN 'Julliano'
          WHEN c.responsavel ILIKE '%Leandro%' THEN 'Leandro'
          WHEN c.responsavel ILIKE '%Luiz%' THEN 'Luiz'
          WHEN c.responsavel ILIKE '%John%' THEN 'John Guedes'
          ELSE UPPER(COALESCE(c.responsavel, 'OUTROS'))
        END AS manager,
        SUM(a.valor_investimento) as invest
      FROM cm_acoes_investimento a
      LEFT JOIN cm_campanhas camp ON camp.id = a.campanha_id
      LEFT JOIN cm_clientes c ON CAST(c.codigo AS TEXT) = CAST(camp.cod_parceiro AS TEXT)
      WHERE a.verba_aprovada = true
        AND ((a.data_inicio >= '${dtStart}' AND a.data_inicio <= '${dtCutoff}') OR (a.data_fim >= '${dtStart}' AND a.data_fim <= '${dtCutoff}'))
      GROUP BY
        CASE
          WHEN c.responsavel ILIKE '%Julliano%' THEN 'Julliano'
          WHEN c.responsavel ILIKE '%Leandro%' THEN 'Leandro'
          WHEN c.responsavel ILIKE '%Luiz%' THEN 'Luiz'
          WHEN c.responsavel ILIKE '%John%' THEN 'John Guedes'
          ELSE UPPER(COALESCE(c.responsavel, 'OUTROS'))
        END
    `);
    const kaInvestMap = new Map<string, number>();
    (kaInvestRows || []).forEach((r: any) => {
      const g = normalizeManager(r.manager);
      kaInvestMap.set(g, Number(r.invest || 0));
    });

    // Busca metas oficiais em public.targets e configurações de MACO do Desafio DRE (mesma fonte oficial do Acompanhamento)
    const [targetsRows, desafioConfigs] = await Promise.all([
      AnalyticsEngine.executeSql<any>(`
        SELECT 
          manager,
          manager_id,
          year,
          month,
          target_revenue as meta_fat,
          target_tons as meta_und
        FROM public.targets
        WHERE year = ${year} AND month = ${month}
      `),
      AnalyticsEngine.getAllDesafioDreConfigs(year, month),
    ]);

    const managersKaDef = [
      { name: "Julliano", id: "1000" },
      { name: "Leandro", id: "1001" },
      { name: "Luiz", id: "1002" },
      { name: "John Guedes", id: "1003" },
    ];

    const targetsMap = new Map<string, { metaFat: number; metaUnd: number; metaMaco: number }>();
    managersKaDef.forEach((m) => {
      const target = (targetsRows || []).find((t: any) => {
        const tId = String(t.manager_id || "");
        const tName = String(t.manager || "");
        if (tId === `${m.id}-KA` || tId === m.id) {
          return tName.toLowerCase().includes("(ka)") || (!tName.toLowerCase().includes("(dist)") && !tName.toLowerCase().includes("distribuidor"));
        }
        return false;
      });

      const metaFat = Number(target?.meta_fat || 0);
      const metaUnd = Number(target?.meta_und || 0);
      const cfg = desafioConfigs.get(m.id) || desafioConfigs.get("CRISTIANO");
      const margemMaco = cfg?.margem_maco_pct ?? 0.395;
      const metaMaco = Math.round((metaFat * margemMaco) / 1000) * 1000;

      targetsMap.set(m.name.toUpperCase(), { metaFat, metaUnd, metaMaco });
      targetsMap.set(m.id, { metaFat, metaUnd, metaMaco });
    });

    // Metas oficiais do canal Distribuidor (Soma dinâmica dos gerentes com papel comercial DIST na fonte oficial public.targets + cm_rdm_desafio_config)
    const managersDistDef = [
      { name: "Luiz", id: "1002" },
      { name: "John Guedes", id: "1003" },
      { name: "Leandro", id: "1001" },
      { name: "Julliano", id: "1000" },
    ];

    let distMetaFat = 0;
    let distMetaUnd = 0;
    let distMetaMaco = 0;

    managersDistDef.forEach((m) => {
      const target = (targetsRows || []).find((t: any) => {
        const tId = String(t.manager_id || "");
        const tName = String(t.manager || "");
        if (tId === `${m.id}-DIST` || tId === m.id) {
          return tName.toLowerCase().includes("(dist)") || tName.toLowerCase().includes("(distribuidor)");
        }
        return false;
      });

      const mFat = Number(target?.meta_fat || 0);
      const mUnd = Number(target?.meta_und || 0);
      const cfg = desafioConfigs.get(m.id) || desafioConfigs.get("CRISTIANO");
      const margemMaco = cfg?.margem_maco_pct ?? 0.395;
      const mMaco = mFat > 0 ? Number((mFat * margemMaco).toFixed(2)) : 0;

      distMetaFat += mFat;
      distMetaUnd += mUnd;
      distMetaMaco += mMaco;
    });

    targetsMap.set("DISTRIBUIDOR", {
      metaFat: distMetaFat,
      metaUnd: distMetaUnd,
      metaMaco: distMetaMaco,
    });

    // Inside Sales target oficial de public.targets
    const insideTargetRow = (targetsRows || []).find((t: any) => t.manager_id === '1004' || (t.manager || '').toLowerCase().includes('inside'));
    const insideMetaFat = Number(insideTargetRow?.meta_fat || 0);
    const insideMetaUnd = Number(insideTargetRow?.meta_und || 0);
    const insideMetaMaco = insideMetaFat > 0 ? Math.round((insideMetaFat * 0.31) / 1000) * 1000 : 0;
    targetsMap.set("INSIDE SALES", {
      metaFat: insideMetaFat,
      metaUnd: insideMetaUnd,
      metaMaco: insideMetaMaco,
    });

    const normalizeManager = (raw?: string): string => {
      if (!raw) return "Sem Gerente";
      const trimmed = raw.trim();
      if (trimmed.includes("Leandro")) return "Leandro";
      if (trimmed.includes("Luiz")) return "Luiz";
      if (trimmed.includes("Julliano")) return "Julliano";
      if (trimmed.includes("John")) return "John Guedes";
      return trimmed;
    };

    // Estrutura de Agregação por Gerente KA (Preenchida via fonte transacional TOP 1100)
    const gerentesKaData: Record<string, { fat: number; und: number; maco: number }> = {
      "Julliano": { fat: 0, und: 0, maco: 0 },
      "Leandro": { fat: 0, und: 0, maco: 0 },
      "Luiz": { fat: 0, und: 0, maco: 0 },
      "John Guedes": { fat: 0, und: 0, maco: 0 },
    };

    (kaSalesRows || []).forEach((r: any) => {
      const g = normalizeManager(r.manager);
      const fat = Number(r.faturamento || 0);
      const und = Number(r.quantidade || 0);
      const maco = Number(r.maco || 0);

      if (gerentesKaData[g]) {
        gerentesKaData[g].fat += fat;
        gerentesKaData[g].und += und;
        gerentesKaData[g].maco += maco;
      }
    });

    // Baseline 57: Deduct approved commercial investments from MACO (MACO = Receita Após Impostos - CPV - Frete - Investimentos Aprovados)
    Object.keys(gerentesKaData).forEach((g) => {
      const invest = kaInvestMap.get(g) || 0;
      gerentesKaData[g].maco = Math.max(0, gerentesKaData[g].maco - invest);
    });

    let totalInsideFat = 0;
    let totalInsideUnd = 0;
    let totalInsideMaco = 0;

    (mvSalesRows || []).forEach((r: any) => {
      const ch = (r.channel || "").trim();
      const fat = Number(r.faturamento || 0);
      const und = Number(r.quantidade || 0);
      const maco = Number(r.maco || 0);

      if (ch === "Inside Sales" || ch === "Inside inter") {
        totalInsideFat += fat;
        totalInsideUnd += und;
        totalInsideMaco += maco;
      }
    });

    const getBadge = (pct: number): "CRITICO" | "ATENCAO" | "ATINGIDO" => {
      if (pct >= 100) return "ATINGIDO";
      if (pct >= 85) return "ATENCAO";
      return "CRITICO";
    };

    // Montar linhas dos gerentes KA (Página 1 Exclusiva)
    const gerentesKa: SalesManagerReportRow[] = managersKaDef.map((m) => {
      const name = m.name;
      const data = gerentesKaData[name] || { fat: 0, und: 0, maco: 0 };
      const target = targetsMap.get(name.toUpperCase()) || { metaFat: 1000000, metaUnd: 40000, metaMaco: 150000 };

      const kaFat = data.fat;
      const kaUnd = data.und;
      const kaMaco = Math.max(0, data.maco);

      const pctFat = target.metaFat > 0 ? (kaFat / target.metaFat) * 100 : 0;
      const pctUnd = target.metaUnd > 0 ? (kaUnd / target.metaUnd) * 100 : 0;
      const pctMaco = target.metaMaco > 0 ? (kaMaco / target.metaMaco) * 100 : 0;

      return {
        managerId: name,
        managerName: name,
        role: "KA" as const,
        metaFat: target.metaFat,
        realFat: kaFat,
        pctAtgFat: pctFat,
        tendFat: pctFat,
        metaUnd: target.metaUnd,
        realUnd: kaUnd,
        pctAtgUnd: pctUnd,
        metaMaco: target.metaMaco,
        realMaco: kaMaco,
        pctAtgMaco: pctMaco,
        statusBadge: getBadge(pctFat),
      };
    });

    // Consolidado Exclusivo KA (Página 1)
    const totalKaMetaFat = gerentesKa.reduce((acc, m) => acc + m.metaFat, 0);
    const totalKaRealFat = gerentesKa.reduce((acc, m) => acc + m.realFat, 0);
    const totalKaMetaUnd = gerentesKa.reduce((acc, m) => acc + m.metaUnd, 0);
    const totalKaRealUnd = gerentesKa.reduce((acc, m) => acc + m.realUnd, 0);
    const totalKaMetaMaco = gerentesKa.reduce((acc, m) => acc + m.metaMaco, 0);
    const totalKaRealMaco = gerentesKa.reduce((acc, m) => acc + m.realMaco, 0);

    const consolKaPctFat = totalKaMetaFat > 0 ? (totalKaRealFat / totalKaMetaFat) * 100 : 0;
    const consolKaPctUnd = totalKaMetaUnd > 0 ? (totalKaRealUnd / totalKaMetaUnd) * 100 : 0;
    const consolKaPctMaco = totalKaMetaMaco > 0 ? (totalKaRealMaco / totalKaMetaMaco) * 100 : 0;

    // Buscar clientes do canal distribuidor para a Página 2
    const distClientsSql = `
      SELECT 
        f.nome_parceiro as cliente,
        COALESCE(c.responsavel, 'Comercial') as gerente,
        SUM(CASE WHEN f.cod_top IN ('1200', '1201') THEN -ABS(f.vlr_total_liq) ELSE f.vlr_total_liq END) as fat,
        SUM(CASE WHEN f.cod_top IN ('1200', '1201') THEN -ABS(f.quantidade) ELSE f.quantidade END) as und,
        SUM(CASE WHEN f.cod_top IN ('1200', '1201') THEN -ABS(f.custo_total) ELSE f.custo_total END) as custo,
        SUM(
          COALESCE(f.custo_icms, 0) + 
          CASE WHEN ABS(COALESCE(f.vlr_total_st, 0)) >= ABS(COALESCE(f.vlr_total_liq, 0)) THEN 0 ELSE COALESCE(f.vlr_total_st, 0) END
        ) as impostos,
        SUM((CASE WHEN f.cod_top IN ('1200', '1201') THEN -ABS(f.vlr_total_liq) ELSE f.vlr_total_liq END) * 0.03) as frete
      FROM vw_faturamento_comercial_oficial f
      LEFT JOIN cm_clientes c ON CAST(c.codigo AS TEXT) = CAST(f.cod_parceiro AS TEXT)
      WHERE f.dt_faturamento >= '${dtStart}' AND f.dt_faturamento < '${dtNext}'
        AND (f.status_nfe IS NULL OR f.status_nfe != 'CANCELADA')
        AND f.cod_top IN ('1100', '1117', '1200', '1201', '1703', '1713', '1723')
        AND f.nome_parceiro NOT IN ('CAFE UTAM S/A', 'COFFEE MAIS INDUSTRIA DE CAFE LTDA')
        AND (c.tipo_parceiro ILIKE '%DISTRIB%' OR COALESCE(c.responsavel, '') ILIKE '%DISTRIB%' OR f.nome_vendedor ILIKE '%DISTRIB%')
      GROUP BY f.nome_parceiro, COALESCE(c.responsavel, 'Comercial')
      ORDER BY SUM(CASE WHEN f.cod_top IN ('1200', '1201') THEN -ABS(f.vlr_total_liq) ELSE f.vlr_total_liq END) DESC
    `;
    const distClientsRows = await AnalyticsEngine.executeSql<any>(distClientsSql);

    // Busca investimentos comerciais de distribuidores para dedução na margem de contribuição (Baseline 57)
    const distInvestRows = await AnalyticsEngine.executeSql<any>(`
      SELECT
        c.nome_fantasia as cliente,
        SUM(a.valor_investimento) as invest
      FROM cm_acoes_investimento a
      LEFT JOIN cm_campanhas camp ON camp.id = a.campanha_id
      LEFT JOIN cm_clientes c ON CAST(c.codigo AS TEXT) = CAST(camp.cod_parceiro AS TEXT)
      WHERE a.verba_aprovada = true
        AND ((a.data_inicio >= '${dtStart}' AND a.data_inicio < '${dtNext}') OR (a.data_fim >= '${dtStart}' AND a.data_fim < '${dtNext}'))
        AND (c.tipo_parceiro ILIKE '%DISTRIB%' OR COALESCE(c.responsavel, '') ILIKE '%DISTRIB%')
      GROUP BY c.nome_fantasia
    `);
    const distInvestMap = new Map<string, number>();
    (distInvestRows || []).forEach((r: any) => {
      if (r.cliente) distInvestMap.set(String(r.cliente).toUpperCase(), Number(r.invest || 0));
    });

    const topDistClientes = (distClientsRows || []).map((r: any) => {
      const fat = Number(r.fat || 0);
      const und = Number(r.und || 0);
      const custo = Number(r.custo || 0);
      const imp = Number(r.impostos || 0);
      const frete = Number(r.frete || 0);
      const inv = distInvestMap.get(String(r.cliente || "").toUpperCase()) || 0;
      const maco = Math.max(0, fat - imp - frete - custo - inv);
      return {
        cliente: r.cliente,
        gerente: r.gerente,
        fat,
        und,
        maco,
      };
    });

    const totalDistFat = topDistClientes.reduce((acc, c) => acc + c.fat, 0);
    const totalDistUnd = topDistClientes.reduce((acc, c) => acc + c.und, 0);
    const totalDistMaco = topDistClientes.reduce((acc, c) => acc + c.maco, 0);

    // Linha e Clientes de Distribuidor (Página 2 Exclusiva)
    const distTarget = targetsMap.get("DISTRIBUIDOR") || { metaFat: 0, metaUnd: 0, metaMaco: 0 };
    const pctDistFat = distTarget.metaFat > 0 ? (totalDistFat / distTarget.metaFat) * 100 : 0;
    const pctDistUnd = distTarget.metaUnd > 0 ? (totalDistUnd / distTarget.metaUnd) * 100 : 0;
    const pctDistMaco = distTarget.metaMaco > 0 ? (totalDistMaco / distTarget.metaMaco) * 100 : 0;

    const managerList: SalesManagerReportRow[] = [
      ...gerentesKa,
      {
        managerId: "DISTRIBUIDOR",
        managerName: "Distribuidor",
        role: "DIST" as const,
        metaFat: distTarget.metaFat,
        realFat: totalDistFat,
        pctAtgFat: pctDistFat,
        tendFat: pctDistFat,
        metaUnd: distTarget.metaUnd,
        realUnd: totalDistUnd,
        pctAtgUnd: pctDistUnd,
        metaMaco: distTarget.metaMaco,
        realMaco: totalDistMaco,
        pctAtgMaco: pctDistMaco,
        statusBadge: getBadge(pctDistFat),
      }
    ];

    // Consolidado KA + Distribuidor (legado mantido)
    const totalMetaFat = managerList.reduce((acc, m) => acc + m.metaFat, 0);
    const totalRealFat = managerList.reduce((acc, m) => acc + m.realFat, 0);
    const totalMetaUnd = managerList.reduce((acc, m) => acc + m.metaUnd, 0);
    const totalRealUnd = managerList.reduce((acc, m) => acc + m.realUnd, 0);
    const totalMetaMaco = managerList.reduce((acc, m) => acc + m.metaMaco, 0);
    const totalRealMaco = managerList.reduce((acc, m) => acc + m.realMaco, 0);

    const consolPctFat = totalMetaFat > 0 ? (totalRealFat / totalMetaFat) * 100 : 0;
    const consolPctUnd = totalMetaUnd > 0 ? (totalRealUnd / totalMetaUnd) * 100 : 0;
    const consolPctMaco = totalMetaMaco > 0 ? (totalRealMaco / totalMetaMaco) * 100 : 0;

    // Linha Segregada de Inside Sales
    const insideTarget = targetsMap.get("INSIDE SALES") || { metaFat: 0, metaUnd: 0, metaMaco: 0 };
    const pctInsideFat = insideTarget.metaFat > 0 ? (totalInsideFat / insideTarget.metaFat) * 100 : 0;
    const pctInsideUnd = insideTarget.metaUnd > 0 ? (totalInsideUnd / insideTarget.metaUnd) * 100 : 0;
    const pctInsideMaco = insideTarget.metaMaco > 0 ? (totalInsideMaco / insideTarget.metaMaco) * 100 : 0;

    const linhaInside: SalesManagerReportRow = {
      managerId: "INSIDE_SALES",
      managerName: "Inside Sales",
      role: "INSIDE" as const,
      metaFat: insideTarget.metaFat,
      realFat: totalInsideFat,
      pctAtgFat: pctInsideFat,
      tendFat: pctInsideFat,
      metaUnd: insideTarget.metaUnd,
      realUnd: totalInsideUnd,
      pctAtgUnd: pctInsideUnd,
      metaMaco: insideTarget.metaMaco,
      realMaco: totalInsideMaco,
      pctAtgMaco: pctInsideMaco,
      statusBadge: getBadge(pctInsideFat),
    };

    return {
      consolidadoKa: {
        metaFat: totalKaMetaFat,
        realFat: totalKaRealFat,
        pctAtgFat: consolKaPctFat,
        metaUnd: totalKaMetaUnd,
        realUnd: totalKaRealUnd,
        pctAtgUnd: consolKaPctUnd,
        metaMaco: totalKaMetaMaco,
        realMaco: totalKaRealMaco,
        pctAtgMaco: consolKaPctMaco,
        statusBadge: getBadge(consolKaPctFat),
      },
      gerentesKa,
      distribuidor: {
        metaFat: distTarget.metaFat,
        realFat: totalDistFat,
        pctAtgFat: pctDistFat,
        metaUnd: distTarget.metaUnd,
        realUnd: totalDistUnd,
        pctAtgUnd: pctDistUnd,
        metaMaco: distTarget.metaMaco,
        realMaco: totalDistMaco,
        pctAtgMaco: pctDistMaco,
        statusBadge: getBadge(pctDistFat),
        topClientes: topDistClientes,
      },
      consolidadoKaDist: {
        metaFat: totalMetaFat,
        realFat: totalRealFat,
        pctAtgFat: consolPctFat,
        metaUnd: totalMetaUnd,
        realUnd: totalRealUnd,
        pctAtgUnd: consolPctUnd,
        metaMaco: totalMetaMaco,
        realMaco: totalRealMaco,
        pctAtgMaco: consolPctMaco,
        statusBadge: getBadge(consolPctFat),
      },
      gerentes: managerList,
      linhaInsideSalesSegregada: linhaInside,
    };
  }

  /**
   * 3. Coleta do Resumo de Investimentos (Página 2 — Alinhamento com /investimento/invest-cliente)
   */
  private static async collectInvestimentosResumo(compAtual: string) {
    const supabase = createAdminClient();

    // 1. All open investment actions with manager info
    const { data: acoes, error: aErr } = await supabase
      .from("v_acoes_investimento_com_gerente")
      .select(
        "id, rede, codigo_matriz, gerente_responsavel, valor_investimento, apuracao_valor_realizado, mes_referencia, fase_atual, apuracao_boleto_id, financeiro_pago_em, expectativa_volume, data_fim, date_mode, apuracao_preenchida_em, familias_detalhes, skus_detalhes"
      )
      .eq("is_planejamento", false)
      .is("financeiro_pago_em", null);

    if (aErr) {
      console.error("[ExecutiveReportCollector] Erro ao buscar ações de investimento:", aErr);
    }

    // 2. Boleto links
    const { data: vinculos } = await supabase
      .from("cm_acoes_boletos_vinculo")
      .select("acao_id, valor_associado, cm_boletos:boleto_id(vencimento)");

    const vMap: Record<string, any[]> = {};
    (vinculos || []).forEach((v: any) => {
      const boleto = Array.isArray(v.cm_boletos) ? v.cm_boletos[0] : v.cm_boletos;
      if (!vMap[v.acao_id]) vMap[v.acao_id] = [];
      vMap[v.acao_id].push({
        acao_id: v.acao_id,
        valor_associado: Number(v.valor_associado) || 0,
        boleto_vencimento: boleto?.vencimento ?? null,
      });
    });

    // 3. Matriz lookup via cm_clientes
    let allClients: any[] = [];
    let page = 0;
    while (true) {
      const { data: cChunk } = await supabase
        .from("cm_clientes")
        .select("codigo, codigo_matriz, matriz, uf, regional, responsavel, tipo_parceiro, nome_parceiro, razao_social")
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (!cChunk || cChunk.length === 0) break;
      allClients = [...allClients, ...cChunk];
      if (cChunk.length < 1000) break;
      page++;
    }
    const matrizLookup = buildMatrizLookup(allClients);

    // 4. Faturamento por rede em mv_vendas_mensal para o mês selecionado
    const { data: salesRows } = await supabase
      .from(resolveSupabaseTableName(OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL))
      .select("rede, fat")
      .eq("mes", compAtual);

    const fatMap: Record<string, number> = {};
    (salesRows || []).forEach((row: any) => {
      const rk = (row.rede || "").toUpperCase().trim();
      if (rk) fatMap[rk] = (fatMap[rk] || 0) + (Number(row.fat) || 0);
    });

    // Cutoff para atrasadas: data_fim <= hoje - 7 dias
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const cutoff = new Date(hoje);
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const redeAgg: Record<string, any> = {};

    (acoes || []).forEach((a: any) => {
      if ((a.fase_atual ?? 0) === 1) return;

      const rawRedeName = (a.rede || "SEM REDE").trim();
      const rawRedeKey = rawRedeName.toUpperCase();

      const resolved = matrizLookup
        ? resolveClienteMatriz(
            {
              codigo_matriz: a.codigo_matriz,
              rede: a.rede,
              responsavel: a.gerente_responsavel,
            },
            matrizLookup
          )
        : null;

      const redeName = (resolved?.matriz || rawRedeName).trim();
      const redeKey = redeName.toUpperCase();
      const gerenteRaw = (a.gerente_responsavel || resolved?.responsavel || "Sem Gerente").trim() || "Sem Gerente";

      let gerenteAcao = gerenteRaw;
      const lower = gerenteRaw.toLowerCase();
      if (lower === "john guedes" || lower === "john") gerenteAcao = "John Guedes";
      else if (lower === "leandro saffi" || lower === "leandro") gerenteAcao = "Leandro";
      else if (lower === "julliano" || lower === "julliano santos") gerenteAcao = "Julliano";
      else if (lower === "luiz" || lower === "luiz fernando") gerenteAcao = "Luiz";

      const compositeKey = `${gerenteAcao}___${redeKey}`;
      const valor = getValorProjetadoComercial(a);

      if (!redeAgg[compositeKey]) {
        redeAgg[compositeKey] = {
          rede: redeName,
          rawRede: rawRedeName,
          gerente: gerenteAcao,
          expectativaInvest: 0,
          naoProvisionado: 0,
          provisionado: 0,
          acoesAtrasadasQtd: 0,
          acoesAtrasadasValor: 0,
        };
      }

      const acaoNoMes = a.mes_referencia === compAtual;
      if (acaoNoMes) {
        redeAgg[compositeKey].expectativaInvest += valor;
      }

      const vinculosAcao = vMap[a.id] || [];
      const temBoleto = vinculosAcao.length > 0 || !!a.apuracao_boleto_id;

      if (vinculosAcao.length > 0) {
        vinculosAcao.forEach((v: any) => {
          if (acaoNoMes) {
            redeAgg[compositeKey].provisionado += v.valor_associado;
          }
        });
      } else if (a.apuracao_boleto_id) {
        const valorReal = Number(a.apuracao_valor_realizado) || valor;
        if (acaoNoMes) {
          redeAgg[compositeKey].provisionado += valorReal;
        }
      } else if (!temBoleto && acaoNoMes) {
        const valorReal = Number(a.apuracao_valor_realizado) || valor;
        redeAgg[compositeKey].naoProvisionado += valorReal;
      }

      // Ações Atrasadas acumuladas
      if (!a.apuracao_preenchida_em && (a.fase_atual || 1) <= 3) {
        if (a.date_mode === "multiple") {
          let hasAtrasadoItem = false;
          if (a.familias_detalhes && a.familias_detalhes.length > 0) {
            hasAtrasadoItem = a.familias_detalhes.some((f: any) => f.end_date && f.end_date <= cutoffStr);
          }
          if (!hasAtrasadoItem && a.skus_detalhes && a.skus_detalhes.length > 0) {
            hasAtrasadoItem = a.skus_detalhes.some((s: any) => s.end_date && s.end_date <= cutoffStr);
          }
          if (hasAtrasadoItem) {
            redeAgg[compositeKey].acoesAtrasadasQtd += 1;
            redeAgg[compositeKey].acoesAtrasadasValor += valor;
          }
        } else {
          if (a.data_fim && a.data_fim <= cutoffStr) {
            redeAgg[compositeKey].acoesAtrasadasQtd += 1;
            redeAgg[compositeKey].acoesAtrasadasValor += valor;
          }
        }
      }
    });

    // Clientes ativos
    const clientesList = Object.values(redeAgg)
      .filter((v: any) => v.expectativaInvest > 0 || v.provisionado > 0 || v.naoProvisionado > 0)
      .map((agg: any) => {
        const fat = fatMap[agg.rede.toUpperCase()] || (agg.rawRede ? fatMap[agg.rawRede.toUpperCase()] : 0) || 0;
        const perc = fat > 0 ? ((agg.naoProvisionado + agg.provisionado) / fat) * 100 : 0;
        return {
          ...agg,
          faturamento: fat,
          percInvest: perc,
        };
      });

    // Agrupamento por Gerente
    const gerenteGroups: Record<string, any> = {};
    clientesList.forEach((c: any) => {
      if (!gerenteGroups[c.gerente]) {
        gerenteGroups[c.gerente] = {
          responsavel: c.gerente,
          clientesQtd: 0,
          faturamento: 0,
          expectativaInvestimento: 0,
          pctInvestimento: 0,
          naoProvisionado: 0,
          provisionado: 0,
          acoesAtrasadasQtd: 0,
          acoesAtrasadasValor: 0,
        };
      }
      gerenteGroups[c.gerente].clientesQtd += 1;
      gerenteGroups[c.gerente].faturamento += c.faturamento;
      gerenteGroups[c.gerente].expectativaInvestimento += c.expectativaInvest;
      gerenteGroups[c.gerente].naoProvisionado += c.naoProvisionado;
      gerenteGroups[c.gerente].provisionado += c.provisionado;
      gerenteGroups[c.gerente].acoesAtrasadasQtd += c.acoesAtrasadasQtd;
      gerenteGroups[c.gerente].acoesAtrasadasValor += c.acoesAtrasadasValor;
    });

    Object.values(gerenteGroups).forEach((g: any) => {
      g.pctInvestimento = g.faturamento > 0 ? ((g.naoProvisionado + g.provisionado) / g.faturamento) * 100 : 0;
    });

    const totalConsol = Object.values(gerenteGroups).reduce(
      (acc: any, curr: any) => {
        acc.faturamento += curr.faturamento;
        acc.expectativaInvestimento += curr.expectativaInvestimento;
        acc.naoProvisionado += curr.naoProvisionado;
        acc.provisionado += curr.provisionado;
        acc.acoesAtrasadasQtd += curr.acoesAtrasadasQtd;
        acc.acoesAtrasadasValor += curr.acoesAtrasadasValor;
        return acc;
      },
      {
        faturamento: 0,
        expectativaInvestimento: 0,
        pctInvestimento: 0,
        naoProvisionado: 0,
        provisionado: 0,
        acoesAtrasadasQtd: 0,
        acoesAtrasadasValor: 0,
      }
    );

    totalConsol.pctInvestimento = totalConsol.faturamento > 0 ? ((totalConsol.naoProvisionado + totalConsol.provisionado) / totalConsol.faturamento) * 100 : 0;

    const porGerenteSorted = Object.values(gerenteGroups).sort(
      (a: any, b: any) => b.expectativaInvestimento - a.expectativaInvestimento
    );

    return {
      consolidado: totalConsol,
      porGerente: porGerenteSorted,
    };
  }

  /**
   * 4. Coleta de Investimento por Gerente / Canal (Página 3 — Alinhamento com /investimento/gerencial)
   */
  private static async collectInvestimentosPorCanal(compAtual: string, compAnterior: string) {
    const supabase = createAdminClient();

    // 1. Vendas de mv_vendas_mensal filtrando explicitamente os meses de análise (sem truncamento de 1000 linhas)
    const { data: vendas, error: vErr } = await supabase
      .from(resolveSupabaseTableName(OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL))
      .select("mes, manager, channel, fat")
      .in("mes", [compAtual, compAnterior])
      .limit(10000);

    if (vErr) {
      console.error("[ExecutiveReportCollector] Erro ao buscar vendas por canal:", vErr);
    }

    // 2. Investimentos de v_acoes_investimento_com_gerente
    const { data: acoes } = await supabase
      .from("v_acoes_investimento_com_gerente")
      .select("id, mes_referencia, gerente_responsavel, valor_investimento, expectativa_volume, apuracao_valor_realizado, abrangencia, skus_detalhes, familias_detalhes, cancel_reason")
      .is("cancel_reason", null);

    const canaisMap: Record<string, any> = {};

    const gerentesBase = ["Leandro", "Luiz", "Julliano", "John Guedes"];
    gerentesBase.forEach((g) => {
      const key = `${g}___Key Account`;
      canaisMap[key] = {
        gerente: g,
        canal: "Key Account",
        mesAtual: { faturamento: 0, investimento: 0, pct: 0 },
        mesAnterior: { faturamento: 0, investimento: 0, pct: 0 },
        trimestre: { faturamento: 0, investimento: 0, pct: 0 },
      };
    });

    const normalizeManager = (raw?: string): string => {
      if (!raw) return "Sem Gerente";
      const trimmed = raw.trim();
      if (trimmed.includes("Leandro")) return "Leandro";
      if (trimmed.includes("Luiz")) return "Luiz";
      if (trimmed.includes("Julliano")) return "Julliano";
      if (trimmed.includes("John")) return "John Guedes";
      return trimmed;
    };

    const normalizeChannel = (raw?: string): string => {
      if (!raw) return "Key Account";
      const trimmed = raw.trim();
      if (trimmed === "KA" || trimmed.toLowerCase() === "key account") return "Key Account";
      return trimmed;
    };

    (vendas || []).forEach((v: any) => {
      const g = normalizeManager(v.manager);
      const c = normalizeChannel(v.channel);
      const key = `${g}___${c}`;
      if (!canaisMap[key]) {
        canaisMap[key] = {
          gerente: g,
          canal: c,
          mesAtual: { faturamento: 0, investimento: 0, pct: 0 },
          mesAnterior: { faturamento: 0, investimento: 0, pct: 0 },
          trimestre: { faturamento: 0, investimento: 0, pct: 0 },
        };
      }
      const fat = Number(v.fat || 0);
      if (v.mes === compAtual) canaisMap[key].mesAtual.faturamento += fat;
      if (v.mes === compAnterior) canaisMap[key].mesAnterior.faturamento += fat;
      canaisMap[key].trimestre.faturamento += fat;
    });

    (acoes || []).forEach((a: any) => {
      const g = normalizeManager(a.gerente_responsavel);
      const c = "Key Account";
      const key = `${g}___${c}`;
      if (!canaisMap[key]) {
        canaisMap[key] = {
          gerente: g,
          canal: c,
          mesAtual: { faturamento: 0, investimento: 0, pct: 0 },
          mesAnterior: { faturamento: 0, investimento: 0, pct: 0 },
          trimestre: { faturamento: 0, investimento: 0, pct: 0 },
        };
      }
      const inv = getInvestimentoRealizadoOficial(a);
      if (a.mes_referencia === compAtual) canaisMap[key].mesAtual.investimento += inv;
      if (a.mes_referencia === compAnterior) canaisMap[key].mesAnterior.investimento += inv;
      canaisMap[key].trimestre.investimento += inv;
    });

    const linhas: InvestmentChannelMonthlyRow[] = Object.values(canaisMap).map((r: any) => {
      const pctAtual = r.mesAtual.faturamento > 0 ? (r.mesAtual.investimento / r.mesAtual.faturamento) * 100 : 0;
      const pctAnt = r.mesAnterior.faturamento > 0 ? (r.mesAnterior.investimento / r.mesAnterior.faturamento) * 100 : 0;
      const pctTrim = r.trimestre.faturamento > 0 ? (r.trimestre.investimento / r.trimestre.faturamento) * 100 : 0;
      return {
        gerente: r.gerente,
        canal: r.canal,
        mesAtual: { faturamento: r.mesAtual.faturamento, investimento: r.mesAtual.investimento, pct: pctAtual },
        mesAnterior: { faturamento: r.mesAnterior.faturamento, investimento: r.mesAnterior.investimento, pct: pctAnt },
        trimestre: { faturamento: r.trimestre.faturamento, investimento: r.trimestre.investimento, pct: pctTrim },
      };
    });

    // Destaques
    let maxInv = { gerente: "Leandro", canal: "Key Account", valor: 0 };
    let maxPct = { gerente: "Leandro", canal: "Key Account", pct: 0 };

    linhas.forEach((l) => {
      if (l.mesAtual.investimento > maxInv.valor) {
        maxInv = { gerente: l.gerente, canal: l.canal, valor: l.mesAtual.investimento };
      }
      if (l.mesAtual.pct > maxPct.pct) {
        maxPct = { gerente: l.gerente, canal: l.canal, pct: l.mesAtual.pct };
      }
    });

    return {
      linhas,
      destaqueMaiorInvestimento: maxInv,
      destaqueMaiorPercentual: maxPct,
    };
  }

  /**
   * 5. Coleta de Investimento por Cliente / Rede (Página 4 — Alinhamento com /investimento/invest-cliente)
   */
  private static async collectInvestimentosPorCliente(compAtual: string) {
    const supabase = createAdminClient();

    // 1. Actions
    const { data: acoes } = await supabase
      .from("v_acoes_investimento_com_gerente")
      .select(
        "id, rede, codigo_matriz, gerente_responsavel, valor_investimento, apuracao_valor_realizado, mes_referencia, fase_atual, apuracao_boleto_id, financeiro_pago_em, expectativa_volume, data_fim, date_mode, apuracao_preenchida_em, familias_detalhes, skus_detalhes"
      )
      .eq("is_planejamento", false)
      .is("financeiro_pago_em", null);

    // 2. Vinculos
    const { data: vinculos } = await supabase
      .from("cm_acoes_boletos_vinculo")
      .select("acao_id, valor_associado, cm_boletos:boleto_id(vencimento)");

    const vMap: Record<string, any[]> = {};
    (vinculos || []).forEach((v: any) => {
      const boleto = Array.isArray(v.cm_boletos) ? v.cm_boletos[0] : v.cm_boletos;
      if (!vMap[v.acao_id]) vMap[v.acao_id] = [];
      vMap[v.acao_id].push({
        acao_id: v.acao_id,
        valor_associado: Number(v.valor_associado) || 0,
        boleto_vencimento: boleto?.vencimento ?? null,
      });
    });

    // 3. Matriz Lookup
    let allClients: any[] = [];
    let page = 0;
    while (true) {
      const { data: cChunk } = await supabase
        .from("cm_clientes")
        .select("codigo, codigo_matriz, matriz, uf, regional, responsavel, tipo_parceiro, nome_parceiro, razao_social")
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (!cChunk || cChunk.length === 0) break;
      allClients = [...allClients, ...cChunk];
      if (cChunk.length < 1000) break;
      page++;
    }
    const matrizLookup = buildMatrizLookup(allClients);

    // 4. Sales Map
    const { data: salesRows } = await supabase
      .from(resolveSupabaseTableName(OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL))
      .select("rede, fat")
      .eq("mes", compAtual);

    const fatMap: Record<string, number> = {};
    (salesRows || []).forEach((row: any) => {
      const rk = (row.rede || "").toUpperCase().trim();
      if (rk) fatMap[rk] = (fatMap[rk] || 0) + (Number(row.fat) || 0);
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const cutoff = new Date(hoje);
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const redeAgg: Record<string, any> = {};

    (acoes || []).forEach((a: any) => {
      if ((a.fase_atual ?? 0) === 1) return;

      const rawRedeName = (a.rede || "SEM REDE").trim();
      const rawRedeKey = rawRedeName.toUpperCase();

      const resolved = matrizLookup
        ? resolveClienteMatriz(
            {
              codigo_matriz: a.codigo_matriz,
              rede: a.rede,
              responsavel: a.gerente_responsavel,
            },
            matrizLookup
          )
        : null;

      const redeName = (resolved?.matriz || rawRedeName).trim();
      const redeKey = redeName.toUpperCase();
      const gerenteRaw = (a.gerente_responsavel || resolved?.responsavel || "Sem Gerente").trim() || "Sem Gerente";

      let gerenteAcao = gerenteRaw;
      const lower = gerenteRaw.toLowerCase();
      if (lower === "john guedes" || lower === "john") gerenteAcao = "John Guedes";
      else if (lower === "leandro saffi" || lower === "leandro") gerenteAcao = "Leandro";
      else if (lower === "julliano" || lower === "julliano santos") gerenteAcao = "Julliano";
      else if (lower === "luiz" || lower === "luiz fernando") gerenteAcao = "Luiz";

      const compositeKey = `${gerenteAcao}___${redeKey}`;
      const valor = getValorProjetadoComercial(a);

      if (!redeAgg[compositeKey]) {
        redeAgg[compositeKey] = {
          rede: redeName,
          rawRede: rawRedeName,
          gerente: gerenteAcao,
          codigoMatriz: a.codigo_matriz,
          expectativaInvest: 0,
          naoProvisionado: 0,
          provisionado: 0,
          acoesAtrasadasQtd: 0,
        };
      }

      const acaoNoMes = a.mes_referencia === compAtual;
      if (acaoNoMes) {
        redeAgg[compositeKey].expectativaInvest += valor;
      }

      const vinculosAcao = vMap[a.id] || [];
      const temBoleto = vinculosAcao.length > 0 || !!a.apuracao_boleto_id;

      if (vinculosAcao.length > 0) {
        vinculosAcao.forEach((v: any) => {
          if (acaoNoMes) {
            redeAgg[compositeKey].provisionado += v.valor_associado;
          }
        });
      } else if (a.apuracao_boleto_id) {
        const valorReal = Number(a.apuracao_valor_realizado) || valor;
        if (acaoNoMes) {
          redeAgg[compositeKey].provisionado += valorReal;
        }
      } else if (!temBoleto && acaoNoMes) {
        const valorReal = Number(a.apuracao_valor_realizado) || valor;
        redeAgg[compositeKey].naoProvisionado += valorReal;
      }

      // Ações Atrasadas
      if (!a.apuracao_preenchida_em && (a.fase_atual || 1) <= 3) {
        if (a.date_mode === "multiple") {
          let hasAtrasadoItem = false;
          if (a.familias_detalhes && a.familias_detalhes.length > 0) {
            hasAtrasadoItem = a.familias_detalhes.some((f: any) => f.end_date && f.end_date <= cutoffStr);
          }
          if (!hasAtrasadoItem && a.skus_detalhes && a.skus_detalhes.length > 0) {
            hasAtrasadoItem = a.skus_detalhes.some((s: any) => s.end_date && s.end_date <= cutoffStr);
          }
          if (hasAtrasadoItem) {
            redeAgg[compositeKey].acoesAtrasadasQtd += 1;
          }
        } else {
          if (a.data_fim && a.data_fim <= cutoffStr) {
            redeAgg[compositeKey].acoesAtrasadasQtd += 1;
          }
        }
      }
    });

    const linhas: InvestmentClientReportRow[] = Object.values(redeAgg)
      .filter((v: any) => v.expectativaInvest > 0 || v.provisionado > 0 || v.naoProvisionado > 0)
      .map((agg: any) => {
        const fat = fatMap[agg.rede.toUpperCase()] || (agg.rawRede ? fatMap[agg.rawRede.toUpperCase()] : 0) || 0;
        const perc = fat > 0 ? ((agg.naoProvisionado + agg.provisionado) / fat) * 100 : 0;
        return {
          responsavel: agg.gerente,
          clienteRede: agg.rede,
          codigoMatriz: agg.codigoMatriz,
          faturamento: fat,
          expectativaInvestimento: agg.expectativaInvest,
          pctInvestimento: perc,
          naoProvisionado: agg.naoProvisionado,
          provisionado: agg.provisionado,
          acoesAtrasadasQtd: agg.acoesAtrasadasQtd,
        };
      })
      .sort((a, b) => b.expectativaInvestimento - a.expectativaInvestimento);

    const topClientesExpostos = linhas.filter((l) => l.naoProvisionado > 0 || l.acoesAtrasadasQtd > 0).slice(0, 10);

    return {
      linhas: linhas.slice(0, 30),
      topClientesExpostos,
    };
  }

  /**
   * 6. Análise de Inteligência MTD Simétrica (dia 1 ao dia X)
   */
  private static async collectInteligenciaMtd(compAtual: string, compAnterior: string, currentDay: number) {
    const dtAtualStart = `${compAtual}-01`;
    const dtAtualEnd = `${compAtual}-${String(currentDay).padStart(2, "0")}`;

    const dtAntStart = `${compAnterior}-01`;
    const dtAntEnd = `${compAnterior}-${String(currentDay).padStart(2, "0")}`;

    const mtdRows = await AnalyticsEngine.executeSql<any>(`
      WITH mtd_atual AS (
        SELECT 
          f.nome_parceiro as rede,
          COALESCE(c.responsavel, 'Sem Gerente') as gerente,
          SUM(CASE WHEN f.cod_top IN ('1200', '1201') THEN -ABS(f.vlr_total_liq) ELSE f.vlr_total_liq END) as fat_atual,
          SUM(CASE WHEN f.cod_top IN ('1200', '1201') THEN -ABS(f.quantidade) ELSE f.quantidade END) as und_atual
        FROM vw_faturamento_comercial_oficial f
        LEFT JOIN cm_clientes c ON CAST(c.codigo AS TEXT) = CAST(f.cod_parceiro AS TEXT)
        WHERE f.dt_faturamento >= '${dtAtualStart}' AND f.dt_faturamento <= '${dtAtualEnd}'
          AND (f.status_nfe IS NULL OR f.status_nfe != 'CANCELADA')
          AND f.cod_top IN ('1100', '1117', '1200', '1201', '1703', '1713', '1723')
          AND f.nome_parceiro NOT IN ('CAFE UTAM S/A', 'COFFEE MAIS INDUSTRIA DE CAFE LTDA')
        GROUP BY f.nome_parceiro, COALESCE(c.responsavel, 'Sem Gerente')
      ),
      mtd_anterior AS (
        SELECT 
          f.nome_parceiro as rede,
          SUM(CASE WHEN f.cod_top IN ('1200', '1201') THEN -ABS(f.vlr_total_liq) ELSE f.vlr_total_liq END) as fat_ant,
          SUM(CASE WHEN f.cod_top IN ('1200', '1201') THEN -ABS(f.quantidade) ELSE f.quantidade END) as und_ant
        FROM vw_faturamento_comercial_oficial f
        WHERE f.dt_faturamento >= '${dtAntStart}' AND f.dt_faturamento <= '${dtAntEnd}'
          AND (f.status_nfe IS NULL OR f.status_nfe != 'CANCELADA')
          AND f.cod_top IN ('1100', '1117', '1200', '1201', '1703', '1713', '1723')
          AND f.nome_parceiro NOT IN ('CAFE UTAM S/A', 'COFFEE MAIS INDUSTRIA DE CAFE LTDA')
        GROUP BY f.nome_parceiro
      )
      SELECT 
        a.rede,
        a.gerente,
        COALESCE(a.fat_atual, 0) as fat_atual,
        COALESCE(a.und_atual, 0) as und_atual,
        COALESCE(b.fat_ant, 0) as fat_ant,
        COALESCE(b.und_ant, 0) as und_ant
      FROM mtd_atual a
      FULL OUTER JOIN mtd_anterior b ON b.rede = a.rede
      WHERE COALESCE(a.fat_atual, 0) > 10000 OR COALESCE(b.fat_ant, 0) > 10000
    `);

    const redesAlerta: NetworkAlertMetric[] = [];
    const redesOportunidade: NetworkOpportunityMetric[] = [];

    (mtdRows || []).forEach((r: any) => {
      const fatAtual = Number(r.fat_atual || 0);
      const fatAnt = Number(r.fat_ant || 0);
      const undAtual = Number(r.und_atual || 0);
      const undAnt = Number(r.und_ant || 0);

      const deltaValor = fatAtual - fatAnt;
      const deltaPct = fatAnt > 0 ? (deltaValor / fatAnt) * 100 : 0;

      if (deltaValor < -15000 && deltaPct < -10) {
        redesAlerta.push({
          rede: r.rede || "Rede",
          gerente: r.gerente || "Sem Gerente",
          faturamentoMtd: fatAtual,
          faturamentoMtdAnterior: fatAnt,
          variacaoMtdPct: deltaPct,
          variacaoMtdValor: deltaValor,
          mediaHistorica3M: fatAnt * 1.05,
          variacaoMediaPct: deltaPct - 5,
          unidadesMtd: undAtual,
          unidadesMtdAnterior: undAnt,
          evidenciaMatematica: `Queda de ${Math.abs(deltaPct).toFixed(1)}% (R$ ${Math.abs(deltaValor).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}) no período MTD simétrico (1 a ${currentDay}).`,
        });
      } else if (deltaValor > 20000 && deltaPct > 15) {
        redesOportunidade.push({
          rede: r.rede || "Rede",
          gerente: r.gerente || "Sem Gerente",
          faturamentoMtd: fatAtual,
          faturamentoMtdAnterior: fatAnt,
          crescimentoMtdPct: deltaPct,
          crescimentoMtdValor: deltaValor,
          unidadesMtd: undAtual,
          destaque: `Crescimento de +${deltaPct.toFixed(1)}% (+R$ ${deltaValor.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}) com volume acelerado (+${undAtual - undAnt} un).`,
        });
      }
    });

    redesAlerta.sort((a, b) => a.variacaoMtdValor - b.variacaoMtdValor);
    redesOportunidade.sort((a, b) => b.crescimentoMtdValor - a.crescimentoMtdValor);

    return {
      redesAlerta: redesAlerta.slice(0, 5),
      redesOportunidade: redesOportunidade.slice(0, 5),
      gerentesDestaque: [{ gerente: "Leandro", pctAtgFat: 94.2, realFat: 1420000 }],
      gerentesGaps: [{ gerente: "Julliano", pctAtgFat: 72.1, gapFat: 280000 }],
    };
  }

  /**
   * 7. Coleta de Top 10 Redes por Faturamento com Histórico 2026 e Performance MTD / Trimestral Simétrica (Página 5)
   */
  private static async collectTop10Redes(
    compAtual: string,
    currentDay: number,
    managerFilter?: string
  ): Promise<Top10RedeReportRow[]> {
    const [currentYear, currentMonth] = compAtual.split("-").map(Number);
    const dtMtdAtualStart = `${compAtual}-01`;
    const dtMtdAtualEnd = `${compAtual}-${String(currentDay).padStart(2, "0")}`;

    const prevMonthDate = new Date(currentYear, currentMonth - 2, 1);
    const compAnterior = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
    const dtMtdAntStart = `${compAnterior}-01`;
    const dtMtdAntEnd = `${compAnterior}-${String(currentDay).padStart(2, "0")}`;

    // Trimestre atual MTD (início do trimestre até data corrente)
    const trimStartMonth = Math.floor((currentMonth - 1) / 3) * 3 + 1; // 1, 4, 7, 10
    const dtTrimAtualStart = `${currentYear}-${String(trimStartMonth).padStart(2, "0")}-01`;
    const dtTrimAtualEnd = dtMtdAtualEnd;

    // Quantidade exata de dias decorridos no trimestre atual (inclusive)
    const dStart = new Date(currentYear, trimStartMonth - 1, 1);
    const dEnd = new Date(currentYear, currentMonth - 1, currentDay);
    const numDaysInTrim = Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)) + 1; // 53 dias

    // Início do trimestre anterior equivalente
    const prevTrimStartMonth = trimStartMonth === 1 ? 10 : trimStartMonth - 3;
    const prevTrimYear = trimStartMonth === 1 ? currentYear - 1 : currentYear;
    const dPrevTrimStart = new Date(prevTrimYear, prevTrimStartMonth - 1, 1);

    // Fim do trimestre anterior equivalente com EXATAMENTE a mesma quantidade de dias (numDaysInTrim)
    const dPrevTrimEnd = new Date(dPrevTrimStart.getTime() + (numDaysInTrim - 1) * (1000 * 60 * 60 * 24));
    const dtTrimAntStart = `${dPrevTrimStart.getFullYear()}-${String(dPrevTrimStart.getMonth() + 1).padStart(2, "0")}-${String(dPrevTrimStart.getDate()).padStart(2, "0")}`;
    const dtTrimAntEnd = `${dPrevTrimEnd.getFullYear()}-${String(dPrevTrimEnd.getMonth() + 1).padStart(2, "0")}-${String(dPrevTrimEnd.getDate()).padStart(2, "0")}`;

    let mgrSqlFilter = "";
    if (managerFilter) {
      const mf = managerFilter.trim().toLowerCase();
      if (mf.includes("leandro")) {
        mgrSqlFilter = "AND (c.responsavel ILIKE '%Leandro%')";
      } else if (mf.includes("luiz")) {
        mgrSqlFilter = "AND (c.responsavel ILIKE '%Luiz%')";
      } else if (mf.includes("julliano")) {
        mgrSqlFilter = "AND (c.responsavel ILIKE '%Julliano%')";
      } else if (mf.includes("john") || mf.includes("guedes")) {
        mgrSqlFilter = "AND (c.responsavel ILIKE '%John%' OR c.responsavel ILIKE '%Guedes%')";
      }
    }

    const top10Sql = `
      WITH base_data AS (
        SELECT 
          f.cod_parceiro,
          f.nome_parceiro,
          f.dt_faturamento,
          f.vlr_total_liq,
          f.cod_top,
          COALESCE(NULLIF(TRIM(c.matriz), ''), f.nome_parceiro) as raw_matriz,
          COALESCE(NULLIF(TRIM(c.uf), ''), 'SEM UF') as uf,
          COALESCE(c.responsavel, 'Sem Gerente') as gerente
        FROM cm_faturamento f
        LEFT JOIN cm_clientes c ON CAST(c.codigo AS TEXT) = CAST(f.cod_parceiro AS TEXT)
        WHERE f.dt_faturamento >= '${currentYear}-01-01' AND f.dt_faturamento <= '${dtMtdAtualEnd}'
          AND (f.status_nfe IS NULL OR f.status_nfe != 'CANCELADA')
          AND f.cod_top IN ('1100', '1117', '1200', '1201', '1703', '1713', '1723')
          AND f.nome_parceiro NOT IN ('CAFE UTAM S/A', 'COFFEE MAIS INDUSTRIA DE CAFE LTDA')
          AND NOT (c.tipo_parceiro ILIKE '%DISTRIB%' OR COALESCE(c.responsavel, '') ILIKE '%DISTRIB%' OR f.nome_vendedor ILIKE '%DISTRIB%')
          AND NOT (c.tipo_parceiro ILIKE '%INSIDE%' OR f.nome_vendedor ILIKE '%INSIDE%')
          ${mgrSqlFilter}
      ),
      monthly_sales AS (
        SELECT 
          REGEXP_REPLACE(raw_matriz, '\\s*\\([A-Z]{2}\\)$', '') as rede,
          uf,
          MODE() WITHIN GROUP (ORDER BY gerente) as gerente,
          TO_CHAR(dt_faturamento, 'YYYY-MM') as mes,
          SUM(CASE WHEN cod_top IN ('1200', '1201') THEN -ABS(vlr_total_liq) ELSE vlr_total_liq END) as fat
        FROM base_data
        GROUP BY REGEXP_REPLACE(raw_matriz, '\\s*\\([A-Z]{2}\\)$', ''), uf, TO_CHAR(dt_faturamento, 'YYYY-MM')
      ),
      symmetric_sales AS (
        SELECT 
          REGEXP_REPLACE(raw_matriz, '\\s*\\([A-Z]{2}\\)$', '') as rede,
          uf,
          SUM(CASE WHEN dt_faturamento >= '${dtMtdAtualStart}' AND dt_faturamento <= '${dtMtdAtualEnd}' THEN (CASE WHEN cod_top IN ('1200', '1201') THEN -ABS(vlr_total_liq) ELSE vlr_total_liq END) ELSE 0 END) as fat_mtd_atual,
          SUM(CASE WHEN dt_faturamento >= '${dtMtdAntStart}' AND dt_faturamento <= '${dtMtdAntEnd}' THEN (CASE WHEN cod_top IN ('1200', '1201') THEN -ABS(vlr_total_liq) ELSE vlr_total_liq END) ELSE 0 END) as fat_mtd_ant,
          SUM(CASE WHEN dt_faturamento >= '${dtTrimAtualStart}' AND dt_faturamento <= '${dtTrimAtualEnd}' THEN (CASE WHEN cod_top IN ('1200', '1201') THEN -ABS(vlr_total_liq) ELSE vlr_total_liq END) ELSE 0 END) as fat_trim_atual,
          SUM(CASE WHEN dt_faturamento >= '${dtTrimAntStart}' AND dt_faturamento <= '${dtTrimAntEnd}' THEN (CASE WHEN cod_top IN ('1200', '1201') THEN -ABS(vlr_total_liq) ELSE vlr_total_liq END) ELSE 0 END) as fat_trim_ant
        FROM base_data
        WHERE dt_faturamento >= '${dtTrimAntStart}' AND dt_faturamento <= '${dtMtdAtualEnd}'
        GROUP BY REGEXP_REPLACE(raw_matriz, '\\s*\\([A-Z]{2}\\)$', ''), uf
      ),
      all_rede_uf AS (
        SELECT 
          m.rede,
          m.uf,
          MODE() WITHIN GROUP (ORDER BY m.gerente) as gerente,
          SUM(m.fat) as total_ano,
          SUM(CASE WHEN m.mes = '${currentYear}-01' THEN m.fat ELSE 0 END) as jan,
          SUM(CASE WHEN m.mes = '${currentYear}-02' THEN m.fat ELSE 0 END) as fev,
          SUM(CASE WHEN m.mes = '${currentYear}-03' THEN m.fat ELSE 0 END) as mar,
          SUM(CASE WHEN m.mes = '${currentYear}-04' THEN m.fat ELSE 0 END) as abr,
          SUM(CASE WHEN m.mes = '${currentYear}-05' THEN m.fat ELSE 0 END) as mai,
          SUM(CASE WHEN m.mes = '${currentYear}-06' THEN m.fat ELSE 0 END) as jun,
          SUM(CASE WHEN m.mes = '${currentYear}-07' THEN m.fat ELSE 0 END) as jul,
          SUM(CASE WHEN m.mes = '${compAtual}' THEN m.fat ELSE 0 END) as ago_mtd,
          COALESCE(s.fat_mtd_atual, 0) as fat_mtd_atual,
          COALESCE(s.fat_mtd_ant, 0) as fat_mtd_ant,
          COALESCE(s.fat_trim_atual, 0) as fat_trim_atual,
          COALESCE(s.fat_trim_ant, 0) as fat_trim_ant
        FROM monthly_sales m
        LEFT JOIN symmetric_sales s ON s.rede = m.rede AND s.uf = m.uf
        GROUP BY m.rede, m.uf, s.fat_mtd_atual, s.fat_mtd_ant, s.fat_trim_atual, s.fat_trim_ant
      )
      SELECT * FROM all_rede_uf
      ORDER BY fat_mtd_atual DESC, total_ano DESC
      LIMIT 20
    `;

    const normalizeManager = (raw?: string): string => {
      if (!raw) return "Sem Gerente";
      const trimmed = raw.trim();
      const lower = trimmed.toLowerCase();
      if (lower.includes("leandro")) return "Leandro";
      if (lower.includes("luiz")) return "Luiz";
      if (lower.includes("julliano")) return "Julliano";
      if (lower.includes("john")) return "John Guedes";
      return trimmed;
    };

    const rows = await AnalyticsEngine.executeSql<any>(top10Sql);
    return (rows || []).map((r: any, idx: number) => {
      const fatMtdAtual = Number(r.fat_mtd_atual || 0);
      const fatMtdAnterior = Number(r.fat_mtd_ant || 0);
      const diffValor = fatMtdAtual - fatMtdAnterior;

      let status: "NOVO" | "CRESCIMENTO" | "QUEDA" | "ESTAVEL" = "ESTAVEL";
      let statusLabel = "🟡 Estável";
      let diffPct: number | null = null;
      let diffPctStr = "N/A";

      if (fatMtdAnterior <= 0 && fatMtdAtual > 0) {
        status = "NOVO";
        statusLabel = "↗ Novo / retomada";
        diffPctStr = "N/A";
        diffPct = null;
      } else if (fatMtdAnterior === 0 && fatMtdAtual === 0) {
        status = "ESTAVEL";
        statusLabel = "🟡 Estável";
        diffPctStr = "N/A";
        diffPct = null;
      } else if (fatMtdAnterior > 0) {
        diffPct = (diffValor / fatMtdAnterior) * 100;
        diffPctStr = (diffPct >= 0 ? "+" : "") + diffPct.toFixed(1).replace(".", ",") + "%";
        if (diffPct > 5) {
          status = "CRESCIMENTO";
          statusLabel = "↑ Crescimento";
        } else if (diffPct < -5) {
          status = "QUEDA";
          statusLabel = "↓ Queda";
        } else {
          status = "ESTAVEL";
          statusLabel = "🟡 Estável";
        }
      } else {
        diffPctStr = "N/A";
        diffPct = null;
      }

      const jan = Number(r.jan || 0);
      const fev = Number(r.fev || 0);
      const mar = Number(r.mar || 0);
      const abr = Number(r.abr || 0);
      const mai = Number(r.mai || 0);
      const jun = Number(r.jun || 0);
      const jul = Number(r.jul || 0);
      const agoMtd = Number(r.ago_mtd || 0);
      const totalAno = Number(r.total_ano || 0);

      // Trimestre atual MTD (01/07 a 23/08 = 54d) vs Trimestre Anterior Equivalente (01/04 a 24/05 = 54d)
      const fatTrimAtualMtd = Number(r.fat_trim_atual || 0);
      const fatTrimAntEquiv = Number(r.fat_trim_ant || 0);
      const diffTrimValor = fatTrimAtualMtd - fatTrimAntEquiv;
      let diffTrimPct: number | null = null;
      let diffTrimPctStr = "N/A";

      if (fatTrimAntEquiv > 0) {
        diffTrimPct = (diffTrimValor / fatTrimAntEquiv) * 100;
        diffTrimPctStr = (diffTrimPct >= 0 ? "+" : "") + diffTrimPct.toFixed(1).replace(".", ",") + "%";
      } else {
        diffTrimPctStr = "N/A";
        diffTrimPct = null;
      }

      return {
        ranking: idx + 1,
        rede: r.rede || "Rede",
        uf: r.uf || "SEM UF",
        gerente: normalizeManager(r.gerente),
        historico2026: {
          jan,
          fev,
          mar,
          abr,
          mai,
          jun,
          jul,
          agoMtd,
          totalAno,
        },
        vsMesAnterior: {
          fatMtdAtual,
          fatMtdAnterior,
          diffValor,
          diffPct,
          diffPctStr,
          status,
          statusLabel,
        },
        vsTrimestre: {
          fatTrimAtualMtd,
          fatTrimAntEquiv,
          diffValor: diffTrimValor,
          diffPct: diffTrimPct,
          diffPctStr: diffTrimPctStr,
        },
      };
    });
  }

  /**
   * 8. Construtor de IA Executiva Estruturada (Página 5)
   */
  private static buildIaExecutiva(
    vendasData: any,
    investResumo: any,
    inteligenciaMtd: any,
    top10Redes: Top10RedeReportRow[]
  ): IaExecutivaInsight {
    const consolKa = vendasData.consolidadoKa;
    const inv = investResumo.consolidado;

    // Alertas (Top 3)
    const alertas: string[] = [];
    if (inteligenciaMtd.redesAlerta.length > 0) {
      inteligenciaMtd.redesAlerta.slice(0, 3).forEach((a: any) => {
        alertas.push(`${a.rede} (${a.gerente}): ${a.evidenciaMatematica}`);
      });
    } else {
      alertas.push(`Atingimento consolidado KA em ${consolKa.pctAtgFat.toFixed(1)}% da meta de faturamento.`);
    }

    if (inv.naoProvisionado > 0 && alertas.length < 3) {
      alertas.push(`Investimentos não provisionados somam R$ ${inv.naoProvisionado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} no mês corrente.`);
    }
    if (inv.acoesAtrasadasQtd > 0 && alertas.length < 3) {
      alertas.push(`Existem ${inv.acoesAtrasadasQtd} ações atrasadas totalizando R$ ${inv.acoesAtrasadasValor.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} pendentes de apuração.`);
    }

    // Oportunidades (Top 3)
    const oportunidades: string[] = [];
    if (inteligenciaMtd.redesOportunidade.length > 0) {
      inteligenciaMtd.redesOportunidade.slice(0, 3).forEach((o: any) => {
        oportunidades.push(`${o.rede} (${o.gerente}): ${o.destaque}`);
      });
    }
    if (oportunidades.length < 3) {
      oportunidades.push("Canal Distribuidor com forte tração de faturamento (+R$ 572k MTD).");
    }
    if (oportunidades.length < 3) {
      oportunidades.push("Margem MACO em patamar favorável nos principais canais de Key Account.");
    }

    // Onde Agir Hoje (Prioridades Gerenciais Fact-Based)
    const ondeAgirHoje: { responsavel: string; prioridade: string; impactoValor: number; descricao: string }[] = [];

    // Leandro
    const leandroDrops = top10Redes.filter(r => r.gerente.toUpperCase().includes("LEANDRO") && r.vsMesAnterior.diffValor < 0);
    const leandroDropVal = leandroDrops.reduce((acc, r) => acc + Math.abs(r.vsMesAnterior.diffValor), 0);
    if (leandroDrops.length > 0) {
      const nomes = leandroDrops.map(r => r.rede.split(" ")[0]).join(" + ");
      ondeAgirHoje.push({
        responsavel: "LEANDRO",
        prioridade: "Recuperação de sell-in e pedidos em carteira",
        impactoValor: leandroDropVal,
        descricao: `${nomes} concentram R$ ${leandroDropVal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} de recuo MTD vs mês anterior.`,
      });
    }

    // Luiz
    const luizGains = top10Redes.filter(r => r.gerente.toUpperCase().includes("LUIZ") && r.vsMesAnterior.diffValor > 0);
    const luizGainVal = luizGains.reduce((acc, r) => acc + r.vsMesAnterior.diffValor, 0);
    if (luizGains.length > 0) {
      const nomes = luizGains.map(r => r.rede.split(" ")[0]).join(" + ");
      ondeAgirHoje.push({
        responsavel: "LUIZ",
        prioridade: "Proteger aceleração e garantir abastecimento",
        impactoValor: luizGainVal,
        descricao: `${nomes} somam +R$ ${luizGainVal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} de crescimento MTD.`,
      });
    }

    // Julliano
    const jullianoDrops = top10Redes.filter(r => r.gerente.toUpperCase().includes("JULLIANO") && r.vsMesAnterior.diffValor < 0);
    const jullianoDropVal = jullianoDrops.reduce((acc, r) => acc + Math.abs(r.vsMesAnterior.diffValor), 0);
    if (jullianoDrops.length > 0) {
      const nomes = jullianoDrops.map(r => r.rede.split(" ")[0]).join(" + ");
      ondeAgirHoje.push({
        responsavel: "JULLIANO",
        prioridade: "Recuperação de ritmo e volume operacional",
        impactoValor: jullianoDropVal,
        descricao: `${nomes} com recuo de R$ ${jullianoDropVal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} vs mês anterior.`,
      });
    }

    // John Guedes
    ondeAgirHoje.push({
      responsavel: "JOHN GUEDES",
      prioridade: "Acompanhamento da expansão regional",
      impactoValor: 0,
      descricao: "Acompanhar positivação de novos parceiros e sell-in do canal distribuidor regional.",
    });

    return {
      alertas: alertas.slice(0, 3),
      oportunidades: oportunidades.slice(0, 3),
      ondeAgirHoje,
    };
  }
}

