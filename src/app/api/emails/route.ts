import { NextResponse } from "next/server";
import {
  requireAuth,
  requireApprovedProfile,
  requireRole,
  handleAuthError,
  logAuditAction,
} from "@/lib/supabase/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = 'nodejs';

const ALLOWED_ROLES = ["Admin", "Admin Master", "CEO"];

export async function GET() {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    requireRole(profile, ALLOWED_ROLES);

    const adminClient = createAdminClient();
    const { data: emails, error } = await adminClient
      .from('cm_report_recipients')
      .select('*')
      .order('added_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, emails });
  } catch (error: unknown) {
    return handleAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    requireRole(profile, ALLOWED_ROLES);

    const body = await request.json();
    const { email, name } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ success: false, error: "E-mail inválido." }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data: inserted, error } = await adminClient
      .from('cm_report_recipients')
      .insert({ email: email.trim().toLowerCase(), name: (name || '').trim() })
      .select()
      .single();

    if (error) throw error;

    await logAuditAction(user.id, "INSERT_REPORT_RECIPIENT", "cm_report_recipients", { email, name });

    return NextResponse.json({ success: true, data: inserted });
  } catch (error: unknown) {
    return handleAuthError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    requireRole(profile, ALLOWED_ROLES);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ success: false, error: "ID obrigatório." }, { status: 400 });

    const adminClient = createAdminClient();
    const { error } = await adminClient.from('cm_report_recipients').delete().eq('id', id);

    if (error) throw error;

    await logAuditAction(user.id, "DELETE_REPORT_RECIPIENT", "cm_report_recipients", { id });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleAuthError(error);
  }
}

