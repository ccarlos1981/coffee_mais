import { NextRequest } from "next/server";
import { requireAuthenticatedUser } from "@/lib/governance/auth";
import { successResponse, errorResponse } from "@/lib/governance/response";
import { logGovernanceError } from "@/lib/governance/logging";
import { parsePaginationParams } from "@/lib/governance/validation";
import { ERROR_CODES } from "@/lib/governance/constants";

export async function GET(req: NextRequest) {
  try {
    const { supabase } = await requireAuthenticatedUser();
    
    // Parse query params
    const { searchParams } = new URL(req.url);
    const { page, limit } = parsePaginationParams(req);
    const status = searchParams.get("status") || "";
    const search = searchParams.get("search") || "";

    // Build query
    let query = supabase
      .from("cm_ownership_requests")
      .select(`
        *,
        cm_clientes:cliente_codigo (
          nome_parceiro,
          uf,
          codigo_matriz,
          responsavel
        )
      `, { count: "exact" });

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }

    if (search) {
      if (!isNaN(Number(search))) {
        query = query.eq("cliente_codigo", Number(search));
      } else {
        query = query.ilike("justificativa", `%${search}%`);
      }
    }

    // Sort by created_at DESC
    query = query.order("created_at", { ascending: false });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    const totalRecords = count || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    return successResponse(data, {
      pagination: {
        page,
        limit,
        total_records: totalRecords,
        total_pages: totalPages
      }
    });

  } catch (err: any) {
    logGovernanceError("GET_REQUESTS", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro de carregamento", err);
    return errorResponse(
      err.status || 500,
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      err.message || "Erro ao carregar solicitações."
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const body = await req.json();

    const {
      cliente_codigo,
      uf_proposta,
      codigo_matriz_proposto,
      responsavel_proposto,
      justificativa
    } = body;

    // Validate parameters
    if (!cliente_codigo) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "Código do cliente é obrigatório.", "cliente_codigo");
    }
    if (!justificativa) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "Justificativa da solicitação é obrigatória.", "justificativa");
    }

    // Verify if client exists
    const { data: client, error: clientErr } = await supabase
      .from("cm_clientes")
      .select("nome_parceiro")
      .eq("codigo", cliente_codigo)
      .single();

    if (clientErr || !client) {
      return errorResponse(404, ERROR_CODES.NOT_FOUND, "Cliente não encontrado na base cadastral.");
    }

    // Insert request in draft status (RASCUNHO)
    const { data: request, error: insertErr } = await supabase
      .from("cm_ownership_requests")
      .insert({
        cliente_codigo,
        uf_proposta,
        codigo_matriz_proposto,
        responsavel_proposto,
        justificativa,
        status: "RASCUNHO",
        versao: 1,
        created_by: user.id,
        updated_by: user.id
      })
      .select()
      .single();

    if (insertErr || !request) {
      throw insertErr || new Error("Falha ao salvar a solicitação.");
    }

    // Write audit trail log for request creation
    const { error: logErr } = await supabase
      .from("cm_audit_ownership_log")
      .insert({
        request_id: request.id,
        action_type: "CREATE_REQUEST",
        old_value: null,
        new_value: JSON.stringify({
          uf_proposta,
          codigo_matriz_proposto,
          responsavel_proposto
        }),
        justificativa,
        executed_by: user.id
      });

    if (logErr) {
      logGovernanceError("CREATE_REQUEST_LOG_WARNING", ERROR_CODES.INTERNAL_SERVER_ERROR, logErr.message, logErr);
    }

    return successResponse(request);

  } catch (err: any) {
    logGovernanceError("POST_REQUESTS", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro de criação", err);
    return errorResponse(
      err.status || 500,
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      err.message || "Erro ao criar solicitação."
    );
  }
}
