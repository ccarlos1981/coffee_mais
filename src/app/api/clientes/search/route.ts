/**
 * GET /api/clientes/search — Client Autocomplete API
 *
 * Provides client search for dropdowns and forms without exposing Supabase directly to React.
 */

import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, handleAuthError } from "@/lib/supabase/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    await requireApprovedProfile(user.id);

    const { searchParams } = new URL(request.url);
    const queryTerm = searchParams.get("q") || searchParams.get("query") || "";
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const adminClient = createAdminClient();

    let query = adminClient
      .from("cm_clientes")
      .select("id, nome, matriz, codigo, responsavel, manager_id")
      .order("nome", { ascending: true })
      .limit(limit);

    if (queryTerm.trim()) {
      const term = `%${queryTerm.trim()}%`;
      query = query.or(`nome.ilike.${term},matriz.ilike.${term},codigo.ilike.${term}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error searching clients:", error);
      throw new Error(`Erro ao buscar clientes: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: (data || []).map(c => ({
        id: c.id,
        nome: c.nome || "Sem nome",
        rede: c.matriz || null,
        codigo: c.codigo || "",
        responsavel: c.responsavel || null,
        manager_id: c.manager_id || null,
      })),
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
