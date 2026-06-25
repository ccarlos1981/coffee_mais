import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registerFraudIncident } from "@/lib/antifraud/fraud-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // 2. Parse request payload
    const { device_fingerprint, device_model, os_name, os_version, app_version } = await request.json();
    if (!device_fingerprint) {
      return NextResponse.json({ success: false, error: "device_fingerprint é obrigatório." }, { status: 400 });
    }

    // 3. Fetch promotor employee ID
    const { data: perfil, error: perfilError } = await supabase
      .from("cm_promotor_perfil")
      .select("employee_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (perfilError || !perfil) {
      return NextResponse.json({ 
        success: false, 
        error: "Perfil de promotor digital correspondente a este usuário não foi encontrado." 
      }, { status: 400 });
    }

    const employeeId = perfil.employee_id;

    // 4. Check existing device bindings
    const { data: bindings, error: bindingsError } = await supabase
      .from("cm_promotor_device_binding")
      .select("*")
      .eq("promotor_id", employeeId);

    if (bindingsError) {
      console.error("[DEVICE VALIDATE API] Erro ao buscar device bindings:", bindingsError);
      return NextResponse.json({ success: false, error: "Erro ao consultar vinculação de dispositivos." }, { status: 500 });
    }

    // Case 1: First login (no devices registered yet) -> Bind automatically as approved
    if (!bindings || bindings.length === 0) {
      const { data: newBinding, error: insertError } = await supabase
        .from("cm_promotor_device_binding")
        .insert({
          promotor_id: employeeId,
          device_fingerprint,
          device_model,
          os_name,
          os_version,
          app_version,
          is_approved: true, // First device is auto-approved
          is_blocked: false,
          last_seen_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error("[DEVICE VALIDATE API] Erro ao registrar primeiro device binding:", insertError);
        return NextResponse.json({ success: false, error: "Erro ao registrar o dispositivo." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Dispositivo vinculado e aprovado com sucesso.",
        binding: newBinding
      });
    }

    // Case 2: Check if device fingerprint matches existing bindings
    const matchedBinding = bindings.find(b => b.device_fingerprint === device_fingerprint);

    if (matchedBinding) {
      if (matchedBinding.is_blocked) {
        return NextResponse.json({
          success: false,
          code: "DEVICE_BLOCKED",
          error: "Este aparelho foi bloqueado pelo supervisor e não pode acessar o sistema."
        }, { status: 403 });
      }

      // Update last_seen_at, app_version, and device metadata on success/verification check
      const { data: updatedBinding } = await supabase
        .from("cm_promotor_device_binding")
        .update({
          last_seen_at: new Date().toISOString(),
          app_version,
          device_model,
          os_name,
          os_version
        })
        .eq("id", matchedBinding.id)
        .select()
        .single();

      if (matchedBinding.is_approved) {
        return NextResponse.json({
          success: true,
          message: "Aparelho autorizado.",
          binding: updatedBinding || matchedBinding
        });
      } else {
        return NextResponse.json({
          success: false,
          code: "DEVICE_PENDING_APPROVAL",
          error: "Este aparelho está pendente de aprovação pelo supervisor."
        }, { status: 403 });
      }
    }

    // Case 3: Fingerprint is new, but there are already registered devices -> Bind as PENDING approval and block login
    const { data: newPendingBinding, error: insertPendingError } = await supabase
      .from("cm_promotor_device_binding")
      .insert({
        promotor_id: employeeId,
        device_fingerprint,
        device_model,
        os_name,
        os_version,
        app_version,
        is_approved: false, // Subsequent devices require supervisor approval
        is_blocked: false,
        last_seen_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertPendingError) {
      console.error("[DEVICE VALIDATE API] Erro ao registrar device binding pendente:", insertPendingError);
      return NextResponse.json({ success: false, error: "Erro ao registrar novo dispositivo." }, { status: 500 });
    }

    // Log the device change event to cm_mobile_app_logs and register the fraud incident
    await supabase.from("cm_mobile_app_logs").insert({
      promotor_id: employeeId,
      device_id: device_fingerprint,
      app_version: app_version || "1.0.0",
      os: `${os_name || "Unknown"} ${os_version || ""}`.trim(),
      event_type: "DEVICE_CHANGED",
      severity: "WARN",
      payload_json: {
        device_model,
        attempted_at: new Date().toISOString()
      }
    });

    const todayStr = new Date().toISOString().split("T")[0];
    await registerFraudIncident(employeeId, "device_change", todayStr);

    return NextResponse.json({
      success: false,
      code: "DEVICE_BLOCKED_PENDING_APPROVAL",
      error: "Novo aparelho detectado. Solicite a aprovação do seu supervisor no painel.",
      binding: newPendingBinding
    }, { status: 403 });
  } catch (error: unknown) {
    console.error("[DEVICE VALIDATE API] Erro fatal:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Erro desconhecido ao validar dispositivo." 
    }, { status: 500 });
  }
}
