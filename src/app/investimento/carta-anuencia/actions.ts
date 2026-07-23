"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AnalyticsEngine } from "@/lib/governance/analytics/engine";
import { revalidatePath } from "next/cache";

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
  valida_ate?: string | null;
  status: "PENDENTE" | "EMITIDA" | "ENVIADA" | "ASSINADA" | "CANCELADA";
  logo_id?: string | null;
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
  // Campos virtuais de expiração, gerente, uf e farol
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

/**
 * 1. Obter e Criar Competências Parametrizadas
 */
export async function obterCompetencias(): Promise<CompetenciaItem[]> {
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
 * 2. Gestão de Logos por Rede (cm_logos_redes)
 */
export async function obterOuUploadLogoRede(redeId: string, logoUrlInput?: string) {
  const adminClient = createAdminClient();

  // Buscar logo mestre existente
  const { data: existingLogo } = await adminClient
    .from("cm_logos_redes")
    .select("*")
    .eq("rede_id", redeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existingLogo && !logoUrlInput) {
    return existingLogo;
  }

  if (logoUrlInput) {
    const { data: newLogo, error } = await adminClient
      .from("cm_logos_redes")
      .insert({
        rede_id: redeId,
        logo_url: logoUrlInput,
        origem: "MANUAL",
        validada: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao salvar logo da rede:", error);
      return existingLogo || null;
    }
    return newLogo;
  }

  return existingLogo || null;
}

/**
 * 3. Listar Cartas de Anuência com suporte a filtros de gerente, uf, status e competência
 */
export async function listarCartasAnuencia(filters?: {
  status?: string;
  rede_id?: string;
  competencia?: string;
  gerente?: string;
  uf?: string;
  busca?: string;
}): Promise<CartaAnuenciaItem[]> {
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

  // Mapear Gerente e UF utilizando a AnalyticsEngine (fonte homologada VENDAS_CLIENTE_MENSAL)
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
    const expirada = !!(item.valida_ate && item.valida_ate < hoje);
    return {
      ...item,
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
 * 4. Obter Resumo Executivo / Dashboard KPIs
 */
export async function obterResumoDashboard() {
  const adminClient = createAdminClient();

  const [{ count: totalCartas }, { data: cartas }] = await Promise.all([
    adminClient.from("cm_cartas_anuencia").select("*", { count: "exact", head: true }),
    adminClient.from("cm_cartas_anuencia").select("status, data_emissao, data_assinatura, valida_ate"),
  ]);

  const hoje = new Date().toISOString().substring(0, 10);
  let emitidas = 0;
  let pendentes = 0;
  let assinadasVigentes = 0;
  let assinadasExpiradas = 0;
  let canceladas = 0;
  let tempoTotalDias = 0;
  let totalAssinadasTempo = 0;

  (cartas || []).forEach((c) => {
    if (c.status === "ASSINADA") {
      const expirada = !!(c.valida_ate && c.valida_ate < hoje);
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
 * 5. Farol Executivo (> R$ 80k/mês nos últimos 12 meses via AnalyticsEngine)
 */
export async function obterDadosFarolExecutivo(filters?: {
  manager?: string;
  uf?: string;
  channel?: string;
  competencia?: string;
}): Promise<FarolItem[]> {
  // 1. Obter vendas dos últimos 12 meses via AnalyticsEngine V1
  const redesAnalytics = await AnalyticsEngine.getFarolAnuenciaRedes({
    manager: filters?.manager,
    uf: filters?.uf,
    channel: filters?.channel,
    minMedia: 80000,
  });

  // 2. Obter cartas ativas
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
  const hoje = new Date().toISOString().substring(0, 10);

  (cartasAtivas || []).forEach((c) => {
    // Mapear pela rede (ou id/nome)
    const key = c.rede_id.toLowerCase().trim();
    if (!cartasMap.has(key)) {
      cartasMap.set(key, {
        ...c,
        expirada: !!(c.valida_ate && c.valida_ate < hoje),
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
          farol_status = "AMARELO"; // Assinada porém expirada
          possui_carta_assinada = true;
        } else {
          farol_status = "VERDE"; // Assinada e vigente
          possui_carta_assinada = true;
        }
      } else {
        farol_status = "AMARELO"; // Emitida/pendente
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
 * 6. Gerar Nova Carta de Anuência (ou Criar Nova Versão versao++)
 */
export async function gerarCartaAnuencia(input: {
  rede_id: string;
  rede_nome: string;
  cnpj?: string;
  competencia_id?: string;
  competencia: string;
  valida_ate?: string;
  logo_url?: string;
  observacoes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminClient = createAdminClient();

  // Buscar usuário/perfil para auditoria
  let userName = "Usuário do Sistema";
  if (user) {
    const { data: profile } = await adminClient.from("profiles").select("name, full_name").eq("id", user.id).single();
    userName = profile?.full_name || profile?.name || user.email || userName;
  }

  // 1. Garantir/salvar logo em cm_logos_redes
  const logoRecord = await obterOuUploadLogoRede(input.rede_id, input.logo_url);
  const finalLogoUrl = logoRecord?.logo_url || input.logo_url || "/coffee-mais-logo.png";

  // 2. Verificação de Unicidade & Versão Incremental (versao++)
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

  // 3. Gerar Número Oficial Único (CA-YYYY-XXXXXX) via RPC SQL ou fallback
  let numeroCarta = "";
  const { data: rpcNumero, error: rpcErr } = await adminClient.rpc("fn_generate_numero_carta_anuencia");
  if (rpcErr || !rpcNumero) {
    const ano = new Date().getFullYear();
    const rand = Math.floor(100000 + Math.random() * 900000);
    numeroCarta = `CA-${ano}-${rand}`;
  } else {
    numeroCarta = rpcNumero;
  }

  // Hash único para QR Code de validação
  const qrCodeHash = Buffer.from(`${numeroCarta}:${input.rede_id}:${input.competencia}:${Date.now()}`).toString("base64url");

  // 4. Inserir a Carta
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
      valida_ate: input.valida_ate || null,
      status: "EMITIDA",
      logo_id: logoRecord?.id || null,
      logo_rede_url: finalLogoUrl,
      logo_coffee_url: "/images/logo_coffee_mais_official.svg",
      usuario_emissao: user?.id || null,
      usuario_emissao_nome: userName,
      observacoes: input.observacoes || null,
      qr_code_hash: qrCodeHash,
    })
    .select()
    .single();

  if (errInsert) {
    throw new Error(`Erro ao gerar carta de anuência: ${errInsert.message}`);
  }

  // 5. Registrar evento na Timeline
  await adminClient.from("cm_carta_anuencia_timeline").insert({
    carta_id: novaCarta.id,
    evento: "CRIADA",
    detalhes: {
      numero_carta: numeroCarta,
      versao: novaVersao,
      competencia: input.competencia,
      carta_origem_id: cartaOrigemId,
    },
    usuario_id: user?.id || null,
    usuario_nome: userName,
  });

  // 6. Auditoria Corporativa Global cm_audit_logs
  await adminClient.from("cm_audit_logs").insert({
    user_id: user?.id || null,
    action: novaVersao > 1 ? "Reemissão Versao Carta Anuência" : "Emissão Carta Anuência",
    table_name: "cm_cartas_anuencia",
    new_data: {
      id: novaCarta.id,
      numero_carta: numeroCarta,
      versao: novaVersao,
      rede_nome: input.rede_nome,
      competencia: input.competencia,
    },
  });

  revalidatePath("/investimento/carta-anuencia");
  return novaCarta as CartaAnuenciaItem;
}

/**
 * 6.1. Editar Carta de Anuência (Máquina de Estados & Trava Backend)
 * Impede estritamente edições em cartas com status ASSINADA ou CANCELADA.
 */
export async function editarCartaAnuencia(input: {
  carta_id: string;
  rede_id: string;
  rede_nome: string;
  cnpj?: string;
  competencia_id?: string;
  competencia: string;
  valida_ate?: string;
  logo_url?: string;
  observacoes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminClient = createAdminClient();

  // 1. Buscar a carta atual no banco de dados para validar status física no servidor
  const { data: cartaAtual, error: errFetch } = await adminClient
    .from("cm_cartas_anuencia")
    .select("*")
    .eq("id", input.carta_id)
    .single();

  if (errFetch || !cartaAtual) {
    throw new Error("Carta de Anuência não encontrada para edição.");
  }

  // 2. VALIDAÇÃO DE SEGURANÇA NO SERVIDOR (MÁQUINA DE ESTADOS)
  if (cartaAtual.status === "ASSINADA" || cartaAtual.status === "CANCELADA") {
    throw new Error(
      `Documento com status ${cartaAtual.status} é oficial e não pode ser editado. Para modificações, emita uma nova versão.`
    );
  }

  // 3. Buscar usuário/perfil para auditoria
  let userName = "Usuário do Sistema";
  if (user) {
    const { data: profile } = await adminClient.from("profiles").select("name, full_name").eq("id", user.id).single();
    userName = profile?.full_name || profile?.name || user.email || userName;
  }

  // 4. Garantir/salvar logo em cm_logos_redes
  const logoRecord = await obterOuUploadLogoRede(input.rede_id, input.logo_url);
  const finalLogoUrl = logoRecord?.logo_url || input.logo_url || cartaAtual.logo_rede_url || "/coffee-mais-logo.png";

  // 5. Mapear campos alterados para a auditoria
  const camposAlterados: Record<string, { de: any; para: any }> = {};

  if (cartaAtual.rede_id !== input.rede_id) camposAlterados.rede_id = { de: cartaAtual.rede_id, para: input.rede_id };
  if (cartaAtual.rede_nome !== input.rede_nome) camposAlterados.rede_nome = { de: cartaAtual.rede_nome, para: input.rede_nome };
  if ((cartaAtual.cnpj || "") !== (input.cnpj || "")) camposAlterados.cnpj = { de: cartaAtual.cnpj, para: input.cnpj };
  if (cartaAtual.competencia !== input.competencia) camposAlterados.competencia = { de: cartaAtual.competencia, para: input.competencia };
  if ((cartaAtual.valida_ate || "") !== (input.valida_ate || "")) camposAlterados.valida_ate = { de: cartaAtual.valida_ate, para: input.valida_ate };
  if ((cartaAtual.observacoes || "") !== (input.observacoes || "")) camposAlterados.observacoes = { de: cartaAtual.observacoes, para: input.observacoes };

  // 6. Atualizar a carta no banco
  const { data: cartaEditada, error: errUpdate } = await adminClient
    .from("cm_cartas_anuencia")
    .update({
      rede_id: input.rede_id,
      rede_nome: input.rede_nome,
      cnpj: input.cnpj || null,
      competencia_id: input.competencia_id || null,
      competencia: input.competencia,
      valida_ate: input.valida_ate || null,
      logo_id: logoRecord?.id || cartaAtual.logo_id,
      logo_rede_url: finalLogoUrl,
      observacoes: input.observacoes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.carta_id)
    .select()
    .single();

  if (errUpdate) {
    throw new Error(`Erro ao atualizar carta de anuência: ${errUpdate.message}`);
  }

  // 7. Registrar evento na Timeline
  await adminClient.from("cm_carta_anuencia_timeline").insert({
    carta_id: input.carta_id,
    evento: "EDITADA",
    detalhes: {
      numero_carta: cartaAtual.numero_carta,
      versao: cartaAtual.versao,
      campos_alterados: camposAlterados,
    },
    usuario_id: user?.id || null,
    usuario_nome: userName,
  });

  // 8. Auditoria Corporativa Global cm_audit_logs
  await adminClient.from("cm_audit_logs").insert({
    user_id: user?.id || null,
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
  return cartaEditada as CartaAnuenciaItem;
}

/**
 * 7. Registrar Compartilhamento por Canal (EMAIL, WHATSAPP, LINK, DOWNLOAD)
 */
export async function registrarCompartilhamento(
  cartaId: string,
  canal: "EMAIL" | "WHATSAPP" | "LINK" | "DOWNLOAD",
  detalhesAdicionais?: any
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminClient = createAdminClient();

  let userName = "Usuário do Sistema";
  if (user) {
    const { data: profile } = await adminClient.from("profiles").select("name, full_name").eq("id", user.id).single();
    userName = profile?.full_name || profile?.name || user.email || userName;
  }

  // Atualizar status se ainda estivesse EMITIDA -> ENVIADA
  const { data: carta } = await adminClient.from("cm_cartas_anuencia").select("status").eq("id", cartaId).single();
  if (carta && carta.status === "EMITIDA" && canal !== "DOWNLOAD") {
    await adminClient.from("cm_cartas_anuencia").update({ status: "ENVIADA" }).eq("id", cartaId);
  }

  // Registrar na Timeline
  await adminClient.from("cm_carta_anuencia_timeline").insert({
    carta_id: cartaId,
    evento: canal === "DOWNLOAD" ? "DOWNLOAD" : "COMPARTILHADA",
    canal: canal,
    detalhes: detalhesAdicionais || {},
    usuario_id: user?.id || null,
    usuario_nome: userName,
  });

  // Registrar em cm_audit_logs
  await adminClient.from("cm_audit_logs").insert({
    user_id: user?.id || null,
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminClient = createAdminClient();

  let userName = "Usuário do Sistema";
  if (user) {
    const { data: profile } = await adminClient.from("profiles").select("name, full_name").eq("id", user.id).single();
    userName = profile?.full_name || profile?.name || user.email || userName;
  }

  const dataAssinatura = new Date().toISOString();

  const { data: cartaAtualizada, error } = await adminClient
    .from("cm_cartas_anuencia")
    .update({
      status: "ASSINADA",
      arquivo_assinado_url: arquivoAssinadoUrl,
      data_assinatura: dataAssinatura,
      usuario_assinatura: user?.id || null,
      usuario_assinatura_nome: userName,
      updated_at: dataAssinatura,
    })
    .eq("id", cartaId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao registrar carta assinada: ${error.message}`);
  }

  // Registrar na Timeline
  await adminClient.from("cm_carta_anuencia_timeline").insert({
    carta_id: cartaId,
    evento: "UPLOAD_ASSINADA",
    detalhes: {
      arquivo_assinado_url: arquivoAssinadoUrl,
      data_assinatura: dataAssinatura,
    },
    usuario_id: user?.id || null,
    usuario_nome: userName,
  });

  // Registrar em cm_audit_logs
  await adminClient.from("cm_audit_logs").insert({
    user_id: user?.id || null,
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
 * 9. Cancelar Carta de Anuência
 */
export async function cancelarCartaAnuencia(cartaId: string, motivo: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminClient = createAdminClient();

  let userName = "Usuário do Sistema";
  if (user) {
    const { data: profile } = await adminClient.from("profiles").select("name, full_name").eq("id", user.id).single();
    userName = profile?.full_name || profile?.name || user.email || userName;
  }

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

  // Timeline
  await adminClient.from("cm_carta_anuencia_timeline").insert({
    carta_id: cartaId,
    evento: "CANCELADA",
    detalhes: { motivo },
    usuario_id: user?.id || null,
    usuario_nome: userName,
  });

  // Audit
  await adminClient.from("cm_audit_logs").insert({
    user_id: user?.id || null,
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
