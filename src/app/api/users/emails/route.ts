import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
