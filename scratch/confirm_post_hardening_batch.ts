import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { ImportService } from "../src/lib/services/import-service";

async function runConfirm() {
  const batchId = "2758fdfa-61ec-459f-b73c-427ff0cd7495";
  console.log(`=== CONFIRMANDO IMPORTAÇÃO PÓS-HARDENING (SEÇÃO 49) PARA BATCH ${batchId} ===`);
  try {
    const res = await ImportService.confirmImport(batchId, "replace");
    console.log("✔ RESULTADO DA CONFIRMAÇÃO:", res);
  } catch (err) {
    console.error("❌ ERRO NA CONFIRMAÇÃO:", err);
  }
}

runConfirm();
