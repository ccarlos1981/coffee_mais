import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Autenticação do Usuário
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // 2. Extrair dados do Multipart Form Data
    const formData = await request.formData();
    const tipoRegistro = formData.get("tipo_registro") as string;
    const timestampDispositivoStr = formData.get("timestamp_dispositivo") as string;
    const latitudeStr = formData.get("latitude") as string;
    const longitudeStr = formData.get("longitude") as string;
    const gpsAccuracyStr = formData.get("gps_accuracy") as string;
    const deviceInfoStr = formData.get("device_info") as string;
    const foto = formData.get("foto") as File | null;

    if (!tipoRegistro || !timestampDispositivoStr || !latitudeStr || !longitudeStr || !foto) {
      return NextResponse.json({ success: false, error: "Parâmetros obrigatórios ausentes." }, { status: 400 });
    }

    const latitude = parseFloat(latitudeStr);
    const longitude = parseFloat(longitudeStr);
    const gpsAccuracy = gpsAccuracyStr ? parseFloat(gpsAccuracyStr) : null;
    const deviceInfo = deviceInfoStr ? JSON.parse(deviceInfoStr) : null;
    const timestampDispositivo = new Date(timestampDispositivoStr);

    const clientActionId = formData.get("client_action_id") as string | null;
    if (clientActionId) {
      const { data: existingPonto } = await supabase
        .from("cm_promotor_jornada")
        .select("*")
        .eq("client_action_id", clientActionId)
        .maybeSingle();

      if (existingPonto) {
        return NextResponse.json({
          success: true,
          message: "Ponto batido com sucesso! (Retorno Idempotente)",
          rostoDetectado: true,
          batida: existingPonto
        });
      }
    }

    // 3. Buscar o employee_id correspondente ao usuário logado na tabela auxiliar cm_promotor_perfil
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

    const { data: employee, error: empError } = await supabase
      .from("cm_employees")
      .select("id")
      .eq("id", perfil.employee_id)
      .eq("ativo", true)
      .maybeSingle();

    if (empError || !employee) {
      return NextResponse.json({ 
        success: false, 
        error: "Funcionário ativo correspondente a este perfil não foi encontrado no cadastro." 
      }, { status: 400 });
    }

    // 4. Upload da Foto para o Supabase Storage (Bucket privado 'promotor-ponto')
    const ext = foto.name.split(".").pop() || "png";
    const sanitizedExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "");
    const fileName = `${Date.now()}-ponto.${sanitizedExt}`;
    const filePath = `${user.id}/${fileName}`;
    
    // Converte a foto para Buffer para fazer o upload
    const arrayBuffer = await foto.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("promotor-ponto")
      .upload(filePath, buffer, {
        contentType: foto.type,
        cacheControl: "3600",
        upsert: false
      });

    if (uploadError) {
      console.error("[PONTO API] Erro ao fazer upload da foto:", uploadError);
      return NextResponse.json({ success: false, error: "Erro ao salvar a foto de comprovante." }, { status: 500 });
    }

    // Obter URL privada do arquivo (para fins de persistência)
    const fotoUrl = uploadData.path;

    // 5. Validação Biométrica Facial via Google Cloud Vision API
    let rostoDetectado = true;
    const apiKey = process.env.GOOGLE_VISION_API_KEY;

    if (apiKey) {
      try {
        console.log("[PONTO API] Executando detecção facial via Google Vision...");
        const base64Image = buffer.toString("base64");
        
        const visionResponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [
              {
                image: { content: base64Image },
                features: [{ type: "FACE_DETECTION", maxResults: 1 }]
              }
            ]
          })
        });

        const visionResult = await visionResponse.json();
        const faceAnnotations = visionResult?.responses?.[0]?.faceAnnotations;

        if (!faceAnnotations || faceAnnotations.length === 0) {
          console.warn("[PONTO API] Nenhum rosto humano detectado na foto. Abortando registro de ponto.");
          rostoDetectado = false;
          
          // Deleta a foto do storage para evitar acumular arquivos sem registro associado
          await supabase.storage.from("promotor-ponto").remove([filePath]);
          
          return NextResponse.json({ 
            success: false, 
            error: "Validação biométrica falhou: Rosto humano não detectado. Por favor, tire outra selfie nítida sob boa iluminação e certifique-se de não cobrir o rosto." 
          }, { status: 400 });
        }
        
        console.log("[PONTO API] Rosto detectado com sucesso!");
      } catch (err: unknown) {
        console.error("[PONTO API] Falha na integração do Google Vision:", err);
        // Em caso de erro de conexão com a API do Google Vision, permitimos a batida mas alertamos no log do console
        // para evitar que o promotor fique impedido de trabalhar por oscilações externas do serviço Google.
      }
    } else {
      console.info("[PONTO API] GOOGLE_VISION_API_KEY ausente. Ignorando validação facial no ambiente de dev.");
    }

    // 6. Registrar a Batida de Ponto no Banco (Disparará a trigger de escalas/alertas)
    const { data: batida, error: insertError } = await supabase
      .from("cm_promotor_jornada")
      .insert({
        user_id: user.id,
        employee_id: employee.id,
        tipo_registro: tipoRegistro,
        timestamp_dispositivo: timestampDispositivo.toISOString(),
        latitude,
        longitude,
        gps_accuracy: gpsAccuracy,
        device_info: deviceInfo,
        ip_address: request.headers.get("x-forwarded-for") || "127.0.0.1",
        foto_comprovante_url: fotoUrl,
        client_action_id: clientActionId || null,
        is_offline_sync: clientActionId ? true : false
      })
      .select()
      .single();

    if (insertError) {
      console.error("[PONTO API] Erro ao salvar batida de ponto:", insertError);
      // Limpa a foto do storage em caso de falha de gravação no banco
      await supabase.storage.from("promotor-ponto").remove([filePath]);
      return NextResponse.json({ success: false, error: "Erro ao registrar a batida no banco de dados." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Ponto batido com sucesso!",
      rostoDetectado,
      batida
    });

  } catch (error: unknown) {
    console.error("[PONTO API] Erro fatal:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Erro desconhecido ao processar batida." 
    }, { status: 500 });
  }
}
