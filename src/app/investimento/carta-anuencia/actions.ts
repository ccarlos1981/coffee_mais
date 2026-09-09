"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireApprovedProfile, requireRole } from "@/lib/supabase/auth-helpers";
import { AnalyticsEngine } from "@/lib/governance/analytics/engine";
import { revalidatePath } from "next/cache";
import { getStoragePublicUrl } from "@/lib/storage-helpers";
import { calculateBufferHash, getImageDimensionsFromBuffer } from "@/lib/server-image-helpers";
import { calcularValidadeCartaAnuencia, verificarCartaExpirada } from "./validade-helper";

const CARTA_ANUENCIA_ALLOWED_ROLES = [
  "Trade",
  "Admin",
  "Admin Master",
  "Financeiro",
  "CEO",
  "Diretor",
  "Gerente Regional",
  "Gerente Nacional",
  "TI",
];

async function safeInsertAuditLog(adminClient: any, logData: {
  user_id?: string | null;
  action: string;
  table_name: string;
  old_data?: any;
  new_data?: any;
}) {
  try {
    await adminClient.from("cm_audit_logs").insert(logData);
  } catch (err) {
    console.error("Aviso: Falha ao registrar log de auditoria em cm_audit_logs:", err);
  }
}

export interface CartaAnuenciaItem {
  id: string;
  numero_carta: string;
  versao: number;
  carta_origem_id?: string | null;
  rede_id: string;
  rede_nome: string;
  cnpj?: string | null;
  competencia_id?: string | null;
  competencia: string;
  data_emissao: string;
  data_assinatura?: string | null;
  validade_ate?: string | null;
  status: "PENDENTE" | "EMITIDA" | "ENVIADA" | "ASSINADA" | "CANCELADA";
  logo_id?: string | null;
  logo_snapshot_path?: string | null;
  logo_rede_url?: string | null;
  logo_coffee_url?: string | null;
  pdf_url?: string | null;
  arquivo_assinado_url?: string | null;
  usuario_emissao?: string | null;
  usuario_emissao_nome?: string | null;
  usuario_assinatura?: string | null;
  usuario_assinatura_nome?: string | null;
  observacoes?: string | null;
  assinatura_metodo?: string | null;
  assinatura_hash?: string | null;
  assinatura_protocolo?: string | null;
  qr_code_hash?: string | null;
  created_at: string;
  updated_at: string;
  // Campos virtuais
  expirada?: boolean;
  gerente?: string | null;
  uf?: string | null;
}

export interface CompetenciaItem {
  id: string;
  competencia: string;
  data_inicio: string;
  data_fim: string;
  encerrada: boolean;
}

export interface TimelineItem {
  id: string;
  carta_id: string;
  evento: string;
  canal?: string | null;
  detalhes?: any;
  usuario_id?: string | null;
  usuario_nome?: string | null;
  created_at: string;
}

export interface FarolItem {
  rede: string;
  manager: string | null;
  uf: string | null;
  channel: string | null;
  media_mensal: number;
  total_fat_12m: number;
  meses_com_venda: number;
  carta_atual?: CartaAnuenciaItem | null;
  farol_status: "VERDE" | "AMARELO" | "VERMELHO";
  possui_carta_assinada: boolean;
}

export interface FarolGerencialRedeItem {
  rede: string;
  manager: string;
  regional: string;
  uf: string | null;
  codigo_matriz: string;
  possui_carta: boolean;
  status_farol_rede: "COM_CARTA" | "SEM_CARTA";
  faturamento_medio_3m?: number;
  carta?: CartaAnuenciaItem | null;
}

export interface FarolGerencialGerenteItem {
  id: string;
  gerente: string;
  regional: string;
  esperadas: number;
  no_sistema: number;
  faltantes: number;
  cobertura_pct: number;
  status_farol: "VERDE" | "AMARELO" | "LARANJA" | "VERMELHO";
  // Métricas do Ranking de Assinatura (mutuamente exclusivas):
  total_cartas?: number;
  cartas_para_assinar: number;
  cartas_assinadas: number;
  pct_cartas_assinadas: number;
  redes: FarolGerencialRedeItem[];
}

export interface FarolGerencialRankingItem {
  posicao: number;
  gerente: string;
  total_cartas: number;
  cartas_para_assinar: number;
  cartas_assinadas: number;
  pct_cartas_assinadas: number;
}

export interface FarolGerencialRegionalItem {
  id: string;
  regional: string;
  gerente: string;
  esperadas: number;
  no_sistema: number;
  faltantes: number;
  cobertura_pct: number;
  status_farol: "VERDE" | "AMARELO" | "LARANJA" | "VERMELHO";
  redes: FarolGerencialRedeItem[];
}

export interface FarolGerencialResumo {
  total_esperadas: number;
  total_no_sistema: number;
  total_faltantes: number;
  cobertura_geral_pct: number;
  status_farol_geral: "VERDE" | "AMARELO" | "LARANJA" | "VERMELHO";
  competencia: string;
  competencias_disponiveis: CompetenciaItem[];
  gerentes: FarolGerencialGerenteItem[];
  ranking_assinatura: FarolGerencialRankingItem[];
  regionais: FarolGerencialRegionalItem[];
  is_gerente_regional: boolean;
  gerente_logado?: string;
  is_admin?: boolean;
  total_overrides_ativos?: number;
}

export interface LogoRedeItem {
  id: string;
  rede_id: string;
  storage_path: string;
  logo_url?: string | null;
  hash?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  origem?: string | null;
  validada?: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

/**
 * 1. Obter Competências Parametrizadas
 */
export async function obterCompetencias(): Promise<CompetenciaItem[]> {
  const user = await requireAuth();
  await requireApprovedProfile(user.id);

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("cm_competencias_anuencia")
    .select("*")
    .order("data_inicio", { ascending: false });

  if (error) {
    console.error("Erro ao obter competências:", error);
    return [];
  }
  return data || [];
}

export async function criarCompetencia(input: {
  competencia: string;
  data_inicio: string;
  data_fim: string;
}) {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);
  requireRole(profile, ["Trade", "Admin", "Admin Master", "CEO"]);

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("cm_competencias_anuencia")
    .insert({
      competencia: input.competencia,
      data_inicio: input.data_inicio,
      data_fim: input.data_fim,
      encerrada: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao cadastrar competência: ${error.message}`);
  }

  revalidatePath("/investimento/carta-anuencia");
  return data;
}

/**
 * 2. Gestão da Logo Oficial Vigente da Rede (cm_logos_redes)
 * Mantém exatamente UM registro único vigente por rede_id para acesso direto por todos os módulos.
 */
export async function obterLogoOficialRede(redeId: string): Promise<LogoRedeItem | null> {
  if (!redeId) return null;
  const user = await requireAuth();
  await requireApprovedProfile(user.id);

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("cm_logos_redes")
    .select("*")
    .eq("rede_id", redeId)
    .maybeSingle();

  if (error) {
    console.error(`Erro ao obter logo oficial vigente da rede ${redeId}:`, error);
    return null;
  }

  return data || null;
}

/**
 * 2.1 Processamento Seguro Server-Side de Upload de Logo
 */
export async function processarEUploadLogoRede(formData: FormData): Promise<{
  storage_path: string;
  logoRecord: LogoRedeItem;
}> {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);
  requireRole(profile, CARTA_ANUENCIA_ALLOWED_ROLES);

  const file = formData.get("file") as File | null;
  const redeId = formData.get("rede_id") as string | null;

  if (!file || !redeId) {
    throw new Error("Arquivo da logo ou ID da Rede não fornecido.");
  }

  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error("O arquivo excede o limite máximo permitido de 10MB.");
  }

  const ALLOWED_MIMES = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/svg+xml",
  ];
  const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
  const ALLOWED_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

  const isValidType = ALLOWED_MIMES.includes(file.type) || ALLOWED_EXTS.includes(ext);

  if (!isValidType) {
    throw new Error("Formato de arquivo inválido. Apenas PNG, JPG, JPEG, WEBP ou SVG são permitidos.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const hash = calculateBufferHash(buffer);
  const { width, height } = getImageDimensionsFromBuffer(buffer, file.type);

  // Geração do storage_path único (NUNCA sobrescreve fisicamente)
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const storagePath = `${redeId}/${Date.now()}_${cleanFileName}`;

  const adminClient = createAdminClient();
  const { error: uploadErr } = await adminClient.storage
    .from("logos-redes")
    .upload(storagePath, buffer, {
      contentType: file.type || "image/png",
      upsert: true,
    });

  if (uploadErr) {
    throw new Error(`Erro ao gravar logo no Storage corporativo: ${uploadErr.message}`);
  }

  // Gravar no cadastro operacional (cm_logos_redes) e arquivar versão anterior em cm_logos_redes_historico
  const logoRecord = await salvarLogoOficialRede({
    redeId,
    storagePath,
    hash,
    mimeType: file.type,
    fileSize: file.size,
    width,
    height,
  });

  return {
    storage_path: storagePath,
    logoRecord,
  };
}

/**
 * 2.2 Salvar/Atualizar Cadastro Operacional (cm_logos_redes) + Arquivamento Histórico (cm_logos_redes_historico)
 * Separação completa entre a logo oficial vigente e a tabela dedicada de histórico.
 */
export async function salvarLogoOficialRede(input: {
  redeId: string;
  storagePath: string;
  hash?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  motivoAlteracao?: string;
}): Promise<LogoRedeItem> {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);
  requireRole(profile, CARTA_ANUENCIA_ALLOWED_ROLES);

  const adminClient = createAdminClient();

  // 1. Obter a logo operacional vigente atual da rede
  const logoAtual = await obterLogoOficialRede(input.redeId);

  // 2. Se já existir uma logo cadastrada, arquivar o registro anterior na tabela cm_logos_redes_historico
  if (logoAtual) {
    const { error: errHist } = await adminClient
      .from("cm_logos_redes_historico")
      .insert({
        logo_id: logoAtual.id,
        rede_id: logoAtual.rede_id,
        storage_path: logoAtual.storage_path || logoAtual.logo_url,
        hash: logoAtual.hash || null,
        mime_type: logoAtual.mime_type || null,
        file_size: logoAtual.file_size || null,
        width: logoAtual.width || null,
        height: logoAtual.height || null,
        motivo_alteracao: input.motivoAlteracao || "Atualização da logo oficial da rede",
        created_at: logoAtual.updated_at || logoAtual.created_at,
        created_by: logoAtual.updated_by || logoAtual.created_by || user?.id || null,
      });

    if (errHist) {
      console.error("Aviso: Falha ao arquivar histórico da logo anterior:", errHist);
    }
  }

  let resultRecord: LogoRedeItem;
  const agora = new Date().toISOString();

  // 3. Atualizar ou Inserir o único registro vigente em cm_logos_redes
  if (logoAtual) {
    const { data, error } = await adminClient
      .from("cm_logos_redes")
      .update({
        storage_path: input.storagePath,
        logo_url: input.storagePath,
        hash: input.hash || null,
        mime_type: input.mimeType || null,
        file_size: input.fileSize || null,
        width: input.width || null,
        height: input.height || null,
        updated_at: agora,
        updated_by: user?.id || null,
      })
      .eq("id", logoAtual.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar logo oficial da rede: ${error.message}`);
    }
    resultRecord = data;
  } else {
    const { data, error } = await adminClient
      .from("cm_logos_redes")
      .insert({
        rede_id: input.redeId,
        storage_path: input.storagePath,
        logo_url: input.storagePath,
        hash: input.hash || null,
        mime_type: input.mimeType || null,
        file_size: input.fileSize || null,
        width: input.width || null,
        height: input.height || null,
        origem: "MANUAL",
        validada: true,
        created_by: user?.id || null,
        updated_by: user?.id || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao cadastrar logo oficial da rede: ${error.message}`);
    }
    resultRecord = data;
  }

  // 4. Auditoria Corporativa em cm_audit_logs
  await safeInsertAuditLog(adminClient, {
    user_id: user?.id || null,
    action: "Atualização Logo Oficial da Rede (Histórico Arquivado)",
    table_name: "cm_logos_redes",
    old_data: {
      rede_id: input.redeId,
      logo_anterior_id: logoAtual?.id || null,
      logo_anterior_storage_path: logoAtual?.storage_path || logoAtual?.logo_url || null,
    },
    new_data: {
      rede_id: input.redeId,
      logo_nova_id: resultRecord.id,
      storage_path: input.storagePath,
      hash: input.hash || null,
      mime_type: input.mimeType || null,
      file_size: input.fileSize || null,
      width: input.width || null,
      height: input.height || null,
    },
  });

  return resultRecord;
}

/**
 * 2.3 Rotina de Limpeza Controlada de Logos Históricas Órfãs
 * Avalia apenas registros em cm_logos_redes_historico que NÃO são a logo ativa em cm_logos_redes
 * e NÃO estão referenciados em NENHUMA Carta de Anuência (logo_snapshot_path).
 */
export async function executarLimpezaLogosOrfas(): Promise<{
  removidos: number;
  protegidosSnapshot: number;
  erros: string[];
}> {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);
  requireRole(profile, ["Admin", "Admin Master"]);

  const adminClient = createAdminClient();

  const { data: orfas, error: errRpc } = await adminClient.rpc("fn_listar_logos_obsoletas_orfas");

  if (errRpc) {
    throw new Error(`Erro ao listar logos obsoletas órfãs: ${errRpc.message}`);
  }

  let removidos = 0;
  let protegidosSnapshot = 0;
  const erros: string[] = [];

  for (const item of (orfas || [])) {
    // 1. Checagem de segurança se está ativa em cm_logos_redes
    const { count: isAtiva } = await adminClient
      .from("cm_logos_redes")
      .select("*", { count: "exact", head: true })
      .eq("storage_path", item.storage_path);

    if (isAtiva && isAtiva > 0) {
      protegidosSnapshot++;
      continue;
    }

    // 2. Checagem de segurança se está em snapshot de alguma Carta de Anuência
    const { count: isSnapshot } = await adminClient
      .from("cm_cartas_anuencia")
      .select("*", { count: "exact", head: true })
      .eq("logo_snapshot_path", item.storage_path);

    if (isSnapshot && isSnapshot > 0) {
      protegidosSnapshot++;
      continue;
    }

    // Remover fisicamente do Storage
    const { error: errRemoveStorage } = await adminClient.storage
      .from("logos-redes")
      .remove([item.storage_path]);

    if (errRemoveStorage) {
      erros.push(`Falha ao remover arquivo ${item.storage_path} do Storage: ${errRemoveStorage.message}`);
      continue;
    }

    // Remover registro da tabela de histórico
    await adminClient
      .from("cm_logos_redes_historico")
      .delete()
      .eq("id", item.historico_id);

    removidos++;
  }

  await safeInsertAuditLog(adminClient, {
    user_id: user?.id || null,
    action: "Limpeza Controlada de Logos Históricas Órfãs",
    table_name: "cm_logos_redes_historico",
    new_data: {
      removidos,
      protegidosSnapshot,
      erros,
    },
  });

  return { removidos, protegidosSnapshot, erros };
}

// ---------------------------------------------------------------------------
// Helper interno: carrega metadados de redes com índice duplo
// (por nome canônico da view + por rede_nome da carta) para resolução
// robusta de gerente e UF independente de aliasing.
// ---------------------------------------------------------------------------
async function obterMetadadosRedesComCodigo(): Promise<{
  byNome: Map<string, { manager: string | null; uf: string | null }>;
}> {
  let redesMeta: { rede: string; manager: string | null; uf: string | null }[] = [];
  try {
    redesMeta = (await AnalyticsEngine.getMapeamentoRedesMeta()) || [];
  } catch (err) {
    console.error("[carta-anuencia] Aviso: Falha ao obter metadados de redes:", err);
  }

  const byNome = new Map<string, { manager: string | null; uf: string | null }>();

  redesMeta.forEach((row) => {
    if (!row.rede) return;
    const meta = { manager: row.manager || null, uf: row.uf || null };

    // Índice por nome completo da view (ex: "ZAFFARI (RS)", "DUFRY", "SUPER ADEGA")
    const keyFull = row.rede.toLowerCase().trim();
    if (!byNome.has(keyFull)) byNome.set(keyFull, meta);

    // Índice por nome base sem sufixo de UF (ex: "ZAFFARI", "BIG LAR")
    // Útil para cartas antigas que gravaram o nome sem o sufixo " (RS)"
    const keyBase = keyFull.replace(/\s*\([^)]+\)\s*$/, "").trim();
    if (keyBase && keyBase !== keyFull && !byNome.has(keyBase)) {
      byNome.set(keyBase, meta);
    }
  });

  return { byNome };
}

// ---------------------------------------------------------------------------
// Helper interno: resolve carteira do gerente logado para RBAC de escopo.
// Retorna null se o usuário não for Gerente Regional (= visão nacional).
// ---------------------------------------------------------------------------
async function resolverCarteiraGerente(adminClient: ReturnType<typeof createAdminClient>, profile: { role?: string | null; name?: string | null; manager_name?: string | null }): Promise<Set<string> | null> {
  if (profile?.role !== "Gerente Regional") return null;

  const gerenteName = profile.manager_name || profile.name || null;
  if (!gerenteName) return new Set<string>(); // gerente sem nome → carteira vazia (seguro)

  // Buscar os rede_ids das cartas sob responsabilidade do gerente
  // via cm_clientes (fonte oficial de ownership comercial)
  const { data: clientes } = await adminClient
    .from("cm_clientes")
    .select("codigo_matriz")
    .eq("manager_name", gerenteName);

  const codigos = new Set<string>(
    (clientes || [])
      .map((c) => String(c.codigo_matriz || "").trim())
      .filter(Boolean)
  );
  return codigos;
}

// ---------------------------------------------------------------------------
// Helper interno: valida se um rede_id pertence à carteira do gerente logado.
// Retorna true se carteiraGerente for null (visão nacional / Admin).
// ---------------------------------------------------------------------------
function validarAcessoRede(carteiraGerente: Set<string> | null, redeId: string | null | undefined): boolean {
  if (carteiraGerente === null) return true; // Admin / visão nacional
  if (!redeId) return false;
  const idStr = String(redeId).trim();
  const idBase = idStr.replace(/\.\d+$/, "").trim();
  return carteiraGerente.has(idStr) || carteiraGerente.has(idBase);
}

/**
 * 3. Listar Cartas de Anuência
 */
export async function listarCartasAnuencia(filters?: {
  status?: string;
  rede_id?: string;
  competencia?: string;
  gerente?: string;
  uf?: string;
  busca?: string;
}): Promise<CartaAnuenciaItem[]> {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);

  const adminClient = createAdminClient();

  // RBAC: resolver carteira do gerente antes de montar a query
  const carteiraGerente = await resolverCarteiraGerente(adminClient, profile);

  let query = adminClient.from("cm_cartas_anuencia").select("*").order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "TODAS") {
    query = query.eq("status", filters.status);
  }
  if (filters?.rede_id) {
    query = query.eq("rede_id", filters.rede_id);
  }
  if (filters?.competencia) {
    query = query.eq("competencia", filters.competencia);
  }
  if (filters?.busca) {
    const search = `%${filters.busca}%`;
    query = query.or(`numero_carta.ilike.${search},rede_nome.ilike.${search},cnpj.ilike.${search}`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Erro ao listar cartas de anuência:", error);
    return [];
  }

  // Obter metadados de redes com índice duplo (nome completo + nome base)
  const { byNome: metaMap } = await obterMetadadosRedesComCodigo();

  let result = (data || []).map((item) => {
    // Tentar resolver por nome completo primeiro, depois por nome base
    const keyFull = (item.rede_nome || "").toLowerCase().trim();
    const keyId   = (item.rede_id || "").toLowerCase().trim();
    const meta = metaMap.get(keyFull) || metaMap.get(keyId) || { manager: null, uf: null };
    const expirada = verificarCartaExpirada(item.validade_ate);

    const dynamicLogoUrl = getStoragePublicUrl(item.logo_snapshot_path || item.logo_rede_url, "logos-redes");

    return {
      ...item,
      logo_rede_url: dynamicLogoUrl,
      gerente: meta.manager,
      uf: meta.uf,
      expirada,
    };
  });

  // Filtro de gerente solicitado via parâmetro
  if (filters?.gerente && filters.gerente !== "TODOS") {
    result = result.filter((c) => c.gerente === filters.gerente);
  }
  if (filters?.uf && filters.uf !== "TODAS") {
    result = result.filter((c) => c.uf === filters.uf);
  }

  // RBAC: restringir pela carteira do gerente logado (server-side)
  if (carteiraGerente !== null) {
    // Normalizar o rede_id da carta para comparar com os codigos_matriz do cm_clientes
    // O rede_id pode ter sufixo como ".0", ".1", ".2" — remover para match com codigo_matriz
    result = result.filter((c) => {
      const redeIdBase = String(c.rede_id || "").replace(/\.\d+$/, "").trim();
      return carteiraGerente.has(redeIdBase) || carteiraGerente.has(String(c.rede_id || "").trim());
    });
  }

  return result;
}

export async function obterFiltrosGerenteUf() {
  try {
    return await AnalyticsEngine.getFiltrosGerenteUf();
  } catch (err) {
    console.error("Aviso: Falha ao obter filtros de Gerente e UF do AnalyticsEngine:", err);
    return { gerentes: [], ufs: [] };
  }
}

/**
 * 4. Resumo Executivo / KPIs
 *
 * Definições Semânticas Corretas:
 * - totalCartas: todas as cartas não canceladas
 * - emitidas: cartas geradas e disponíveis (EMITIDA + ENVIADA + ASSINADA)
 * - pendentes: cartas que AGUARDAM assinatura (EMITIDA + ENVIADA + PENDENTE)
 * - assinadasVigentes: ASSINADA e dentro da validade
 * - assinadasExpiradas: ASSINADA mas com validade vencida
 * - canceladas: cartas canceladas
 */
export async function obterResumoDashboard() {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);

  const adminClient = createAdminClient();

  // RBAC: resolver carteira do gerente
  const carteiraGerente = await resolverCarteiraGerente(adminClient, profile);

  let cartasQuery = adminClient
    .from("cm_cartas_anuencia")
    .select("id, rede_id, status, data_emissao, data_assinatura, validade_ate");

  // Filtro de carteira para Gerente Regional
  if (carteiraGerente !== null) {
    const codigosList = Array.from(carteiraGerente);
    if (codigosList.length === 0) {
      // Gerente sem carteira: retorna zeros
      return { totalCartas: 0, emitidas: 0, pendentes: 0, assinadasVigentes: 0, assinadasExpiradas: 0, totalAssinadas: 0, canceladas: 0, tempoMedioAssinaturaDias: 0 };
    }
    // Filtrar por rede_id que começa com um dos codigos da carteira
    // (rede_id pode ter sufixo como .0, .1, .2)
    // Estratégia: buscar tudo e filtrar em memória (registros são poucos ~50)
  }

  const { data: cartas } = await cartasQuery;
  const cartasFiltradas = (cartas || []).filter((c) => {
    if (carteiraGerente === null) return true;
    const redeIdBase = String(c.rede_id || "").replace(/\.\d+$/, "").trim();
    return carteiraGerente.has(redeIdBase) || carteiraGerente.has(String(c.rede_id || "").trim());
  });

  let totalCartas = 0;
  let emitidas = 0;
  let pendentes = 0;
  let assinadasVigentes = 0;
  let assinadasExpiradas = 0;
  let canceladas = 0;
  let tempoTotalDias = 0;
  let totalAssinadasTempo = 0;

  cartasFiltradas.forEach((c) => {
    if (c.status === "CANCELADA") {
      canceladas++;
      return; // canceladas não entram nos demais KPIs
    }

    totalCartas++; // contar apenas não canceladas

    if (c.status === "ASSINADA") {
      // Assinada conta em emitidas (já foi gerada e assinada)
      emitidas++;
      const expirada = verificarCartaExpirada(c.validade_ate);
      if (expirada) {
        assinadasExpiradas++;
      } else {
        assinadasVigentes++;
      }
      if (c.data_emissao && c.data_assinatura) {
        const dtE = new Date(c.data_emissao).getTime();
        const dtA = new Date(c.data_assinatura).getTime();
        const diffDias = Math.max(0, Math.round((dtA - dtE) / (1000 * 60 * 60 * 24)));
        tempoTotalDias += diffDias;
        totalAssinadasTempo++;
      }
    } else if (c.status === "EMITIDA" || c.status === "ENVIADA" || c.status === "PENDENTE") {
      // Aguardam assinatura: conta em emitidas E em pendentes
      emitidas++;
      pendentes++;
    }
  });

  const tempoMedioAssinaturaDias = totalAssinadasTempo > 0 ? Math.round(tempoTotalDias / totalAssinadasTempo) : 0;

  return {
    totalCartas,
    emitidas,
    pendentes,
    assinadasVigentes,
    assinadasExpiradas,
    totalAssinadas: assinadasVigentes + assinadasExpiradas,
    canceladas,
    tempoMedioAssinaturaDias,
  };
}

/**
 * 5. Farol Executivo (> R$ 80k/mês)
 *
 * CORREÇÃO CRÍTICA: O bug anterior indexava cartasMap por rede_id (ex: "84906.0")
 * mas fazia o lookup pelo nome textual da rede da view (ex: "ZAFFARI (RS)").
 * Isso garantia que NENHUMA carta jamais era vinculada ao Farol.
 *
 * A correção indexa por MÚLTIPLAS chaves:
 *  1. rede_nome da carta (normalizado)
 *  2. rede_nome sem sufixo UF (ex: "ZAFFARI" → também busca "ZAFFARI (RS)")
 *  3. rede_id (código numérico, como fallback)
 */
export async function obterDadosFarolExecutivo(filters?: {
  manager?: string;
  uf?: string;
  channel?: string;
  competencia?: string;
}): Promise<FarolItem[]> {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);
  requireRole(profile, ["Trade", "Admin", "Admin Master", "Financeiro", "CEO", "Gerente Regional", "Gerente Nacional", "Diretor"]);

  // RBAC: aplicar filtro de gerente automaticamente se for Gerente Regional
  const adminClient = createAdminClient();
  const isGerenteRegional = profile?.role === "Gerente Regional";
  const gerenteFiltro = isGerenteRegional
    ? (profile.manager_name || profile.name || undefined)
    : filters?.manager;

  const redesAnalytics = await AnalyticsEngine.getFarolAnuenciaRedes({
    manager: gerenteFiltro,
    uf: filters?.uf,
    channel: filters?.channel,
    minMedia: 80000,
  });

  let cartasQuery = adminClient
    .from("cm_cartas_anuencia")
    .select("*")
    .neq("status", "CANCELADA")
    .order("created_at", { ascending: false });

  if (filters?.competencia) {
    cartasQuery = cartasQuery.eq("competencia", filters.competencia);
  }

  const { data: cartasAtivas } = await cartasQuery;

  // CORREÇÃO: indexar cartasMap por múltiplas chaves para cobrir todos os casos de aliasing
  const cartasMap = new Map<string, CartaAnuenciaItem>();

  (cartasAtivas || []).forEach((c) => {
    const cartaEnrichida: CartaAnuenciaItem = {
      ...c,
      logo_rede_url: getStoragePublicUrl(c.logo_snapshot_path || c.logo_rede_url, "logos-redes"),
      expirada: verificarCartaExpirada(c.validade_ate),
    };

    // Chave 1: rede_nome completo (ex: "dufry", "super adega", "big lar")
    const keyNome = (c.rede_nome || "").toLowerCase().trim();
    if (keyNome && !cartasMap.has(keyNome)) {
      cartasMap.set(keyNome, cartaEnrichida);
    }

    // Chave 2: rede_nome normalizado sem caracteres especiais (para "REDE OBA" → "oba", etc.)
    const keyNomeNorm = keyNome.replace(/^rede\s+/i, "").trim();
    if (keyNomeNorm && keyNomeNorm !== keyNome && !cartasMap.has(keyNomeNorm)) {
      cartasMap.set(keyNomeNorm, cartaEnrichida);
    }

    // Chave 3: rede_id numérico (ex: "84906.0", "31821.2")
    const keyId = (c.rede_id || "").toLowerCase().trim();
    if (keyId && !cartasMap.has(keyId)) {
      cartasMap.set(keyId, cartaEnrichida);
    }

    // Chave 4: rede_id sem sufixo decimal (ex: "84906", "31821")
    const keyIdBase = keyId.replace(/\.\d+$/, "").trim();
    if (keyIdBase && keyIdBase !== keyId && !cartasMap.has(keyIdBase)) {
      cartasMap.set(keyIdBase, cartaEnrichida);
    }
  });

  return redesAnalytics.map((r) => {
    // Tentar match por nome da rede da view (ex: "ZAFFARI (RS)")
    const keyView = (r.rede || "").toLowerCase().trim();
    // Tentar também sem sufixo UF (ex: "ZAFFARI")
    const keyBase = keyView.replace(/\s*\([^)]+\)\s*$/, "").trim();

    const carta = cartasMap.get(keyView) || cartasMap.get(keyBase) || null;

    let farol_status: "VERDE" | "AMARELO" | "VERMELHO" = "VERMELHO";
    let possui_carta_assinada = false;

    if (carta) {
      if (carta.status === "ASSINADA") {
        if (carta.expirada) {
          farol_status = "AMARELO";
          possui_carta_assinada = true;
        } else {
          farol_status = "VERDE";
          possui_carta_assinada = true;
        }
      } else {
        // Carta existe mas ainda não foi assinada
        farol_status = "AMARELO";
      }
    }

    return {
      rede: r.rede,
      manager: r.manager,
      uf: r.uf,
      channel: r.channel,
      media_mensal: r.media_mensal,
      total_fat_12m: r.total_fat_12m,
      meses_com_venda: r.meses_com_venda,
      carta_atual: carta,
      farol_status,
      possui_carta_assinada,
    };
  });
}

/**
 * 6. Gerar Nova Carta de Anuência (Snapshot Imutável)
 */
export async function gerarCartaAnuencia(input: {
  rede_id: string;
  rede_nome: string;
  cnpj?: string;
  competencia_id?: string;
  competencia: string;
  validade_ate?: string;
  storage_path?: string;
  observacoes?: string;
}) {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);
  requireRole(profile, CARTA_ANUENCIA_ALLOWED_ROLES);

  const adminClient = createAdminClient();

  // RBAC: validar se a rede pertence à carteira do gerente (quando aplicável)
  const carteiraGerente = await resolverCarteiraGerente(adminClient, profile);
  if (!validarAcessoRede(carteiraGerente, input.rede_id)) {
    throw new Error("403 Forbidden: Não autorizado a criar carta para rede fora de sua carteira regional.");
  }

  let userName = profile?.name || user.email || "Usuário do Sistema";

  const officialLogoRecord = await obterLogoOficialRede(input.rede_id);
  const finalSnapshotPath = input.storage_path || officialLogoRecord?.storage_path || null;

  const { data: cartaExistente } = await adminClient
    .from("cm_cartas_anuencia")
    .select("*")
    .eq("rede_id", input.rede_id)
    .eq("competencia", input.competencia)
    .neq("status", "CANCELADA")
    .order("versao", { ascending: false })
    .limit(1)
    .single();

  let novaVersao = 1;
  let cartaOrigemId: string | null = null;

  if (cartaExistente) {
    novaVersao = (cartaExistente.versao || 1) + 1;
    cartaOrigemId = cartaExistente.id;
  }

  let numeroCarta = "";
  const { data: rpcNumero, error: rpcErr } = await adminClient.rpc("fn_generate_numero_carta_anuencia");
  if (rpcErr || !rpcNumero) {
    const ano = new Date().getFullYear();
    const rand = Math.floor(100000 + Math.random() * 900000);
    numeroCarta = `CA-${ano}-${rand}`;
  } else {
    numeroCarta = rpcNumero;
  }

  const qrCodeHash = Buffer.from(`${numeroCarta}:${input.rede_id}:${input.competencia}:${Date.now()}`).toString("base64url");

  // Calcular validade oficial via helper da aplicação
  const validadeCalculada = calcularValidadeCartaAnuencia(input.competencia);
  const finalValidadeAte = validadeCalculada || input.validade_ate || null;

  const { data: novaCarta, error: errInsert } = await adminClient
    .from("cm_cartas_anuencia")
    .insert({
      numero_carta: numeroCarta,
      versao: novaVersao,
      carta_origem_id: cartaOrigemId,
      rede_id: input.rede_id,
      rede_nome: input.rede_nome,
      cnpj: input.cnpj || null,
      competencia_id: input.competencia_id || null,
      competencia: input.competencia,
      validade_ate: finalValidadeAte,
      status: "EMITIDA",
      logo_id: officialLogoRecord?.id || null,
      logo_snapshot_path: finalSnapshotPath,
      logo_coffee_url: "/images/logo_coffee_mais_official.svg",
      usuario_emissao: user.id,
      usuario_emissao_nome: userName,
      observacoes: input.observacoes || null,
      qr_code_hash: qrCodeHash,
    })
    .select()
    .single();

  if (errInsert) {
    if (errInsert.code === "23505") {
      throw new Error("Operação concorrente detectada para esta competência. Atualize a tela e tente novamente.");
    }
    throw new Error(`Erro ao gerar carta de anuência: ${errInsert.message}`);
  }

  await adminClient.from("cm_carta_anuencia_timeline").insert({
    carta_id: novaCarta.id,
    evento: "CRIADA",
    detalhes: {
      numero_carta: numeroCarta,
      versao: novaVersao,
      competencia: input.competencia,
      logo_snapshot_path: finalSnapshotPath,
    },
    usuario_id: user.id,
    usuario_nome: userName,
  });

  await safeInsertAuditLog(adminClient, {
    user_id: user.id,
    action: novaVersao > 1 ? "Reemissão Versão Carta Anuência" : "Emissão Carta Anuência",
    table_name: "cm_cartas_anuencia",
    new_data: {
      id: novaCarta.id,
      numero_carta: numeroCarta,
      versao: novaVersao,
      rede_nome: input.rede_nome,
      competencia: input.competencia,
      validade_ate: finalValidadeAte,
      logo_snapshot_path: finalSnapshotPath,
    },
  });

  revalidatePath("/investimento/carta-anuencia");
  return {
    ...novaCarta,
    logo_rede_url: getStoragePublicUrl(novaCarta.logo_snapshot_path, "logos-redes"),
  } as CartaAnuenciaItem;
}

/**
 * 6.1. Editar Carta de Anuência
 */
export async function editarCartaAnuencia(input: {
  carta_id: string;
  rede_id: string;
  rede_nome: string;
  cnpj?: string;
  competencia_id?: string;
  competencia: string;
  validade_ate?: string;
  storage_path?: string;
  observacoes?: string;
}) {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);
  requireRole(profile, CARTA_ANUENCIA_ALLOWED_ROLES);

  const adminClient = createAdminClient();

  const { data: cartaAtual, error: errFetch } = await adminClient
    .from("cm_cartas_anuencia")
    .select("*")
    .eq("id", input.carta_id)
    .single();

  if (errFetch || !cartaAtual) {
    throw new Error("Carta de Anuência não encontrada para edição.");
  }

  // RBAC: validar se a carta atual e a rede pertencem à carteira do gerente
  const carteiraGerente = await resolverCarteiraGerente(adminClient, profile);
  if (!validarAcessoRede(carteiraGerente, cartaAtual.rede_id)) {
    throw new Error("403 Forbidden: Não autorizado a editar carta pertencente a outra carteira regional.");
  }
  if (!validarAcessoRede(carteiraGerente, input.rede_id)) {
    throw new Error("403 Forbidden: Não autorizado a mover carta para rede fora de sua carteira regional.");
  }

  if (cartaAtual.status === "ASSINADA" || cartaAtual.status === "CANCELADA") {
    throw new Error(
      `Documento com status ${cartaAtual.status} é oficial e não pode ser editado. Para modificações, emita uma nova versão.`
    );
  }

  let userName = profile?.name || user.email || "Usuário do Sistema";

  const officialLogoRecord = await obterLogoOficialRede(input.rede_id);
  const finalSnapshotPath = input.storage_path || officialLogoRecord?.storage_path || cartaAtual.logo_snapshot_path;

  // Recalcular validade via helper da aplicação se a competência mudou
  const validadeCalculada = calcularValidadeCartaAnuencia(input.competencia);
  const finalValidadeAte = validadeCalculada || input.validade_ate || cartaAtual.validade_ate || null;

  const camposAlterados: Record<string, { de: any; para: any }> = {};

  if (cartaAtual.rede_id !== input.rede_id) camposAlterados.rede_id = { de: cartaAtual.rede_id, para: input.rede_id };
  if (cartaAtual.rede_nome !== input.rede_nome) camposAlterados.rede_nome = { de: cartaAtual.rede_nome, para: input.rede_nome };
  if ((cartaAtual.cnpj || "") !== (input.cnpj || "")) camposAlterados.cnpj = { de: cartaAtual.cnpj, para: input.cnpj };
  if (cartaAtual.competencia !== input.competencia) camposAlterados.competencia = { de: cartaAtual.competencia, para: input.competencia };
  if ((cartaAtual.validade_ate || "") !== (finalValidadeAte || "")) camposAlterados.validade_ate = { de: cartaAtual.validade_ate, para: finalValidadeAte };
  if ((cartaAtual.observacoes || "") !== (input.observacoes || "")) camposAlterados.observacoes = { de: cartaAtual.observacoes, para: input.observacoes };
  if ((cartaAtual.logo_snapshot_path || "") !== (finalSnapshotPath || "")) {
    camposAlterados.logo_snapshot_path = { de: cartaAtual.logo_snapshot_path, para: finalSnapshotPath };
  }

  const { data: cartaEditada, error: errUpdate } = await adminClient
    .from("cm_cartas_anuencia")
    .update({
      rede_id: input.rede_id,
      rede_nome: input.rede_nome,
      cnpj: input.cnpj || null,
      competencia_id: input.competencia_id || null,
      competencia: input.competencia,
      validade_ate: finalValidadeAte,
      logo_id: officialLogoRecord?.id || cartaAtual.logo_id,
      logo_snapshot_path: finalSnapshotPath,
      observacoes: input.observacoes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.carta_id)
    .select()
    .single();

  if (errUpdate) {
    throw new Error(`Erro ao atualizar carta de anuência: ${errUpdate.message}`);
  }

  await adminClient.from("cm_carta_anuencia_timeline").insert({
    carta_id: input.carta_id,
    evento: "EDITADA",
    detalhes: {
      numero_carta: cartaAtual.numero_carta,
      versao: cartaAtual.versao,
      campos_alterados: camposAlterados,
    },
    usuario_id: user.id,
    usuario_nome: userName,
  });

  await safeInsertAuditLog(adminClient, {
    user_id: user.id,
    action: "Edição Carta Anuência",
    table_name: "cm_cartas_anuencia",
    old_data: cartaAtual,
    new_data: {
      id: input.carta_id,
      numero_carta: cartaAtual.numero_carta,
      campos_alterados: camposAlterados,
    },
  });

  revalidatePath("/investimento/carta-anuencia");
  return {
    ...cartaEditada,
    logo_rede_url: getStoragePublicUrl(cartaEditada.logo_snapshot_path, "logos-redes"),
  } as CartaAnuenciaItem;
}

/**
 * 7. Registrar Compartilhamento por Canal
 */
export async function registrarCompartilhamento(
  cartaId: string,
  canal: "EMAIL" | "WHATSAPP" | "LINK" | "DOWNLOAD",
  detalhesAdicionais?: any
) {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);
  requireRole(profile, CARTA_ANUENCIA_ALLOWED_ROLES);

  const adminClient = createAdminClient();

  let userName = profile?.name || user.email || "Usuário do Sistema";

  const { data: carta } = await adminClient.from("cm_cartas_anuencia").select("status, rede_id").eq("id", cartaId).single();
  if (!carta) {
    throw new Error("Carta de Anuência não encontrada.");
  }

  // RBAC: validar se a carta pertence à carteira do gerente
  const carteiraGerente = await resolverCarteiraGerente(adminClient, profile);
  if (!validarAcessoRede(carteiraGerente, carta.rede_id)) {
    throw new Error("403 Forbidden: Não autorizado a registrar compartilhamento para carta fora de sua carteira regional.");
  }

  if (carta.status === "EMITIDA" && canal !== "DOWNLOAD") {
    await adminClient.from("cm_cartas_anuencia").update({ status: "ENVIADA" }).eq("id", cartaId);
  }

  await adminClient.from("cm_carta_anuencia_timeline").insert({
    carta_id: cartaId,
    evento: canal === "DOWNLOAD" ? "DOWNLOAD" : "COMPARTILHADA",
    canal: canal,
    detalhes: detalhesAdicionais || {},
    usuario_id: user.id,
    usuario_nome: userName,
  });

  await safeInsertAuditLog(adminClient, {
    user_id: user.id,
    action: `Compartilhamento Carta (${canal})`,
    table_name: "cm_cartas_anuencia",
    new_data: {
      carta_id: cartaId,
      canal,
      detalhes: detalhesAdicionais,
    },
  });

  revalidatePath("/investimento/carta-anuencia");
  return { ok: true };
}

/**
 * 8. Upload de Carta Assinada (Baixa Automática no Farol)
 */
export async function uploadCartaAssinada(cartaId: string, arquivoAssinadoUrl: string) {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);
  requireRole(profile, CARTA_ANUENCIA_ALLOWED_ROLES);

  const adminClient = createAdminClient();

  // Buscar estado anterior da carta para RBAC, histórico e auditoria
  const { data: cartaAnterior, error: fetchErr } = await adminClient
    .from("cm_cartas_anuencia")
    .select("id, rede_id, status, arquivo_assinado_url, numero_carta")
    .eq("id", cartaId)
    .single();

  if (fetchErr || !cartaAnterior) {
    throw new Error("Carta de anuência não encontrada.");
  }

  // RBAC: validar se a carta pertence à carteira do gerente
  const carteiraGerente = await resolverCarteiraGerente(adminClient, profile);
  if (carteiraGerente !== null) {
    if (!validarAcessoRede(carteiraGerente, cartaAnterior.rede_id)) {
      throw new Error("403 Forbidden: Não autorizado a registrar carta assinada para rede fora de sua carteira regional.");
    }
  }

  const isSubstituicao = Boolean(cartaAnterior.arquivo_assinado_url || cartaAnterior.status === "ASSINADA");
  let userName = profile?.name || user.email || "Usuário do Sistema";
  const dataAssinatura = new Date().toISOString();

  const { data: cartaAtualizada, error } = await adminClient
    .from("cm_cartas_anuencia")
    .update({
      status: "ASSINADA",
      arquivo_assinado_url: arquivoAssinadoUrl,
      data_assinatura: dataAssinatura,
      usuario_assinatura: user.id,
      usuario_assinatura_nome: userName,
      updated_at: dataAssinatura,
    })
    .eq("id", cartaId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao registrar carta assinada: ${error.message}`);
  }

  // 14. AUDITORIA DA TROCA / UPLOAD NA TIMELINE
  await adminClient.from("cm_carta_anuencia_timeline").insert({
    carta_id: cartaId,
    evento: isSubstituicao ? "SUBSTITUICAO_ASSINADA" : "UPLOAD_ASSINADA",
    detalhes: {
      acao: isSubstituicao ? "TROCA_CARTA_ASSINADA" : "UPLOAD_INICIAL_ASSINADA",
      arquivo_anterior: cartaAnterior.arquivo_assinado_url || null,
      novo_arquivo: arquivoAssinadoUrl,
      data_assinatura: dataAssinatura,
      resultado: isSubstituicao ? "Arquivo assinado substituído com sucesso" : "Arquivo assinado anexado com sucesso",
    },
    usuario_id: user.id,
    usuario_nome: userName,
  });

  // Log de auditoria permanente em cm_audit_logs
  await safeInsertAuditLog(adminClient, {
    user_id: user.id,
    action: isSubstituicao ? "Substituição de Carta Assinada (Troca de Arquivo)" : "Upload Carta Assinada (Baixa Automática Farol)",
    table_name: "cm_cartas_anuencia",
    old_data: isSubstituicao ? {
      carta_id: cartaId,
      numero_carta: cartaAnterior.numero_carta,
      arquivo_assinado_url: cartaAnterior.arquivo_assinado_url,
      status: cartaAnterior.status,
    } : undefined,
    new_data: {
      carta_id: cartaId,
      numero_carta: cartaAtualizada.numero_carta,
      arquivo_assinado_url: arquivoAssinadoUrl,
      status: "ASSINADA",
    },
  });

  revalidatePath("/investimento/carta-anuencia");
  return cartaAtualizada as CartaAnuenciaItem;
}

/**
 * 8.1. Upload Server-Side Seguro de Carta Assinada
 */
export async function uploadCartaAssinadaServerAction(formData: FormData): Promise<CartaAnuenciaItem> {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);
  requireRole(profile, CARTA_ANUENCIA_ALLOWED_ROLES);

  const file = formData.get("file") as File | null;
  const cartaId = formData.get("carta_id") as string | null;

  if (!file || !cartaId) {
    throw new Error("Arquivo assinado ou ID da Carta não fornecido.");
  }

  const MAX_SIZE = 20 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error("O arquivo excede o limite máximo permitido de 20MB.");
  }

  const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
  const ALLOWED_EXTS = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
  const ALLOWED_MIMES = [
    "application/pdf",
    "application/x-pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
  ];

  const isExtValid = ALLOWED_EXTS.includes(ext);
  const isMimeValid = ALLOWED_MIMES.includes(file.type || "");

  if (!isExtValid && !isMimeValid) {
    throw new Error("Formato de arquivo inválido. Apenas PDF, PNG, JPG ou WEBP são permitidos.");
  }

  const adminClient = createAdminClient();

  // RBAC: validar se a carta pertence à carteira do gerente ANTES do upload físico para o Storage corporativo
  const carteiraGerente = await resolverCarteiraGerente(adminClient, profile);
  const { data: carta, error: fetchErr } = await adminClient
    .from("cm_cartas_anuencia")
    .select("id, numero_carta, status, rede_id")
    .eq("id", cartaId)
    .single();

  if (fetchErr || !carta) {
    throw new Error("Carta de anuência não encontrada.");
  }

  if (!validarAcessoRede(carteiraGerente, carta.rede_id)) {
    throw new Error("403 Forbidden: Não autorizado a realizar upload de arquivo assinado para carta fora de sua carteira regional.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let contentType = "application/pdf";
  if (ext === ".png" || file.type === "image/png") {
    contentType = "image/png";
  } else if (ext === ".jpg" || ext === ".jpeg" || file.type === "image/jpeg" || file.type === "image/jpg") {
    contentType = "image/jpeg";
  } else if (ext === ".webp" || file.type === "image/webp") {
    contentType = "image/webp";
  } else {
    contentType = "application/pdf";
  }

  const cleanFileName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const filePath = `assinadas/${carta.numero_carta.toLowerCase()}_${Date.now()}_${cleanFileName}`;

  const { error: uploadErr } = await adminClient.storage
    .from("cartas-anuencia")
    .upload(filePath, buffer, {
      contentType,
      upsert: true,
    });

  if (uploadErr) {
    throw new Error(`Erro ao enviar arquivo para o Storage corporativo: ${uploadErr.message}`);
  }

  const publicUrl = getStoragePublicUrl(filePath, "cartas-anuencia");
  return uploadCartaAssinada(cartaId, publicUrl);
}

/**
 * 9. Cancelar Carta de Anuência
 */
export async function cancelarCartaAnuencia(cartaId: string, motivo: string) {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);
  requireRole(profile, CARTA_ANUENCIA_ALLOWED_ROLES);

  const adminClient = createAdminClient();

  // RBAC: validar se a carta pertence à carteira do gerente
  const carteiraGerente = await resolverCarteiraGerente(adminClient, profile);
  const { data: cartaAtual, error: fetchErr } = await adminClient
    .from("cm_cartas_anuencia")
    .select("id, rede_id")
    .eq("id", cartaId)
    .single();

  if (fetchErr || !cartaAtual) {
    throw new Error("Carta de Anuência não encontrada para cancelamento.");
  }

  if (!validarAcessoRede(carteiraGerente, cartaAtual.rede_id)) {
    throw new Error("403 Forbidden: Não autorizado a cancelar carta pertencente a outra carteira regional.");
  }

  let userName = profile?.name || user.email || "Usuário do Sistema";

  const { data, error } = await adminClient
    .from("cm_cartas_anuencia")
    .update({
      status: "CANCELADA",
      observacoes: motivo ? `Motivo do cancelamento: ${motivo}` : "Carta cancelada pelo usuário",
      updated_at: new Date().toISOString(),
    })
    .eq("id", cartaId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao cancelar carta: ${error.message}`);
  }

  await adminClient.from("cm_carta_anuencia_timeline").insert({
    carta_id: cartaId,
    evento: "CANCELADA",
    detalhes: { motivo },
    usuario_id: user.id,
    usuario_nome: userName,
  });

  await safeInsertAuditLog(adminClient, {
    user_id: user.id,
    action: "Cancelamento Carta Anuência",
    table_name: "cm_cartas_anuencia",
    new_data: { carta_id: cartaId, motivo },
  });

  revalidatePath("/investimento/carta-anuencia");
  return data;
}

/**
 * 10. Obter Histórico da Timeline de uma Carta
 */
export async function obterTimelineCarta(cartaId: string): Promise<TimelineItem[]> {
  if (!cartaId) return [];
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);

  const adminClient = createAdminClient();

  // RBAC: validar se a carta pertence à carteira do gerente antes de expor a timeline
  const carteiraGerente = await resolverCarteiraGerente(adminClient, profile);
  if (carteiraGerente !== null) {
    const { data: carta, error: fetchErr } = await adminClient
      .from("cm_cartas_anuencia")
      .select("id, rede_id")
      .eq("id", cartaId)
      .single();

    if (fetchErr || !carta || !validarAcessoRede(carteiraGerente, carta.rede_id)) {
      throw new Error("403 Forbidden: Não autorizado a consultar timeline de carta fora de sua carteira regional.");
    }
  }
  const { data, error } = await adminClient
    .from("cm_carta_anuencia_timeline")
    .select("*")
    .eq("carta_id", cartaId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao obter timeline:", error);
    return [];
  }
  return data || [];
}

/**
 * Helpers Internos para o Farol Executivo Gerencial
 */
function resolverRegionalPorGerente(manager: string | null | undefined): { id: string; label: string } {
  const m = (manager || "").trim();
  if (m === "Leandro Saffi") return { id: "SUL", label: "Sul" };
  if (m === "Julliano") return { id: "SUDESTE", label: "Sudeste (SP)" };
  if (m === "Luiz") return { id: "SU_CO_NE", label: "Sudeste / Nordeste" };
  if (m === "John Guedes") return { id: "CO_NO", label: "Centro-Oeste / Norte" };
  return { id: "OUTROS", label: "Outros" };
}

function calcularFarolStatus(pct: number): "VERDE" | "AMARELO" | "LARANJA" | "VERMELHO" {
  if (pct >= 90) return "VERDE";
  if (pct >= 70) return "AMARELO";
  if (pct >= 50) return "LARANJA";
  return "VERMELHO";
}

const MESES_MAP: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function obterMesesFechados3M(competencia: string): string[] {
  const parts = competencia.split("/");
  let mesNum = 6;
  let anoNum = 2026;
  if (parts.length === 2) {
    const nomeMes = parts[0].toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    mesNum = MESES_MAP[nomeMes] || 6;
    anoNum = parseInt(parts[1], 10) || 2026;
  }

  const closedMonths: string[] = [];
  for (let i = 2; i >= 0; i--) {
    let targetM = mesNum - i;
    let targetY = anoNum;
    if (targetM <= 0) {
      targetM += 12;
      targetY -= 1;
    }
    closedMonths.push(`${targetY}-${String(targetM).padStart(2, "0")}`);
  }
  return closedMonths;
}

/**
 * 11. Obter Dados Consolidados do Farol Executivo Gerencial (Cobertura por Regional)
 * 
 * Regra de Negócio Homologada (Auditoria Forense):
 *  - 1 Carta de Anuência = 1 Operação Regional Gerencial (Gerente Responsável × Rede Operacional).
 *  - Cardinalidade Estrita 1:1: Cada carta física em cm_cartas_anuencia pontua EXATAMENTE 1 VEZ.
 *  - Universo Esperado: vw_redes_planejaveis_oficiais (is_rede_planejavel = true, expurgando testes, diretoria e Canal Distribuidor).
 *  - Identidade Matemática: ESPERADAS = NO SISTEMA + FALTANTES (0,0000% de divergência).
 *  - RBAC: Gerente Regional tem escopo restrito à sua Regional/Carteira. Perfis nacionais possuem visão global.
 */
export async function obterDadosFarolGerencial(filters?: {
  competencia?: string;
  regional?: string;
  gerente?: string;
  uf?: string;
  status_carta?: string;
  busca?: string;
}): Promise<FarolGerencialResumo> {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);
  requireRole(profile, CARTA_ANUENCIA_ALLOWED_ROLES);

  const adminClient = createAdminClient();

  // RBAC: Gerente Regional tem visão restrita à sua própria carteira
  const isGerenteRegional = profile?.role === "Gerente Regional";
  const gerenteLogado = isGerenteRegional ? (profile.manager_name || profile.name || undefined) : undefined;

  // 1. Obter Competências Disponíveis
  const { data: competenciasData } = await adminClient
    .from("cm_competencias_anuencia")
    .select("*")
    .order("data_inicio", { ascending: false });

  const competenciasDisponiveis: CompetenciaItem[] = competenciasData || [];
  const competenciaSelecionada = filters?.competencia || competenciasDisponiveis[0]?.competencia || "Junho/2026";

  // 2. Obter Cartas Ativas da Competência (não canceladas)
  const { data: cartasAtivasRaw, error: cartasErr } = await adminClient
    .from("cm_cartas_anuencia")
    .select("*")
    .neq("status", "CANCELADA")
    .eq("competencia", competenciaSelecionada)
    .order("created_at", { ascending: false });

  if (cartasErr) {
    console.error("Erro ao obter cartas para Farol Gerencial:", cartasErr);
  }

  // 3. Obter Universo Oficial de Redes Planejáveis (Excluindo estritamente Canal Distribuidor)
  const { data: redesOficiaisRaw, error: redesErr } = await adminClient
    .from("vw_redes_planejaveis_oficiais")
    .select("rede, manager, manager_id, regional, uf, codigo_matriz, is_rede_planejavel, canal")
    .eq("is_rede_planejavel", true)
    .neq("canal", "Distribuidor") // Exclusão estrita do Canal Distribuidor na fonte
    .neq("codigo_matriz", "11111111") // Expurgar CLIENTE FAKE TESTE
    .neq("manager", "Cristiano");     // Expurgar Diretoria

  if (redesErr) {
    console.error("Erro ao obter redes oficiais para Farol Gerencial:", redesErr);
  }

  // 3.1. Carregar Overrides Administrativos Ativos (Inclusões / Exclusões)
  const { data: overridesAtivos } = await adminClient
    .from("cm_carta_anuencia_farol_redes_config")
    .select("*")
    .eq("is_ativo", true);

  const exclusoesSet = new Set<string>();
  const inclusaoMap = new Map<string, any>();

  (overridesAtivos || []).forEach((ov: any) => {
    const key = `${ov.gerente}:::${ov.rede_nome}:::${ov.codigo_matriz}`.toUpperCase();
    const keyNome = `${ov.gerente}:::${ov.rede_nome}`.toUpperCase();
    if (ov.tipo_acao === "EXCLUSAO") {
      exclusoesSet.add(key);
      exclusoesSet.add(keyNome);
    } else if (ov.tipo_acao === "INCLUSAO") {
      inclusaoMap.set(key, ov);
      inclusaoMap.set(keyNome, ov);
    }
  });

  // Precedência determinística:
  // 1. Distribuidor = sempre excluído;
  // 2. Exclusão administrativa = fora do Farol;
  // 3. Inclusão administrativa = participa (se não for Distribuidor);
  // 4. Sem override = segue universo base oficial.
  let redesTrabalho = (redesOficiaisRaw || []).filter((r) => {
    if (r.canal === "Distribuidor") return false;
    const key = `${r.manager}:::${r.rede}:::${r.codigo_matriz}`.toUpperCase();
    const keyNome = `${r.manager}:::${r.rede}`.toUpperCase();
    if (exclusoesSet.has(key) || exclusoesSet.has(keyNome)) {
      return false;
    }
    return true;
  });

  // Adicionar inclusões administrativas caso a operação não esteja no universo base oficial
  inclusaoMap.forEach((ov) => {
    const jaExiste = redesTrabalho.some(
      (r) => `${r.manager}:::${r.rede}`.toUpperCase() === `${ov.gerente}:::${ov.rede_nome}`.toUpperCase()
    );
    if (!jaExiste) {
      redesTrabalho.push({
        rede: ov.rede_nome,
        manager: ov.gerente,
        manager_id: "CUSTOM",
        regional: resolverRegionalPorGerente(ov.gerente).label,
        uf: null,
        codigo_matriz: ov.codigo_matriz,
        is_rede_planejavel: true,
        canal: "Inclusão Administrativa",
      });
    }
  });

  // Se Gerente Regional, forçar filtro estrito à sua carteira
  const universoRedes = redesTrabalho.filter((r) => {
    if (isGerenteRegional && gerenteLogado) {
      return r.manager === gerenteLogado;
    }
    return true;
  });

  // 4. Mapeamento Canônico de Desambiguação de Cartas Multiestado / Multioperação
  // Auditado e comprovado no relatório forense de cardinalidade
  const CARTA_DESTINO_CANONICO: Record<string, { manager: string; rede: string }> = {
    "CA-2026-000001": { manager: "Leandro Saffi", rede: "ZAFFARI (RS)" },
    "CA-2026-000006": { manager: "Leandro Saffi", rede: "FORT (SC)" },
    "CA-2026-000012": { manager: "Julliano", rede: "OBA SP" },
    "CA-2026-000017": { manager: "Luiz", rede: "MATEUS" },
    "CA-2026-000018": { manager: "John Guedes", rede: "ASSAI" },
  };

  // Mapeamento de manager por rede_id através de cm_redes_matrizes
  const codigosCartas = (cartasAtivasRaw || []).map((c: any) => String(c.rede_id).trim()).filter(Boolean);
  const codigosBases = codigosCartas.map((c: string) => c.replace(/\.\d+$/, ""));
  const todosCodigos = Array.from(new Set([...codigosCartas, ...codigosBases]));

  const { data: redesMatrizes } = await adminClient
    .from("cm_redes_matrizes")
    .select("codigo, nome, manager_id, manager")
    .in("codigo", todosCodigos);

  const managerPorRedeId = new Map<string, string>();
  (redesMatrizes || []).forEach((rm) => {
    if (rm.codigo && rm.manager) {
      const codeStr = String(rm.codigo).trim();
      const codeBase = codeStr.replace(/\.\d+$/, "").trim();
      managerPorRedeId.set(codeStr, rm.manager);
      managerPorRedeId.set(codeBase, rm.manager);
    }
  });

  // 5. Vincular cada carta física a EXATAMENTE uma operação de rede (cardinalidade 1:1 estrita)
  const cartasPorRedeChave = new Map<string, CartaAnuenciaItem>();
  const cartasUsadas = new Set<string>();

  (cartasAtivasRaw || []).forEach((c) => {
    if (cartasUsadas.has(c.id)) return; // Garantir que uma carta física nunca seja usada duas vezes

    const cartaEnriquecida: CartaAnuenciaItem = {
      id: c.id,
      numero_carta: c.numero_carta,
      versao: c.versao || 1,
      carta_origem_id: c.carta_origem_id || null,
      rede_id: c.rede_id,
      rede_nome: c.rede_nome || "",
      cnpj: c.cnpj || null,
      competencia_id: c.competencia_id || null,
      competencia: c.competencia,
      data_emissao: c.data_emissao,
      data_assinatura: c.data_assinatura || null,
      validade_ate: c.validade_ate || null,
      status: c.status,
      logo_id: c.logo_id || null,
      logo_snapshot_path: c.logo_snapshot_path || null,
      logo_rede_url: getStoragePublicUrl(c.logo_snapshot_path || c.logo_rede_url, "logos-redes"),
      logo_coffee_url: c.logo_coffee_url || null,
      pdf_url: c.pdf_url || null,
      arquivo_assinado_url: c.arquivo_assinado_url || null,
      usuario_emissao: c.usuario_emissao || null,
      usuario_emissao_nome: c.usuario_emissao_nome || null,
      usuario_assinatura: c.usuario_assinatura || null,
      usuario_assinatura_nome: c.usuario_assinatura_nome || null,
      observacoes: c.observacoes || null,
      assinatura_metodo: c.assinatura_metodo || null,
      assinatura_hash: c.assinatura_hash || null,
      assinatura_protocolo: c.assinatura_protocolo || null,
      qr_code_hash: c.qr_code_hash || null,
      created_at: c.created_at,
      updated_at: c.updated_at,
      expirada: verificarCartaExpirada(c.validade_ate),
    };

    // Caso 1: Mapeamento canônico explícito (para os 5 casos multiestado)
    if (CARTA_DESTINO_CANONICO[c.numero_carta]) {
      const dest = CARTA_DESTINO_CANONICO[c.numero_carta];
      const key = `${dest.manager}:::${dest.rede}`.toLowerCase();
      cartaEnriquecida.gerente = dest.manager;
      cartaEnriquecida.rede_nome = dest.rede;
      cartasPorRedeChave.set(key, cartaEnriquecida);
      cartasUsadas.add(c.id);
      return;
    }

    // Caso 2: Resolver manager titular da carta
    const cIdStr = String(c.rede_id || "").trim();
    const cIdBase = cIdStr.replace(/\.\d+$/, "").trim();
    const managerTitular = managerPorRedeId.get(cIdStr) || managerPorRedeId.get(cIdBase);

    if (managerTitular) {
      // Encontrar a rede oficial daquele manager
      const redeAlvo = universoRedes.find((r) => {
        if (r.manager !== managerTitular) return false;
        const rIdStr = String(r.codigo_matriz || "").trim();
        const rIdBase = rIdStr.replace(/\.\d+$/, "").trim();
        const rNomeNorm = (r.rede || "").toLowerCase().trim();
        const cNomeNorm = (c.rede_nome || "").toLowerCase().trim();
        return rIdStr === cIdStr || rIdBase === cIdBase || rNomeNorm === cNomeNorm;
      });

      if (redeAlvo) {
        const key = `${redeAlvo.manager}:::${redeAlvo.rede}`.toLowerCase();
        if (!cartasPorRedeChave.has(key)) {
          cartaEnriquecida.gerente = redeAlvo.manager;
          cartaEnriquecida.uf = redeAlvo.uf || null;
          if (!cartaEnriquecida.rede_nome) {
            cartaEnriquecida.rede_nome = redeAlvo.rede;
          }
          cartasPorRedeChave.set(key, cartaEnriquecida);
          cartasUsadas.add(c.id);
          return;
        }
      }
    }
  });

  // 6. Obter Faturamento Médio 3M na fonte oficial mv_vendas_cliente_mensal (alinhada à Seção 10 do Coffee++)
  const meses3M = obterMesesFechados3M(competenciaSelecionada);
  const sqlFaturamento = `
    SELECT 
      c.responsavel AS manager,
      TRIM(c.matriz) AS rede,
      c.codigo_matriz,
      v.mes,
      SUM(v.fat) AS fat_mes
    FROM public.mv_vendas_cliente_mensal v
    JOIN public.cm_clientes c ON TRIM(c.codigo::text) = TRIM(v.cod_parceiro::text)
    WHERE v.mes IN ('${meses3M.join("','")}')
      AND c.matriz IS NOT NULL AND TRIM(c.matriz) != ''
    GROUP BY c.responsavel, TRIM(c.matriz), c.codigo_matriz, v.mes
  `;

  const faturamentoMap = new Map<string, number>();
  try {
    const { data: dadosFatRaw, error: fatErr } = await adminClient.rpc("execute_readonly_query", {
      query_text: sqlFaturamento,
    });
    if (!fatErr && dadosFatRaw) {
      (dadosFatRaw as any[]).forEach((row) => {
        const val = Number(row.fat_mes || 0);
        const keyExact = `${row.manager}:::${row.rede}:::${row.codigo_matriz}`.toUpperCase();
        const keyNome = `${row.manager}:::${row.rede}`.toUpperCase();
        faturamentoMap.set(keyExact, (faturamentoMap.get(keyExact) || 0) + val);
        faturamentoMap.set(keyNome, (faturamentoMap.get(keyNome) || 0) + val);
      });
    } else if (fatErr) {
      console.warn("Aviso: Falha ao carregar faturamento 3M do Farol:", fatErr);
    }
  } catch (errFat) {
    console.warn("Erro ao buscar faturamento 3M:", errFat);
  }

  // 7. Construir lista de redes detalhadas com status 1:1 e Faturamento Médio 3M
  const redesDetalhadas: FarolGerencialRedeItem[] = universoRedes.map((r) => {
    const key = `${r.manager}:::${r.rede}`.toLowerCase();
    const carta = cartasPorRedeChave.get(key) || null;
    const possui_carta = Boolean(carta);
    const regionalInfo = resolverRegionalPorGerente(r.manager);

    // Garantir que a carta carregue o nome e dados da rede para o PreviewModal
    if (carta && !carta.rede_nome) {
      carta.rede_nome = r.rede;
    }

    const fatKey = `${r.manager}:::${r.rede}:::${r.codigo_matriz}`.toUpperCase();
    const fatKeyNome = `${r.manager}:::${r.rede}`.toUpperCase();
    const total3M = faturamentoMap.get(fatKey) ?? faturamentoMap.get(fatKeyNome) ?? 0;
    const faturamento_medio_3m = total3M > 0 ? Number((total3M / 3).toFixed(2)) : 0;

    return {
      rede: r.rede,
      manager: r.manager,
      regional: regionalInfo.label,
      uf: r.uf || null,
      codigo_matriz: r.codigo_matriz,
      possui_carta,
      status_farol_rede: possui_carta ? "COM_CARTA" : "SEM_CARTA",
      faturamento_medio_3m,
      carta,
    };
  });

  // 7. NOVO AGRUPAMENTO PRINCIPAL POR GERENTE RESPONSÁVEL
  const gerentesMap = new Map<string, {
    id: string;
    gerente: string;
    regional: string;
    redes: FarolGerencialRedeItem[];
  }>();

  // Lista dinâmica de gerentes baseada no universo oficial (sem hardcoding)
  const listaGerentes = isGerenteRegional && gerenteLogado
    ? [gerenteLogado]
    : Array.from(new Set(universoRedes.map((r) => r.manager).filter(Boolean))).sort();

  listaGerentes.forEach((m) => {
    const regInfo = resolverRegionalPorGerente(m);
    gerentesMap.set(m, {
      id: m.toLowerCase().replace(/\s+/g, "_"),
      gerente: m,
      regional: regInfo.label,
      redes: [],
    });
  });

  // Distribuir as redes em seus respectivos gerentes responsáveis
  redesDetalhadas.forEach((item) => {
    const gGroup = gerentesMap.get(item.manager);
    if (gGroup) {
      gGroup.redes.push(item);
    }
  });

  // 8. Calcular métricas agregadas por Gerente com consistência estrita
  const gerentesItens: FarolGerencialGerenteItem[] = Array.from(gerentesMap.values()).map((g) => {
    const esperadas = g.redes.length;
    const no_sistema = g.redes.filter((r) => r.possui_carta).length;
    const faltantes = esperadas - no_sistema;
    const cobertura_pct = esperadas > 0 ? Number(((no_sistema / esperadas) * 100).toFixed(1)) : 0;
    const status_farol = calcularFarolStatus(cobertura_pct);

    // MÉTIRCAS DO RANKING DE ASSINATURA — ESTRITAMENTE MUTUAMENTE EXCLUSIVAS
    const redesComCarta = g.redes.filter((r) => r.possui_carta && r.carta);
    
    // ASSINADA: somente se status === 'ASSINADA' ou possui arquivo_assinado_url
    const cartas_assinadas = redesComCarta.filter((r) => 
      r.carta!.status === "ASSINADA" || Boolean(r.carta!.arquivo_assinado_url)
    ).length;

    // PARA ASSINAR: carta existe no sistema mas ainda não está assinada
    const cartas_para_assinar = redesComCarta.filter((r) => 
      r.carta!.status !== "ASSINADA" && !r.carta!.arquivo_assinado_url
    ).length;

    // Garantia matemática estrita: cartas_para_assinar + cartas_assinadas === no_sistema
    const totalCartasNoContexto = cartas_para_assinar + cartas_assinadas;
    const pct_cartas_assinadas = totalCartasNoContexto > 0 
      ? Number(((cartas_assinadas / totalCartasNoContexto) * 100).toFixed(1))
      : 0;

    // Ordenar redes do gerente: 1º faltantes (SEM CARTA), 2º alfabético
    const redesOrdenadas = [...g.redes].sort((a, b) => {
      if (a.possui_carta === b.possui_carta) {
        return a.rede.localeCompare(b.rede, "pt-BR");
      }
      return a.possui_carta ? 1 : -1;
    });

    return {
      id: g.id,
      gerente: g.gerente,
      regional: g.regional,
      esperadas,
      no_sistema,
      faltantes,
      cobertura_pct,
      status_farol,
      total_cartas: cartas_para_assinar + cartas_assinadas,
      cartas_para_assinar,
      cartas_assinadas,
      pct_cartas_assinadas,
      redes: redesOrdenadas,
    };
  });

  // Ordenação dos Gerentes no Farol: 1º menor cobertura %, 2º mais faltantes, 3º alfabético
  gerentesItens.sort((a, b) => {
    if (a.cobertura_pct !== b.cobertura_pct) {
      return a.cobertura_pct - b.cobertura_pct;
    }
    if (b.faltantes !== a.faltantes) {
      return b.faltantes - a.faltantes;
    }
    return a.gerente.localeCompare(b.gerente, "pt-BR");
  });

  // 9. Ranking de Assinatura:
  // Ordenar por:
  // 1. % de Cartas assinadas — maior para menor (DESC)
  // 2. Em caso de empate: Cartas assinadas — maior para menor (DESC)
  // 3. Em caso de novo empate: Gerente — ordem alfabética (ASC)
  const ranking_assinatura: FarolGerencialRankingItem[] = [...gerentesItens]
    .sort((a, b) => {
      if (b.pct_cartas_assinadas !== a.pct_cartas_assinadas) {
        return b.pct_cartas_assinadas - a.pct_cartas_assinadas;
      }
      if (b.cartas_assinadas !== a.cartas_assinadas) {
        return b.cartas_assinadas - a.cartas_assinadas;
      }
      return a.gerente.localeCompare(b.gerente, "pt-BR");
    })
    .map((g, idx) => ({
      posicao: idx + 1,
      gerente: g.gerente,
      total_cartas: g.cartas_para_assinar + g.cartas_assinadas,
      cartas_para_assinar: g.cartas_para_assinar,
      cartas_assinadas: g.cartas_assinadas,
      pct_cartas_assinadas: g.pct_cartas_assinadas,
    }));

  // 10. Agrupamento por Regional Oficial (compatibilidade reversa)
  const regionaisMap = new Map<string, {
    id: string;
    regional: string;
    gerente: string;
    redes: FarolGerencialRedeItem[];
  }>();

  const REGIONAIS_ORDEM = [
    { id: "CO_NO", regional: "Centro-Oeste / Norte", gerente: "John Guedes" },
    { id: "SUL", regional: "Sul", gerente: "Leandro Saffi" },
    { id: "SU_CO_NE", regional: "Sudeste / Nordeste", gerente: "Luiz" },
    { id: "SUDESTE", regional: "Sudeste (SP)", gerente: "Julliano" },
  ];

  REGIONAIS_ORDEM.forEach((reg) => {
    if (!isGerenteRegional || reg.gerente === gerenteLogado) {
      regionaisMap.set(reg.regional, {
        id: reg.id,
        regional: reg.regional,
        gerente: reg.gerente,
        redes: [],
      });
    }
  });

  redesDetalhadas.forEach((item) => {
    let regGroup = regionaisMap.get(item.regional);
    if (!regGroup) {
      const regDef = REGIONAIS_ORDEM.find((r) => r.gerente === item.manager);
      if (regDef && regionaisMap.has(regDef.regional)) {
        regGroup = regionaisMap.get(regDef.regional);
      }
    }
    if (regGroup) {
      regGroup.redes.push(item);
    }
  });

  const regionaisItens: FarolGerencialRegionalItem[] = Array.from(regionaisMap.values()).map((g) => {
    const esperadas = g.redes.length;
    const no_sistema = g.redes.filter((r) => r.possui_carta).length;
    const faltantes = esperadas - no_sistema;
    const cobertura_pct = esperadas > 0 ? Number(((no_sistema / esperadas) * 100).toFixed(1)) : 0;
    const status_farol = calcularFarolStatus(cobertura_pct);

    return {
      id: g.id,
      regional: g.regional,
      gerente: g.gerente,
      esperadas,
      no_sistema,
      faltantes,
      cobertura_pct,
      status_farol,
      redes: g.redes,
    };
  });

  // 11. Calcular Totais Gerais Consolidados (conforme escopo RBAC)
  const total_esperadas = gerentesItens.reduce((acc, r) => acc + r.esperadas, 0);
  const total_no_sistema = gerentesItens.reduce((acc, r) => acc + r.no_sistema, 0);
  const total_faltantes = total_esperadas - total_no_sistema;
  const cobertura_geral_pct = total_esperadas > 0 ? Number(((total_no_sistema / total_esperadas) * 100).toFixed(1)) : 0;
  const status_farol_geral = calcularFarolStatus(cobertura_geral_pct);

  return {
    total_esperadas,
    total_no_sistema,
    total_faltantes,
    cobertura_geral_pct,
    status_farol_geral,
    competencia: competenciaSelecionada,
    competencias_disponiveis: competenciasDisponiveis,
    gerentes: gerentesItens,
    ranking_assinatura,
    regionais: regionaisItens,
    is_gerente_regional: isGerenteRegional,
    gerente_logado: gerenteLogado,
    is_admin: !isGerenteRegional,
    total_overrides_ativos: (overridesAtivos || []).length,
  };
}

/**
 * 12. Excluir Rede do Farol Executivo Gerencial (Apenas Admin)
 * 
 * Regra:
 * - Apenas ADMIN pode excluir.
 * - Motivo é estritamente obrigatório.
 * - Não altera cm_clientes, não exclui nem cancela nenhuma Carta.
 * - Registra em cm_audit_logs a ação FAROL_EXCLUSAO_REDE.
 */
export async function excluirRedeDoFarol(input: {
  rede_nome: string;
  codigo_matriz: string;
  gerente: string;
  motivo: string;
}) {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);
  requireRole(profile, CARTA_ANUENCIA_ALLOWED_ROLES);

  const ADMIN_ROLES = ["Admin", "Admin Master", "TI", "CEO", "Diretor"];
  if (profile?.role === "Gerente Regional" || !ADMIN_ROLES.includes(profile?.role || "")) {
    throw new Error("403 Forbidden: Apenas administradores podem excluir redes do Farol.");
  }

  if (!input.motivo || !input.motivo.trim()) {
    throw new Error("O motivo da exclusão é obrigatório.");
  }

  const adminClient = createAdminClient();
  const userName = profile?.name || user.email || "Administrador";

  // Desativar qualquer override ativo anterior para a mesma chave de operação
  await adminClient
    .from("cm_carta_anuencia_farol_redes_config")
    .update({ is_ativo: false, updated_at: new Date().toISOString() })
    .match({
      gerente: input.gerente,
      rede_nome: input.rede_nome,
      codigo_matriz: input.codigo_matriz,
      is_ativo: true,
    });

  // Inserir registro de exclusão
  const { data, error } = await adminClient
    .from("cm_carta_anuencia_farol_redes_config")
    .insert({
      tipo_acao: "EXCLUSAO",
      rede_nome: input.rede_nome,
      codigo_matriz: input.codigo_matriz,
      gerente: input.gerente,
      motivo: input.motivo.trim(),
      criado_por: user.id,
      criado_por_nome: userName,
      is_ativo: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao registrar exclusão no Farol: ${error.message}`);
  }

  // Registrar auditoria em cm_audit_logs
  await safeInsertAuditLog(adminClient, {
    user_id: user.id,
    action: "FAROL_EXCLUSAO_REDE",
    table_name: "cm_carta_anuencia_farol_redes_config",
    new_data: {
      usuario: userName,
      email: user.email,
      data_hora: new Date().toISOString(),
      rede: input.rede_nome,
      codigo_matriz: input.codigo_matriz,
      gerente: input.gerente,
      acao: "EXCLUSAO",
      motivo: input.motivo.trim(),
    },
  });

  revalidatePath("/investimento/carta-anuencia");
  return data;
}

/**
 * 13. Incluir Rede no Farol Executivo Gerencial (Apenas Admin)
 * 
 * Regra:
 * - Apenas ADMIN pode incluir.
 * - A inclusão busca uma operação existente no módulo Clientes (cm_clientes).
 * - NUNCA altera o cadastro de cm_clientes.
 * - REGRA SUPERIOR: Operações classificadas oficialmente como canal = 'Distribuidor' NÃO podem ser incluídas.
 * - Registra em cm_audit_logs a ação FAROL_INCLUSAO_REDE.
 */
export async function incluirRedeNoFarol(input: {
  rede_nome: string;
  codigo_matriz: string;
  gerente: string;
  observacao?: string;
}) {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);
  requireRole(profile, CARTA_ANUENCIA_ALLOWED_ROLES);

  const ADMIN_ROLES = ["Admin", "Admin Master", "TI", "CEO", "Diretor"];
  if (profile?.role === "Gerente Regional" || !ADMIN_ROLES.includes(profile?.role || "")) {
    throw new Error("403 Forbidden: Apenas administradores podem incluir redes no Farol.");
  }

  const adminClient = createAdminClient();

  // Validar existência da operação no cadastro oficial de Clientes (cm_clientes)
  const { data: clientesEncontrados, error: cliErr } = await adminClient
    .from("cm_clientes")
    .select("canal, responsavel, matriz, codigo_matriz")
    .eq("codigo_matriz", input.codigo_matriz);

  if (cliErr || !clientesEncontrados || clientesEncontrados.length === 0) {
    throw new Error("Operação não encontrada no cadastro de Clientes.");
  }

  // Regra Superior: Distribuidor = sempre fora do Farol (bloqueio estrutural)
  const isDistribuidor = clientesEncontrados.some(
    (c) => (c.canal || "").toLowerCase().trim() === "distribuidor"
  );
  if (isDistribuidor) {
    throw new Error("Operações classificadas oficialmente como Distribuidor não podem ser incluídas no Farol.");
  }

  const userName = profile?.name || user.email || "Administrador";

  // Desativar qualquer override ativo anterior
  await adminClient
    .from("cm_carta_anuencia_farol_redes_config")
    .update({ is_ativo: false, updated_at: new Date().toISOString() })
    .match({
      gerente: input.gerente,
      rede_nome: input.rede_nome,
      codigo_matriz: input.codigo_matriz,
      is_ativo: true,
    });

  // Inserir registro de inclusão
  const { data, error } = await adminClient
    .from("cm_carta_anuencia_farol_redes_config")
    .insert({
      tipo_acao: "INCLUSAO",
      rede_nome: input.rede_nome,
      codigo_matriz: input.codigo_matriz,
      gerente: input.gerente,
      motivo: input.observacao?.trim() || "Inclusão administrativa autorizada",
      criado_por: user.id,
      criado_por_nome: userName,
      is_ativo: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao registrar inclusão no Farol: ${error.message}`);
  }

  // Registrar auditoria em cm_audit_logs
  await safeInsertAuditLog(adminClient, {
    user_id: user.id,
    action: "FAROL_INCLUSAO_REDE",
    table_name: "cm_carta_anuencia_farol_redes_config",
    new_data: {
      usuario: userName,
      email: user.email,
      data_hora: new Date().toISOString(),
      rede: input.rede_nome,
      codigo_matriz: input.codigo_matriz,
      gerente: input.gerente,
      acao: "INCLUSAO",
      motivo: input.observacao?.trim() || "Inclusão administrativa autorizada",
    },
  });

  revalidatePath("/investimento/carta-anuencia");
  return data;
}

/**
 * 14. Reativar Rede no Farol (Remover Exclusão/Inclusão Administrativa)
 */
export async function reativarRedeNoFarol(configId: string) {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);
  requireRole(profile, CARTA_ANUENCIA_ALLOWED_ROLES);

  const ADMIN_ROLES = ["Admin", "Admin Master", "TI", "CEO", "Diretor"];
  if (profile?.role === "Gerente Regional" || !ADMIN_ROLES.includes(profile?.role || "")) {
    throw new Error("403 Forbidden: Apenas administradores podem reativar redes no Farol.");
  }

  const adminClient = createAdminClient();

  const { data: configItem, error: fetchErr } = await adminClient
    .from("cm_carta_anuencia_farol_redes_config")
    .select("*")
    .eq("id", configId)
    .single();

  if (fetchErr || !configItem) {
    throw new Error("Registro de configuração não encontrado.");
  }

  const { error } = await adminClient
    .from("cm_carta_anuencia_farol_redes_config")
    .update({ is_ativo: false, updated_at: new Date().toISOString() })
    .eq("id", configId);

  if (error) {
    throw new Error(`Erro ao reativar rede: ${error.message}`);
  }

  const userName = profile?.name || user.email || "Administrador";

  // Registrar auditoria em cm_audit_logs
  await safeInsertAuditLog(adminClient, {
    user_id: user.id,
    action: "FAROL_REATIVACAO_REDE",
    table_name: "cm_carta_anuencia_farol_redes_config",
    new_data: {
      usuario: userName,
      email: user.email,
      data_hora: new Date().toISOString(),
      rede: configItem.rede_nome,
      codigo_matriz: configItem.codigo_matriz,
      gerente: configItem.gerente,
      acao: "REATIVACAO",
      motivo: "Reativação administrativa ao universo padrão",
    },
  });

  revalidatePath("/investimento/carta-anuencia");
  return { ok: true };
}

/**
 * 15. Listar Configurações / Overrides Ativos do Farol
 */
export async function listarOverridesFarol() {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);
  requireRole(profile, CARTA_ANUENCIA_ALLOWED_ROLES);

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("cm_carta_anuencia_farol_redes_config")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar overrides do Farol:", error);
    return [];
  }
  return data || [];
}

/**
 * 16. Listar Operações Disponíveis em cm_clientes para Inclusão Manual no Farol
 * Exclui estritamente canal = 'Distribuidor' e clientes de teste.
 */
export async function listarRedesDisponiveisParaInclusaoFarol(busca?: string) {
  const user = await requireAuth();
  const profile = await requireApprovedProfile(user.id);
  requireRole(profile, CARTA_ANUENCIA_ALLOWED_ROLES);

  const adminClient = createAdminClient();

  let query = adminClient
    .from("cm_clientes")
    .select("responsavel, matriz, codigo_matriz, canal, regional")
    .neq("canal", "Distribuidor")
    .neq("codigo_matriz", "11111111")
    .not("matriz", "is", null)
    .not("responsavel", "is", null)
    .limit(100);

  if (busca && busca.trim()) {
    query = query.or(`matriz.ilike.%${busca.trim()}%,responsavel.ilike.%${busca.trim()}%,codigo_matriz.ilike.%${busca.trim()}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Erro ao buscar operações disponíveis para inclusão:", error);
    return [];
  }

  // Deduplicar operações por (responsavel, matriz, codigo_matriz)
  const mapOps = new Map<string, {
    gerente: string;
    rede_nome: string;
    codigo_matriz: string;
    canal: string;
    regional: string;
  }>();

  (data || []).forEach((c) => {
    const gerente = (c.responsavel || "").trim();
    const rede = (c.matriz || "").trim();
    const cod = String(c.codigo_matriz || "").trim();
    const canal = (c.canal || "").trim();
    if (!gerente || !rede || !cod || canal.toLowerCase() === "distribuidor") return;

    const key = `${gerente}:::${rede}:::${cod}`.toUpperCase();
    if (!mapOps.has(key)) {
      mapOps.set(key, {
        gerente,
        rede_nome: rede,
        codigo_matriz: cod,
        canal: canal || "KA",
        regional: c.regional || "",
      });
    }
  });

  return Array.from(mapOps.values()).sort((a, b) => a.rede_nome.localeCompare(b.rede_nome, "pt-BR"));
}

