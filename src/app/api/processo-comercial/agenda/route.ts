import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin client (anon key, sem cookies) — usado com RPC execute_readonly_query
function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createAdminClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
    },
  });
}

// Roles com acesso total
const FULL_ACCESS_ROLES = ["Admin", "CEO", "Diretor", "Gerente Nacional"];
const ALL_MANAGERS = ["Julliano", "Leandro", "Luiz", "Cristiano"];

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
    const supabaseServer = await createClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // Buscar perfil do usuário
    const { data: profile } = await supabaseServer
      .from('cm_user_profiles')
      .select('role, manager_name')
      .eq('id', user.id)
      .single();

    const userRole = profile?.role || '';
    const userManagerName = profile?.manager_name || null;
    const isFullAccess = FULL_ACCESS_ROLES.includes(userRole);

    // Todos veem a de todos
    const visibleManagers = [...ALL_MANAGERS];

    let queryManagers: string[];
    if (managerFilter === 'ALL') {
      queryManagers = visibleManagers;
    } else {
      queryManagers = visibleManagers.filter(m => m === managerFilter);
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
    const managersIn = queryManagers.map(m => `'${m}'`).join(',');
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
      if (!routesByManager[r.manager]) routesByManager[r.manager] = {};
      routesByManager[r.manager][r.route_date] = r.description;
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
    console.error('[Agenda API GET] Erro completo:', error);
    const message = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Autenticação
    const supabaseServer = await createClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    const { data: profile } = await supabaseServer
      .from('cm_user_profiles')
      .select('role, manager_name')
      .eq('id', user.id)
      .single();

    const userRole = profile?.role || '';
    const userManagerName = profile?.manager_name || null;
    const isFullAccess = FULL_ACCESS_ROLES.includes(userRole);

    const body = await request.json();
    const { routes } = body;

    if (!routes || !Array.isArray(routes)) {
      return NextResponse.json({ success: false, error: "Parâmetros inválidos." }, { status: 400 });
    }

    // Filtrar por permissão
    let filteredRoutes = routes;
    if (!isFullAccess) {
      if (userManagerName) {
        filteredRoutes = routes.filter((r: any) => r.manager === userManagerName);
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

    // Separar upserts e deletes
    const routesToUpsert = filteredRoutes
      .filter((r: any) => r.description && r.description.trim() !== '')
      .map((r: any) => ({
        manager: r.manager,
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
      // Agrupar deleções por gerente para reduzir o número de requisições ao banco
      const deletesByManager: Record<string, string[]> = {};
      routesToDelete.forEach((r: any) => {
        if (!deletesByManager[r.manager]) {
          deletesByManager[r.manager] = [];
        }
        deletesByManager[r.manager].push(r.route_date);
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
    console.error('[Agenda API POST] Erro completo:', error);
    const message = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
