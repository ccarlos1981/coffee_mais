/**
 * ==============================================================================
 * COFFEE++ — MOTOR CANÔNICO DE APURAÇÃO FINANCEIRA (INVESTIMENTOS)
 * Baseline: BASELINE_INVESTIMENTOS_GATE_5_17_F2
 * Single Source of Truth para Resolução de Verba e Cálculo Realizado
 * ==============================================================================
 */

export type ModalidadeApuracao = 
  | 'FIXA' 
  | 'UNITARIA_CANONICA' 
  | 'MULTIPLOS_DETALHES_AMBIGUOS' 
  | 'SEM_VERBA';

export interface ApuracaoCalculoResultado {
  podeCalcularAutomatico: boolean;
  valorAutomatico: number | null;
  verbaUnitaria: number | null;
  taxaUnitaria?: number | null;
  isVerbaFixa: boolean;
  modalidadeFixa?: boolean;
  tipoModalidade: ModalidadeApuracao;
  descricaoVerba: string;
  motivoExigenciaEfetivo?: string;
}

export interface DeltaApuracaoResultado {
  delta: number;
  percentual: number;
  tipo: 'MAIOR' | 'MENOR' | 'IGUAL';
  formatado: string;
}

/**
 * Valida se a modalidade da ação é oficialmente reconhecida como Verba Fixa.
 * Não multiplica por quantidade vendida.
 */
export function isModalidadeVerbaFixa(acao: any): boolean {
  if (!acao) return false;

  const tipoAcaoDetalhe = String(acao.tipo_acao_detalhe || '').trim().toLowerCase();
  const tipoAcao = String(acao.tipo_acao || '').trim().toLowerCase();
  const abrangencia = String(acao.abrangencia || '').trim().toLowerCase();
  const familiaProduto = String(acao.familia_produto || '').trim().toLowerCase();
  const tipoAniversario = String(acao.tipo_aniversario || '').trim().toLowerCase();

  // 1. Pagamento Único
  if (
    tipoAcao === 'pagamento único' ||
    tipoAcao === 'pagamento unico' ||
    tipoAcaoDetalhe === 'pagamento único' ||
    tipoAcaoDetalhe === 'pagamento unico' ||
    abrangencia === 'pagamento único' ||
    abrangencia === 'pagamento unico' ||
    familiaProduto === 'pagamento único' ||
    familiaProduto === 'pagamento unico' ||
    tipoAniversario === 'pagamento único' ||
    tipoAniversario === 'pagamento unico'
  ) {
    return true;
  }

  // 2. Encarte
  if (tipoAcaoDetalhe === 'encarte' || tipoAcao === 'encarte') {
    return true;
  }

  // 3. Aniversário com abrangência Pagamento Único ou sem detalhamento de volume
  if (tipoAcaoDetalhe === 'aniversário' || tipoAcaoDetalhe === 'aniversario') {
    if (abrangencia === 'pagamento único' || abrangencia === 'pagamento unico') {
      return true;
    }
  }

  return false;
}

/**
 * Analisa a estrutura de uma ação e resolve de forma inequívoca a verba aplicável
 * e o cálculo automático correspondente para uma dada quantidade vendida.
 */
export function resolverApuracaoAcao(acao: any, qtdVendida?: number | null): ApuracaoCalculoResultado {
  const cleanQtd = qtdVendida !== null && qtdVendida !== undefined && !isNaN(Number(qtdVendida))
    ? Math.max(0, Number(qtdVendida))
    : null;

  const valorInvestimentoPlanejado = Number(acao?.valor_investimento) || 0;
  const expectativaVolumePlanejado = Number(acao?.expectativa_volume) || 0;

  // 1. Caso Sem Verba
  if (valorInvestimentoPlanejado <= 0) {
    return {
      podeCalcularAutomatico: true,
      valorAutomatico: 0,
      verbaUnitaria: 0,
      isVerbaFixa: false,
      tipoModalidade: 'SEM_VERBA',
      descricaoVerba: 'Ação sem verba prevista (R$ 0,00)'
    };
  }

  // 2. Caso Verba Fixa (Modalidades Oficiais: Pagamento Único, Encarte, Aniversário Pagamento Único)
  if (isModalidadeVerbaFixa(acao)) {
    return {
      podeCalcularAutomatico: true,
      valorAutomatico: valorInvestimentoPlanejado,
      verbaUnitaria: null,
      taxaUnitaria: null,
      isVerbaFixa: true,
      modalidadeFixa: true,
      tipoModalidade: 'FIXA',
      descricaoVerba: 'Verba Fixa (R$ ' + valorInvestimentoPlanejado.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ')'
    };
  }

  // 3. Extrair detalhes granulares (famílias ou SKUs)
  const familias: any[] = Array.isArray(acao?.familias_detalhes) ? acao.familias_detalhes : [];
  const skus: any[] = Array.isArray(acao?.skus_detalhes) ? acao.skus_detalhes : [];
  const todosDetalhes = [...familias, ...skus].filter(item => item && (item.investimento !== undefined || item.expectativa_volume !== undefined));

  if (todosDetalhes.length > 0) {
    // Obter todas as taxas de investimento dos itens
    const taxasUnitarias = todosDetalhes
      .map(item => Number(item.investimento))
      .filter(inv => !isNaN(inv) && inv >= 0);

    const taxasDistintas = Array.from(new Set(taxasUnitarias.map(t => Math.round(t * 100) / 100)));

    // Caso A: Mais de um item COM TAXAS UNITÁRIAS DIVERGENTES
    if (taxasDistintas.length > 1) {
      return {
        podeCalcularAutomatico: false,
        valorAutomatico: null,
        verbaUnitaria: null,
        isVerbaFixa: false,
        tipoModalidade: 'MULTIPLOS_DETALHES_AMBIGUOS',
        descricaoVerba: 'Múltiplos itens com verbas divergentes',
        motivoExigenciaEfetivo: 'Esta ação possui múltiplos itens com verbas unitárias distintas. Como o volume informado é consolidado, não é possível calcular automaticamente o valor sem inventar rateio. Por favor, informe o Valor Efetivamente Gasto.'
      };
    }

    // Caso B: Detalhe único ou todos os itens possuem exatamente a mesma taxa unitária
    if (taxasDistintas.length === 1 && taxasDistintas[0] > 0) {
      const verbaUnitaria = taxasDistintas[0];
      const valorAuto = cleanQtd !== null
        ? Math.round(cleanQtd * verbaUnitaria * 100) / 100
        : null;

      return {
        podeCalcularAutomatico: true,
        valorAutomatico: valorAuto,
        verbaUnitaria,
        taxaUnitaria: verbaUnitaria,
        isVerbaFixa: false,
        tipoModalidade: 'UNITARIA_CANONICA',
        descricaoVerba: 'R$ ' + verbaUnitaria.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' / un'
      };
    }
  }

  // 4. Caso Derivável Sem Detalhes (Relação Canônica: valor_investimento / expectativa_volume)
  if (expectativaVolumePlanejado > 0 && valorInvestimentoPlanejado > 0) {
    const verbaUnitaria = Math.round((valorInvestimentoPlanejado / expectativaVolumePlanejado) * 10000) / 10000;
    const valorAuto = cleanQtd !== null
      ? Math.round(cleanQtd * verbaUnitaria * 100) / 100
      : null;

    return {
      podeCalcularAutomatico: true,
      valorAutomatico: valorAuto,
      verbaUnitaria,
      taxaUnitaria: verbaUnitaria,
      isVerbaFixa: false,
      tipoModalidade: 'UNITARIA_CANONICA',
      descricaoVerba: 'R$ ' + verbaUnitaria.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' / un'
    };
  }

  // 5. Fallback Seguro: Ação com valor sem volume determinável
  return {
    podeCalcularAutomatico: false,
    valorAutomatico: null,
    verbaUnitaria: null,
    isVerbaFixa: false,
    tipoModalidade: 'MULTIPLOS_DETALHES_AMBIGUOS',
    descricaoVerba: 'Orçamento Total: R$ ' + valorInvestimentoPlanejado.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    motivoExigenciaEfetivo: 'Não foi possível determinar a verba unitária da ação. Por favor, informe o Valor Efetivamente Gasto.'
  };
}

/**
 * Calcula a variação (Delta) entre o valor financeiro realizado e o valor orçado/planejado.
 */
export function calcularDeltaApuracao(
  valorRealizado: number | null | undefined, 
  valorPlanejado: number | null | undefined
): DeltaApuracaoResultado | null {
  if (valorRealizado === null || valorRealizado === undefined || isNaN(Number(valorRealizado))) {
    return null;
  }
  const real = Number(valorRealizado);
  const plan = Number(valorPlanejado) || 0;

  const delta = Math.round((real - plan) * 100) / 100;
  const percentual = plan > 0 ? Math.round((delta / plan) * 10000) / 100 : 0;

  const tipo: 'MAIOR' | 'MENOR' | 'IGUAL' = delta > 0.005 ? 'MAIOR' : delta < -0.005 ? 'MENOR' : 'IGUAL';

  const formatado = (delta > 0 ? '+R$ ' : '-R$ ') + 
    Math.abs(delta).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) +
    ' (' + (delta > 0 ? '+' : '') + percentual.toFixed(1).replace('.', ',') + '%)';

  return {
    delta,
    percentual,
    tipo,
    formatado: tipo === 'IGUAL' ? 'R$ 0,00 (0,0%)' : formatado
  };
}
