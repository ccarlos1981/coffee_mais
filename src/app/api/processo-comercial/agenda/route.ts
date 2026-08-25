import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { CommercialDomainService } from "@/lib/domain";
import { resolveCanonicalManager, isSameManager } from "@/lib/domain/canonical";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin client real — usado com RPC execute_readonly_query
function getSupabaseAdminClient() {
  return createAdminClient();
}

// Roles com acesso total
const FULL_ACCESS_ROLES = ["Admin", "CEO", "Diretor", "Gerente Nacional"];
const ALL_MANAGERS = [
  ...CommercialDomainService.getFieldManagerList().map(m => resolveCanonicalManager(m).managerName),
  "Cristiano"
].filter((v, i, a) => a.indexOf(v) === i);

// Helper para obter dias úteis (seg-sex) de um mês
function getWeekdaysOfMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const date = new Date(Date.UTC(year, month - 1, 1));

  while (date.getUTCMonth() === month - 1) {
    const dow = date.getUTCDay();
    if (dow >= 1 && dow <= 5) {
      days.push(date.toISOString().split('T')[0]);
    }
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return days;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
    const managerFilter = searchParams.get('manager') || 'ALL';

    // --- Autenticação via server client (com cookies) ---
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Agenda");

    const userRole = profile.role || '';
    const userManagerName = profile.manager_name ? resolveCanonicalManager(profile.manager_name).managerName : null;
    const isFullAccess = FULL_ACCESS_ROLES.includes(userRole);

    // Todos veem a de todos
    const visibleManagers = [...ALL_MANAGERS];

    let queryManagers: string[];
    if (managerFilter === 'ALL') {
      queryManagers = visibleManagers;
    } else {
      queryManagers = visibleManagers.filter(m => isSameManager(m, managerFilter) || m === managerFilter);
    }

    // Dias úteis do mês
    const weekdays = getWeekdaysOfMonth(year, month);

    // Se não há gerentes visíveis/consultados, retornar vazio para evitar erro de sintaxe SQL IN ()
    if (queryManagers.length === 0) {
      return NextResponse.json({
        success: true,
        year,
        month,
        weekdays,
        managers: [],
        visibleManagers: [],
        routesByManager: {},
        isFullAccess,
        currentUserManagerName: userManagerName,
        restrictedToManager: null,
      });
    }

    // --- Buscar rotas via RPC execute_readonly_query (mesmo padrão do RPS) ---
    const supabase = getSupabaseAdminClient();
    const managersIn = queryManagers
      .flatMap(m => [m, resolveCanonicalManager(m).managerName])
      .filter((v, i, a) => a.indexOf(v) === i)
      .map(m => `'${m}'`)
      .join(',');
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const sql = `
      SELECT manager, route_date::text as route_date, description
      FROM cm_agenda_rotas
      WHERE manager IN (${managersIn})
        AND route_date >= '${startDate}'
        AND route_date <= '${endDate}'
      ORDER BY route_date ASC
    `;

    const { data: routes, error: rpcError } = await supabase.rpc('execute_readonly_query', { query_text: sql });

    if (rpcError) {
      console.error('[Agenda API GET] RPC error:', JSON.stringify(rpcError));
      throw new Error(rpcError.message || 'Erro ao consultar rotas');
    }

    // Organizar por gerente -> { date: description }
    const routesByManager: Record<string, Record<string, string>> = {};
    queryManagers.forEach(m => { routesByManager[m] = {}; });

    ((routes || []) as any[]).forEach((r) => {
      const canonicalMgr = resolveCanonicalManager(r.manager).managerName;
      const targetMgr = queryManagers.find(m => isSameManager(m, canonicalMgr)) || canonicalMgr;
      if (!routesByManager[targetMgr]) routesByManager[targetMgr] = {};
      routesByManager[targetMgr][r.route_date] = r.description;
    });

    return NextResponse.json({
      success: true,
      year,
      month,
      weekdays,
      managers: queryManagers,
      visibleManagers,
      routesByManager,
      isFullAccess,
      currentUserManagerName: userManagerName,
      restrictedToManager: null,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Agenda");

    const userRole = profile.role || '';
    const userManagerName = profile.manager_name || profile.name || null;
    const isFullAccess = FULL_ACCESS_ROLES.includes(userRole);

    const supabaseServer = await createClient();

    const body = await request.json();
    const { routes } = body;

    if (!routes || !Array.isArray(routes)) {
      return NextResponse.json({ success: false, error: "Parâmetros inválidos." }, { status: 400 });
    }

    // Filtrar por permissão com comparação canônica
    let filteredRoutes = routes;
    if (!isFullAccess) {
      if (userManagerName) {
        filteredRoutes = routes.filter((r: any) => isSameManager(r.manager, userManagerName));
      } else {
        filteredRoutes = []; // Se não for Admin e não tiver manager_name, não pode salvar nada
      }
    }

    // Bloquear alterações em datas no passado (fuso de Brasília)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const dVal = parts.find(p => p.type === 'day')?.value;
    const todayStr = `${y}-${m}-${dVal}`;

    filteredRoutes = filteredRoutes.filter((r: any) => r.route_date >= todayStr);

    // Separar upserts e deletes garantindo normalização canônica do managerName
    const routesToUpsert = filteredRoutes
      .filter((r: any) => r.description && r.description.trim() !== '')
      .map((r: any) => ({
        manager: resolveCanonicalManager(r.manager).managerName,
        route_date: r.route_date,
        description: r.description.trim(),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }));

    const routesToDelete = filteredRoutes
      .filter((r: any) => !r.description || r.description.trim() === '');

    // Usar o server client (autenticado) para escritas
    if (routesToUpsert.length > 0) {
      const { error: upsertError } = await supabaseServer
        .from('cm_agenda_rotas')
        .upsert(routesToUpsert, { onConflict: 'manager,route_date' });

      if (upsertError) {
        console.error('[Agenda API POST] Upsert error:', JSON.stringify(upsertError));
        throw new Error(upsertError.message || 'Erro ao salvar rotas');
      }
    }

    if (routesToDelete.length > 0) {
      // Agrupar deleções por gerente canônico para reduzir o número de requisições ao banco
      const deletesByManager: Record<string, string[]> = {};
      routesToDelete.forEach((r: any) => {
        const canonicalMgr = resolveCanonicalManager(r.manager).managerName;
        if (!deletesByManager[canonicalMgr]) {
          deletesByManager[canonicalMgr] = [];
        }
        deletesByManager[canonicalMgr].push(r.route_date);
      });

      // Executar as deleções em paralelo para máxima performance
      await Promise.all(
        Object.entries(deletesByManager).map(async ([mgr, dates]) => {
          const { error: delError } = await supabaseServer
            .from('cm_agenda_rotas')
            .delete()
            .eq('manager', mgr)
            .in('route_date', dates);

          if (delError) {
            console.error(`[Agenda API POST] Delete error for manager ${mgr}:`, JSON.stringify(delError));
            throw new Error(delError.message || `Erro ao limpar rotas antigas de ${mgr}`);
          }
        })
      );
    }

    return NextResponse.json({ success: true, upserted: routesToUpsert.length, deleted: routesToDelete.length });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
