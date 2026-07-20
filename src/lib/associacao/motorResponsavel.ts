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
 * Avalia as regras comerciais em ordem de prioridade sobre os dados do cliente correspondido.
 */
export function avaliarRegrasComerciais(
  matchedRecord: any,
  origem: 'base_atendimento' | 'cm_faturamento',
  regras: ResponsavelRegra[]
): RuleEvaluationResult | null {
  // If matched from base_atendimento and base_atendimento has a manager defined,
  // that is the official manager! We should prioritize this and bypass further rules,
  // unless there is a specific rule mapping it.
  // Wait, let's verify if there is an official manager from base_atendimento.
  if (origem === 'base_atendimento' && matchedRecord.manager) {
    // Check if there is an active rule that matches first, but if not, we return this manager.
    // Let's first search rules.
  }

  // Filter and sort active rules by priority
  const activeRegras = regras
    .filter(r => r.ativo)
    .sort((a, b) => a.prioridade - b.prioridade);

  for (const regra of activeRegras) {
    const campo = regra.campo_origem;
    // Get value from matchedRecord (could be f.nome_vendedor or b.canal or b.manager)
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

  // Fallback: If no rule matched, but base_atendimento had a manager, use that!
  if (origem === 'base_atendimento' && matchedRecord.manager) {
    const dummyRegra: ResponsavelRegra = {
      id: 'fallback_manager',
      prioridade: 9999,
      tipo_regra: 'GERENTE',
      campo_origem: 'manager',
      operador: 'EQUALS',
      valor_origem: matchedRecord.manager,
      responsavel_resultado: matchedRecord.manager,
      ativo: true,
      observacao: 'Fallback para gerente da base de atendimento'
    };
    return {
      responsavelSugerido: matchedRecord.manager,
      regraAplicada: dummyRegra,
      motivo: `Gerente comercial oficial "${matchedRecord.manager}" encontrado na base de atendimento`
    };
  }

  return null;
}
