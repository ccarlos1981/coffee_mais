import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from '@/lib/supabase/auth-helpers';

export async function GET() {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, 'E-mails');

    const adminClient = createAdminClient();
    const { data: { users }, error } = await adminClient.auth.admin.listUsers();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const emailMap = users.reduce((acc: any, user: any) => {
      acc[user.id] = user.email;
      return acc;
    }, {});

    return NextResponse.json(emailMap);
  } catch (err: any) {
    return handleAuthError(err);
  }
}
