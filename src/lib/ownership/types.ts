/**
 * Types para a Camada de Ownership Comercial (SSOT) — Coffee++
 * 
 * Regra Arquitetural:
 * - CommercialOwnership: Dados cadastrais soberanos do PDV (SSOT: public.base_atendimento).
 * - TransactionSalesClassification: Classificação operacional da transação (cm_faturamento).
 * 
 * @see Demanda 025 (Baseline Permanente)
 */

export interface CommercialOwnership {
  cod_parceiro: string;
  nome_parceiro: string;
  cnpj?: string | null;
  rede: string | null;
  canal: string | null;
  manager: string | null;
  manager_id: string | null;
  uf: string | null;
  regional: string | null;
  status: 'ativo' | 'pendente' | 'inativo' | string;
  ka?: string | boolean | null;
  is_star?: boolean;
}

export type TransactionChannelType = 
  | 'Ecommerce' 
  | 'Marketplace' 
  | 'Distribuidor' 
  | 'Amazon 1P' 
  | 'Comercial B2B';

export interface TransactionSalesClassification {
  nome_vendedor: string | null;
  centro_resultado: string | null;
  cod_top: string | null;
  transaction_channel_type: TransactionChannelType;
  is_d2c: boolean;
}

export interface OwnershipBatchStats {
  total_requested: number;
  found_in_cache: number;
  fetched_from_db: number;
  unmapped_count: number;
  duration_ms: number;
}
