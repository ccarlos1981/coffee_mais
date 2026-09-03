"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireApprovedProfile, requireRole } from "@/lib/supabase/auth-helpers";
import { AnalyticsEngine } from "@/lib/governance/analytics/engine";
import { revalidatePath } from "next/cache";
import { getStoragePublicUrl } from "@/lib/storage-helpers";
import { calculateBufferHash, getImageDimensionsFromBuffer } from "@/lib/server-image-helpers";
import { calcularValidadeCartaAnuencia, verificarCartaExpirada } from "./validade-helper";

export const CARTA_ANUENCIA_ALLOWED_ROLES = [
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
  await requireApprovedProfile(user.id);

  const adminClient = createAdminClient();
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

  const redesMeta = await AnalyticsEngine.getMapeamentoRedesMeta();

  const metaMap = new Map<string, { manager: string | null; uf: string | null }>();
  (redesMeta || []).forEach((row) => {
    if (row.rede) {
      const key = row.rede.toLowerCase().trim();
      if (!metaMap.has(key)) {
        metaMap.set(key, {
          manager: row.manager || null,
          uf: row.uf || null,
        });
      }
    }
  });

  const hoje = new Date().toISOString().substring(0, 10);

  let result = (data || []).map((item) => {
    const key = (item.rede_nome || item.rede_id || "").toLowerCase().trim();
    const meta = metaMap.get(key) || { manager: null, uf: null };
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

  if (filters?.gerente && filters.gerente !== "TODOS") {
    result = result.filter((c) => c.gerente === filters.gerente);
  }
  if (filters?.uf && filters.uf !== "TODAS") {
    result = result.filter((c) => c.uf === filters.uf);
  }

  return result;
}

export async function obterFiltrosGerenteUf() {
  return AnalyticsEngine.getFiltrosGerenteUf();
}

/**
 * 4. Resumo Executivo / KPIs
 */
export async function obterResumoDashboard() {
  const user = await requireAuth();
  await requireApprovedProfile(user.id);

  const adminClient = createAdminClient();

  const [{ count: totalCartas }, { data: cartas }] = await Promise.all([
    adminClient.from("cm_cartas_anuencia").select("*", { count: "exact", head: true }),
    adminClient.from("cm_cartas_anuencia").select("status, data_emissao, data_assinatura, validade_ate"),
  ]);

  let emitidas = 0;
  let pendentes = 0;
  let assinadasVigentes = 0;
  let assinadasExpiradas = 0;
  let canceladas = 0;
  let tempoTotalDias = 0;
  let totalAssinadasTempo = 0;

  (cartas || []).forEach((c) => {
    if (c.status === "ASSINADA") {
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
      pendentes++;
      emitidas++;
    } else if (c.status === "CANCELADA") {
      canceladas++;
    }
  });

  const tempoMedioAssinaturaDias = totalAssinadasTempo > 0 ? Math.round(tempoTotalDias / totalAssinadasTempo) : 0;

  return {
    totalCartas: totalCartas || 0,
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

  const redesAnalytics = await AnalyticsEngine.getFarolAnuenciaRedes({
    manager: filters?.manager,
    uf: filters?.uf,
    channel: filters?.channel,
    minMedia: 80000,
  });

  const adminClient = createAdminClient();
  let cartasQuery = adminClient
    .from("cm_cartas_anuencia")
    .select("*")
    .neq("status", "CANCELADA")
    .order("created_at", { ascending: false });

  if (filters?.competencia) {
    cartasQuery = cartasQuery.eq("competencia", filters.competencia);
  }

  const { data: cartasAtivas } = await cartasQuery;

  const cartasMap = new Map<string, CartaAnuenciaItem>();

  (cartasAtivas || []).forEach((c) => {
    const key = c.rede_id.toLowerCase().trim();
    if (!cartasMap.has(key)) {
      cartasMap.set(key, {
        ...c,
        logo_rede_url: getStoragePublicUrl(c.logo_snapshot_path || c.logo_rede_url, "logos-redes"),
        expirada: verificarCartaExpirada(c.validade_ate),
      });
    }
  });

  return redesAnalytics.map((r) => {
    const key = (r.rede || "").toLowerCase().trim();
    const carta = cartasMap.get(key) || null;

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

  const { data: carta } = await adminClient.from("cm_cartas_anuencia").select("status").eq("id", cartaId).single();
  if (carta && carta.status === "EMITIDA" && canal !== "DOWNLOAD") {
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

  await adminClient.from("cm_carta_anuencia_timeline").insert({
    carta_id: cartaId,
    evento: "UPLOAD_ASSINADA",
    detalhes: {
      arquivo_assinado_url: arquivoAssinadoUrl,
      data_assinatura: dataAssinatura,
    },
    usuario_id: user.id,
    usuario_nome: userName,
  });

  await safeInsertAuditLog(adminClient, {
    user_id: user.id,
    action: "Upload Carta Assinada (Baixa Automática Farol)",
    table_name: "cm_cartas_anuencia",
    new_data: {
      carta_id: cartaId,
      numero_carta: cartaAtualizada.numero_carta,
      arquivo_assinado_url: arquivoAssinadoUrl,
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
  const { data: carta, error: fetchErr } = await adminClient
    .from("cm_cartas_anuencia")
    .select("id, numero_carta, status")
    .eq("id", cartaId)
    .single();

  if (fetchErr || !carta) {
    throw new Error("Carta de anuência não encontrada.");
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
  await requireApprovedProfile(user.id);

  const adminClient = createAdminClient();
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
