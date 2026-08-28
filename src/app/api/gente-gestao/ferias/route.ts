import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CommercialDomainService } from "@/lib/domain";
import { requireAuth, requireApprovedProfile, handleAuthError } from "@/lib/supabase/auth-helpers";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FULL_ACCESS_ROLES = ["Admin", "Admin Master", "CEO", "Diretor", "Gerente Nacional"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
    const employeeFilter = searchParams.get('employee') || searchParams.get('manager') || 'ALL';

    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    const supabaseServer = await createClient();

    const userRole = profile?.role || '';
    const userDisplayName = profile?.name || profile?.manager_name || '';
    const isFullAccess = FULL_ACCESS_ROLES.includes(userRole);

    // Fetch all active employees from cm_employees
    const { data: dbEmployees } = await supabaseServer
      .from('cm_employees')
      .select('nome_completo')
      .eq('ativo', true);

    // Fetch all active users from cm_user_profiles
    const { data: dbProfiles } = await supabaseServer
      .from('cm_user_profiles')
      .select('name, manager_name');

    const employeeSet = new Set<string>();
    
    dbEmployees?.forEach(e => {
      if (e.nome_completo) employeeSet.add(e.nome_completo.trim());
    });
    dbProfiles?.forEach(p => {
      if (p.name) employeeSet.add(p.name.trim());
      if (p.manager_name) employeeSet.add(p.manager_name.trim());
    });
    
    // Add default managers as fallback
    [...CommercialDomainService.getFieldManagerList(), "Cristiano"].forEach(m => employeeSet.add(m));

    const sortedEmployees = Array.from(employeeSet).sort();

    // Date range of the requested year
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Query vacations overlapping the year
    let query = supabaseServer
      .from('cm_ferias')
      .select('id, employee_name, start_date, end_date, description')
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (!isFullAccess) {
      query = query.eq('employee_name', userDisplayName);
    } else if (employeeFilter !== 'ALL') {
      query = query.eq('employee_name', employeeFilter);
    }

    const { data: vacations, error: fetchError } = await query.order('start_date', { ascending: true });

    if (fetchError) {
      console.error('[Vacation API GET] Fetch error:', fetchError);
      throw new Error(fetchError.message || 'Erro ao consultar férias');
    }

    return NextResponse.json({
      success: true,
      year,
      month,
      vacations: vacations || [],
      employees: sortedEmployees,
      isFullAccess,
      currentUserManagerName: userDisplayName,
      restrictedToManager: isFullAccess ? null : userDisplayName,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    const supabaseServer = await createClient();

    const userRole = profile?.role || '';
    const userDisplayName = profile?.name || profile?.manager_name || '';
    const isFullAccess = FULL_ACCESS_ROLES.includes(userRole);

    const body = await request.json();
    const { action } = body;

    if (action === "add") {
      const { employee_name, start_date, end_date, description } = body;

      if (!employee_name || !start_date || !end_date) {
        return NextResponse.json({ success: false, error: "Campos obrigatórios ausentes." }, { status: 400 });
      }

      if (start_date > end_date) {
        return NextResponse.json({ success: false, error: "Data de início não pode ser após a data de fim." }, { status: 400 });
      }

      // Check permission: must be full access or adding for themselves
      if (!isFullAccess && employee_name !== userDisplayName) {
        return NextResponse.json({ success: false, error: "Você não tem permissão para adicionar férias para este colaborador." }, { status: 403 });
      }

      // Check for overlapping vacations
      const { data: overlap } = await supabaseServer
        .from('cm_ferias')
        .select('id')
        .eq('employee_name', employee_name)
        .lte('start_date', end_date)
        .gte('end_date', start_date)
        .limit(1)
        .maybeSingle();

      if (overlap) {
        return NextResponse.json({ success: false, error: "Este colaborador já possui férias cadastradas que se sobrepõem a este período." }, { status: 400 });
      }

      const { data, error: insertError } = await supabaseServer
        .from('cm_ferias')
        .insert({
          employee_name,
          start_date,
          end_date,
          description: description || 'Férias',
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('[Vacation API POST] Insert error:', insertError);
        throw new Error(insertError.message || 'Erro ao inserir férias');
      }

      return NextResponse.json({ success: true, vacation: data });

    } else if (action === "delete") {
      const { id } = body;

      if (!id) {
        return NextResponse.json({ success: false, error: "ID ausente." }, { status: 400 });
      }

      // If not full access, check if the vacation belongs to the user
      if (!isFullAccess) {
        const { data: vacation, error: getError } = await supabaseServer
          .from('cm_ferias')
          .select('employee_name')
          .eq('id', id)
          .single();

        if (getError || !vacation) {
          return NextResponse.json({ success: false, error: "Férias não encontradas." }, { status: 404 });
        }

        if (vacation.employee_name !== userDisplayName) {
          return NextResponse.json({ success: false, error: "Você não tem permissão para excluir estas férias." }, { status: 403 });
        }
      }

      const { error: deleteError } = await supabaseServer
        .from('cm_ferias')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('[Vacation API POST] Delete error:', deleteError);
        throw new Error(deleteError.message || 'Erro ao excluir férias');
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: "Ação inválida." }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[Vacation API POST] General error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
