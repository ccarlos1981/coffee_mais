// Mock next/headers for Next.js cookies lookup in command-line environments
const Module = require('module');
const originalRequire = Module.prototype.require;

require('dotenv').config({ path: '.env.local' });
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
const supabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

Module.prototype.require = function(id) {
  if (id === 'next/headers') {
    return {
      cookies: () => ({
        get: () => null,
        set: () => null,
        getAll: () => [],
      })
    };
  }
  if (id.includes('supabase/server')) {
    return {
      createClient: () => supabase
    };
  }
  return originalRequire.apply(this, arguments);
};

const { AutoAssociacaoService } = require('../src/lib/associacao/autoAssociacaoService');

async function verifyFlow() {
  console.log("=== AUTO-ASSOCIACAO SERVICE LIFECYCLE VERIFICATION ===");

  try {
    // 1. Find a test client with no responsible
    const { data: clients, error: clientErr } = await supabase
      .from("cm_clientes")
      .select("id, codigo, responsavel")
      .or("responsavel.is.null,responsavel.eq.")
      .limit(1);

    if (clientErr || !clients || clients.length === 0) {
      console.log("No unassociated clients found to run integration verification.");
      return;
    }

    const testClient = clients[0];
    console.log(`Using client ID: ${testClient.id}, Code: ${testClient.codigo} (responsavel is currently: "${testClient.responsavel}")`);

    // Ensure we clean up any pre-existing suggestions for this client
    await supabase.from("cm_responsavel_sugestoes").delete().eq("cliente_id", testClient.id);

    // 2. Create a mock pending suggestion
    const mockSuggestedResponsible = "Luiz";
    const { data: suggestion, error: sugErr } = await supabase
      .from("cm_responsavel_sugestoes")
      .insert({
        cliente_id: testClient.id,
        responsavel_sugerido: mockSuggestedResponsible,
        origem_sugestao: "test_matching",
        confianca: 85,
        motivo: JSON.stringify({ regra_motivo: "Test rule applied", fatores: ["Code match"] }),
        status: "pendente"
      })
      .select("*")
      .single();

    if (sugErr || !suggestion) {
      throw new Error(`Failed to create mock suggestion: ${sugErr?.message}`);
    }

    console.log(`Mock suggestion created with ID: ${suggestion.id}, Status: ${suggestion.status}`);

    // 3. Test Approval Flow
    console.log("Testing Approval Flow...");
    const appRes = await AutoAssociacaoService.processarSugestao(suggestion.id, 'aprovar', 'tester_approve@coffeemais.com');
    console.log("  Approval call returned:", appRes);

    // Assert client table update
    const { data: updatedClient, error: getClientErr } = await supabase
      .from("cm_clientes")
      .select("id, responsavel")
      .eq("id", testClient.id)
      .single();

    if (getClientErr || updatedClient.responsavel !== mockSuggestedResponsible) {
      throw new Error(`Client responsible was NOT updated to "${mockSuggestedResponsible}". Current: "${updatedClient?.responsavel}"`);
    }
    console.log(`  Assertion Passed: cm_clientes updated to "${updatedClient.responsavel}"`);

    // Assert suggestion log update
    const { data: approvedSuggestion, error: getSugErr } = await supabase
      .from("cm_responsavel_sugestoes")
      .select("*")
      .eq("id", suggestion.id)
      .single();

    if (getSugErr || approvedSuggestion.status !== 'aprovado' || approvedSuggestion.approved_by !== 'tester_approve@coffeemais.com') {
      throw new Error(`Suggestion table was not updated. Status: ${approvedSuggestion?.status}, Approved By: ${approvedSuggestion?.approved_by}`);
    }
    console.log(`  Assertion Passed: cm_responsavel_sugestoes updated to 'aprovado' by ${approvedSuggestion.approved_by}`);

    // Cleanup: reset client responsible to null
    await supabase.from("cm_clientes").update({ responsavel: null }).eq("id", testClient.id);
    await supabase.from("cm_responsavel_sugestoes").delete().eq("id", suggestion.id);

    // 4. Test Rejection Flow
    console.log("Testing Rejection Flow...");
    
    // Create new pending suggestion
    const { data: suggestion2, error: sugErr2 } = await supabase
      .from("cm_responsavel_sugestoes")
      .insert({
        cliente_id: testClient.id,
        responsavel_sugerido: mockSuggestedResponsible,
        origem_sugestao: "test_matching",
        confianca: 85,
        motivo: JSON.stringify({ regra_motivo: "Test rule applied", fatores: ["Code match"] }),
        status: "pendente"
      })
      .select("*")
      .single();

    if (sugErr2 || !suggestion2) {
      throw new Error(`Failed to create second mock suggestion: ${sugErr2?.message}`);
    }

    const rejRes = await AutoAssociacaoService.processarSugestao(suggestion2.id, 'rejeitar', 'tester_reject@coffeemais.com', 'Test Rejection Reason');
    console.log("  Rejection call returned:", rejRes);

    // Assert client table is untouched (should still be null)
    const { data: clientAfterRejection, error: getClientErr2 } = await supabase
      .from("cm_clientes")
      .select("id, responsavel")
      .eq("id", testClient.id)
      .single();

    if (getClientErr2 || clientAfterRejection.responsavel !== null) {
      throw new Error(`Client responsible was modified on rejection! Current: "${clientAfterRejection?.responsavel}"`);
    }
    console.log("  Assertion Passed: cm_clientes remained untouched (NULL)");

    // Assert suggestion status update
    const { data: rejectedSuggestion, error: getSugErr2 } = await supabase
      .from("cm_responsavel_sugestoes")
      .select("*")
      .eq("id", suggestion2.id)
      .single();

    if (getSugErr2 || rejectedSuggestion.status !== 'rejeitado' || rejectedSuggestion.rejected_by !== 'tester_reject@coffeemais.com' || rejectedSuggestion.rejection_reason !== 'Test Rejection Reason') {
      throw new Error(`Suggestion table was not updated for rejection. Status: ${rejectedSuggestion?.status}, Rejected By: ${rejectedSuggestion?.rejected_by}, Reason: ${rejectedSuggestion?.rejection_reason}`);
    }
    console.log(`  Assertion Passed: cm_responsavel_sugestoes updated to 'rejeitado' by ${rejectedSuggestion.rejected_by} with reason "${rejectedSuggestion.rejection_reason}"`);

    // Cleanup
    await supabase.from("cm_responsavel_sugestoes").delete().eq("id", suggestion2.id);

    console.log("\n=== ALL LIFECYCLE TESTS PASSED SUCCESSFULLY! ===");

  } catch (err) {
    console.error("❌ Lifecycle verification failed:", err.message);
  }
}

verifyFlow();
