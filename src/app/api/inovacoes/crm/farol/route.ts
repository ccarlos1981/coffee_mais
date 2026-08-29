import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { ClientFarolService } from "@/lib/services/client-farol-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);

    try {
      await requirePermission(profile.role, "Vendas");
    } catch {
      try {
        await requirePermission(profile.role, "Processo Comercial");
      } catch {
        await requirePermission(profile.role, "Inovações");
      }
    }

    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get("clienteId") || searchParams.get("cliente_id") || undefined;
    const codParceiro = searchParams.get("codParceiro") || searchParams.get("cod_parceiro") || undefined;
    const codigoMatriz = searchParams.get("codigoMatriz") || searchParams.get("codigo_matriz") || undefined;
    const redeId = searchParams.get("redeId") || searchParams.get("rede_id") || undefined;
    const redeNome = searchParams.get("redeNome") || searchParams.get("rede_nome") || undefined;

    if (!clienteId && !codParceiro && !codigoMatriz && !redeId && !redeNome) {
      return NextResponse.json(
        { success: false, error: "Parâmetros insuficientes para identificar o cliente." },
        { status: 400 }
      );
    }

    const farol = await ClientFarolService.getFarol({
      clienteId,
      codParceiro,
      codigoMatriz,
      redeId,
      redeNome,
    });

    return NextResponse.json({
      success: true,
      data: farol,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
