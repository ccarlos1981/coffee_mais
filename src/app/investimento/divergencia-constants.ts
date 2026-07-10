/**
 * Constantes de Divergência Operacional de Calendário (Trade Fase 2)
 * Arquivo sem "use server" — pode ser importado por qualquer módulo.
 */

export type MotivoDivergencia =
  | 'ATRASO_LOGISTICO'
  | 'ALTERACAO_REDE'
  | 'ALTERACAO_COMERCIAL'
  | 'PROBLEMA_OPERACIONAL_LOJA'
  | 'RUPTURA_ESTOQUE'
  | 'ALTERACAO_ENCARTE'
  | 'OUTROS';

export const MOTIVOS_DIVERGENCIA: Record<MotivoDivergencia, string> = {
  ATRASO_LOGISTICO:          'Atraso Logístico',
  ALTERACAO_REDE:            'Alteração da Rede',
  ALTERACAO_COMERCIAL:       'Alteração Comercial',
  PROBLEMA_OPERACIONAL_LOJA: 'Problema Operacional na Loja',
  RUPTURA_ESTOQUE:           'Ruptura de Estoque',
  ALTERACAO_ENCARTE:         'Alteração de Encarte',
  OUTROS:                    'Outros',
};
