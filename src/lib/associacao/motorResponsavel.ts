export interface ResponsavelRegra {
  id: string;
  prioridade: number;
  tipo_regra: string;
  campo_origem: string;
  operador: string;
  valor_origem: string;
  responsavel_resultado: string;
  ativo: boolean;
  observacao: string | null;
}

export interface RuleEvaluationResult {
  responsavelSugerido: string;
  regraAplicada: ResponsavelRegra;
  motivo: string;
}

/**
 * Camada 2 – Motor de Regras Comerciais
 * Avalia as regras comerciais respeitando estritamente a SSOT (base_atendimento).
 */
export function avaliarRegrasComerciais(
  matchedRecord: any,
  origem: 'base_atendimento' | 'cm_faturamento',
  regras: ResponsavelRegra[]
): RuleEvaluationResult | null {
  // PRIORIDADE 1 ABSOLUTA (SSOT): Se veio de base_atendimento e tem gerente, ele é soberano!
  if (origem === 'base_atendimento' && matchedRecord.manager) {
    const ssotRegra: ResponsavelRegra = {
      id: 'ssot_base_atendimento',
      prioridade: 1,
      tipo_regra: 'GERENTE_SSOT',
      campo_origem: 'manager',
      operador: 'EQUALS',
      valor_origem: matchedRecord.manager,
      responsavel_resultado: matchedRecord.manager,
      ativo: true,
      observacao: 'Gerente oficial cadastrado na base de atendimento (SSOT)'
    };
    return {
      responsavelSugerido: matchedRecord.manager,
      regraAplicada: ssotRegra,
      motivo: `Gerente comercial oficial "${matchedRecord.manager}" homologado na base de atendimento (SSOT)`
    };
  }

  // Apenas para registros que NÃO possuem gerente definido em base_atendimento:
  const activeRegras = regras
    .filter(r => r.ativo)
    .sort((a, b) => a.prioridade - b.prioridade);

  for (const regra of activeRegras) {
    const campo = regra.campo_origem;
    const valorCampoRaw = matchedRecord[campo];
    if (valorCampoRaw === undefined || valorCampoRaw === null) {
      continue;
    }

    const valorCampo = String(valorCampoRaw).trim().toUpperCase();
    const valorOrigem = regra.valor_origem.trim().toUpperCase();
    let matches = false;

    switch (regra.operador.toUpperCase()) {
      case 'EQUALS':
        matches = (valorCampo === valorOrigem);
        break;
      case 'PREFIX':
        matches = valorCampo.startsWith(valorOrigem);
        break;
      case 'CONTAINS':
        matches = valorCampo.includes(valorOrigem);
        break;
      case 'REGEX':
        try {
          const regex = new RegExp(regra.valor_origem, 'i');
          matches = regex.test(String(valorCampoRaw));
        } catch (e) {
          console.error(`Erro ao processar regex para regra #${regra.id}:`, e);
        }
        break;
      default:
        console.warn(`Operador desconhecido: ${regra.operador}`);
    }

    if (matches) {
      const motivo = `Mapeamento ${regra.tipo_regra} = "${regra.valor_origem}" correspondente ao campo "${campo}" (${valorCampoRaw})`;
      return {
        responsavelSugerido: regra.responsavel_resultado,
        regraAplicada: regra,
        motivo
      };
    }
  }

  return null;
}
