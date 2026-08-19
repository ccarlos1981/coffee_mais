import { NextRequest, NextResponse } from 'next/server';
import { getRdmData } from '@/lib/dre-gerencial/engine';
import { createClient } from '@/lib/supabase/server';
import { requireApprovedProfile } from '@/lib/supabase/auth-helpers';
import { resolveCanonicalManager, isSameManager } from '@/lib/domain/canonical';

const FULL_ACCESS_ROLES = ["Admin", "Admin Master", "CEO", "Gerente Nacional", "Diretor"];
const GERENTE_NACIONAL_EMAILS = ["cristiano@coffeemais.com", "cristiano.santos@coffeemais.com"];

function checkIsGerenteNacionalAdmin(role?: string | null, email?: string | null): boolean {
  if (role && FULL_ACCESS_ROLES.includes(role)) {
    return true;
  }
  if (email && GERENTE_NACIONAL_EMAILS.includes(email.toLowerCase().trim())) {
    return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  try {
    const supabaseServer = await createClient();
    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const profile = await requireApprovedProfile(user.id);
    const isFullAccess = checkIsGerenteNacionalAdmin(profile.role, user.email);

    const { searchParams } = req.nextUrl;
    const ano = Number(searchParams.get('ano') || new Date().getFullYear());
    const competencia = searchParams.get('competencia') || undefined;
    const gerente = searchParams.get('gerente') || undefined;
    const canal = searchParams.get('canal') || 'KA';
    const rede = searchParams.get('rede') || undefined;

    if (!competencia) {
      return NextResponse.json({ error: 'Parâmetro "competencia" obrigatório' }, { status: 400 });
    }

    let gerenteFilter = gerente;
    if (!isFullAccess) {
      const userCanonical = resolveCanonicalManager(profile.manager_name || profile.name);
      if (gerente && !isSameManager(gerente, userCanonical.managerName)) {
        return NextResponse.json({
          error: `Acesso negado (403 Forbidden): Você só possui permissão para visualizar os dados da sua própria regional (${userCanonical.managerName}).`,
        }, { status: 403 });
      }
      gerenteFilter = userCanonical.managerName;
    }

    const data = await getRdmData({ ano, competencia, gerente: gerenteFilter, canal, rede });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    console.error('[RDM Gerencial API]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
