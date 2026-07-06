import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Lote ID é obrigatório" }, { status: 400 });
    }

    const { data: logEntry, error } = await supabase
      .from("cm_sync_logs")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !logEntry) {
      return NextResponse.json({ error: "Lote de importação não encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      log: logEntry,
    });
  } catch (err: any) {
    console.error("[API Status] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
