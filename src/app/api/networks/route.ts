import { NextResponse } from "next/server";
import {
  requireAuth,
  requireApprovedProfile,
  handleAuthError,
} from "@/lib/supabase/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await requireAuth();
    await requireApprovedProfile(user.id);

    const supabase = createAdminClient();
    const { data: networks, error } = await supabase
      .from('network_matrix')
      .select('*')
      .order('network', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, networks });
  } catch (error: unknown) {
    return handleAuthError(error);
  }
}

