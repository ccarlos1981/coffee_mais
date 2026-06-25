import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const GESTOR_ROLES = ["Supervisor", "CEO", "Admin", "Trade"];

interface ExcelRouteRow {
  "CPF do Promotor": any;
  "Código do PDV": any;
  "Dia da Semana (1-7)": any;
  "Duração Estimada (Minutos)": any;
  "Motivo da Visita": any;
  "Criticidade": any;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validar autenticação e cargo
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role || "";
    if (!GESTOR_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: "Acesso não autorizado" }, { status: 403 });
    }

    // 2. Ler arquivo da requisição
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ success: false, error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<any>(sheet, { defval: null });

    if (rawData.length === 0) {
      return NextResponse.json({ success: false, error: "A planilha está vazia" }, { status: 400 });
    }

    // 3. Carregar dados de validação cruzada em memória (Promotores e PDVs)
    const { data: employees } = await supabase
      .from("cm_employees")
      .select("id, cpf, nome_completo")
      .eq("ativo", true);

    const { data: pdvs } = await supabase
      .from("base_atendimento")
      .select("cod_parceiro, nome_fantasia");

    const employeeMap = new Map<string, string>(); // CPF (limpo) -> employee_id
    employees?.forEach(e => {
      if (e.cpf) {
        const cleanCpf = String(e.cpf).replace(/\D/g, "");
        employeeMap.set(cleanCpf, e.id);
      }
    });

    const pdvSet = new Set<string>();
    pdvs?.forEach(p => {
      pdvSet.add(String(p.cod_parceiro).trim());
    });

    // 4. Validar Linha por Linha
    const errors: string[] = [];
    const validRows: {
      promotor_id: string;
      cod_parceiro: string;
      dia_semana: number;
      duracao_estimada_min: number;
      motivo_visita: string;
      criticidade_visita: string;
    }[] = [];

    const uniquePromotersToClear = new Set<string>();
    const pdvUpdatesMap = new Map<string, { cidade?: string; uf?: string; endereco?: string; cep?: string }>();

    for (let idx = 0; idx < rawData.length; idx++) {
      const row = rawData[idx];
      const rowNum = idx + 2; // Linha do excel (1-indexed + header)

      const rawCpf = row["CPF do Promotor"];
      const rawPdv = row["Código do PDV"];
      const rawDia = row["Dia da Semana (1-7)"];
      const rawDuracao = row["Duração Estimada (Minutos)"] ?? 60;
      const rawMotivo = row["Motivo da Visita"] ?? "rotina";
      const rawCriticidade = row["Criticidade"] ?? "NORMAL";

      if (!rawCpf || !rawPdv || rawDia === null || rawDia === undefined) {
        errors.push(`Linha ${rowNum}: CPF do Promotor, Código do PDV e Dia da Semana são obrigatórios.`);
        continue;
      }

      // Validar Promotor
      const cleanCpf = String(rawCpf).replace(/\D/g, "");
      const promotorId = employeeMap.get(cleanCpf);
      if (!promotorId) {
        errors.push(`Linha ${rowNum}: Promotor com CPF "${rawCpf}" não cadastrado ou inativo.`);
        continue;
      }

      // Validar PDV
      const cleanPdv = String(rawPdv).trim();
      if (!pdvSet.has(cleanPdv)) {
        errors.push(`Linha ${rowNum}: PDV com código "${rawPdv}" não localizado na base de atendimento.`);
        continue;
      }

      // Validar Dia da Semana
      const diaNum = parseInt(rawDia, 10);
      if (isNaN(diaNum) || diaNum < 1 || diaNum > 7) {
        errors.push(`Linha ${rowNum}: Dia da semana "${rawDia}" inválido. Deve ser entre 1 e 7.`);
        continue;
      }

      // Validar Motivo
      const cleanMotivo = String(rawMotivo).toLowerCase().trim();
      const validMotivos = ['rotina', 'abastecimento', 'ruptura', 'auditoria_trade', 'campanha', 'urgencia'];
      if (!validMotivos.includes(cleanMotivo)) {
        errors.push(`Linha ${rowNum}: Motivo "${rawMotivo}" inválido. Valores aceitos: ${validMotivos.join(", ")}.`);
        continue;
      }

      // Validar Criticidade
      const cleanCriticidade = String(rawCriticidade).toUpperCase().trim();
      const validCriticidades = ['OBRIGATORIA', 'ALTA', 'NORMAL', 'BAIXA'];
      if (!validCriticidades.includes(cleanCriticidade)) {
        errors.push(`Linha ${rowNum}: Criticidade "${rawCriticidade}" inválida. Valores aceitos: ${validCriticidades.join(", ")}.`);
        continue;
      }

      uniquePromotersToClear.add(promotorId);

      const rawCidade = row["Cidade"];
      const rawUf = row["Estado (UF)"] || row["Estado"];
      const rawEndereco = row["Endereço"];
      const rawCep = row["CEP"];

      if (rawCidade || rawUf || rawEndereco || rawCep) {
        pdvUpdatesMap.set(cleanPdv, {
          cidade: rawCidade ? String(rawCidade).trim() : undefined,
          uf: rawUf ? String(rawUf).trim().toUpperCase().substring(0, 2) : undefined,
          endereco: rawEndereco ? String(rawEndereco).trim() : undefined,
          cep: rawCep ? String(rawCep).replace(/\D/g, "") : undefined
        });
      }

      validRows.push({
        promotor_id: promotorId,
        cod_parceiro: cleanPdv,
        dia_semana: diaNum,
        duracao_estimada_min: parseInt(rawDuracao, 10) || 60,
        motivo_visita: cleanMotivo,
        criticidade_visita: cleanCriticidade
      });
    }

    // 5. Se houver erros, interromper e retornar relatório
    if (errors.length > 0) {
      return NextResponse.json({ success: false, errors }, { status: 400 });
    }

    // 6. Aplicar as alterações (Deletar rotas antigas e inserir novas)
    if (validRows.length > 0) {
      // Atualizar informações de localização dos PDVs se fornecidas
      if (pdvUpdatesMap.size > 0) {
        for (const [pdvCode, info] of pdvUpdatesMap.entries()) {
          const updateObj: any = {};
          if (info.cidade) updateObj.cidade = info.cidade;
          if (info.uf) updateObj.uf = info.uf;
          if (info.endereco) updateObj.endereco = info.endereco;
          if (info.cep) updateObj.cep = info.cep;

          if (Object.keys(updateObj).length > 0) {
            await supabase
              .from("base_atendimento")
              .update(updateObj)
              .eq("cod_parceiro", pdvCode);
          }
        }
      }

      // Limpar carteira antiga dos promotores presentes na planilha
      const promotersList = Array.from(uniquePromotersToClear);
      const { error: deleteError } = await supabase
        .from("cm_promotor_carteira_pdv")
        .delete()
        .in("promotor_id", promotersList);

      if (deleteError) {
        throw new Error(`Erro ao limpar carteira anterior: ${deleteError.message}`);
      }

      // Inserir as novas em lotes de 100
      const batchSize = 100;
      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from("cm_promotor_carteira_pdv")
          .insert(batch);

        if (insertError) {
          throw new Error(`Erro ao inserir novas rotas: ${insertError.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      recordsProcessed: rawData.length,
      promotersUpdated: uniquePromotersToClear.size
    });

  } catch (err: any) {
    console.error("Error importing routes:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
