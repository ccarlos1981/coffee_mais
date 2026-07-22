import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { ImportService } from "../src/lib/services/import-service";

async function runRealImport() {
  const batchId = "68cd2b8e-19ba-4053-893c-d09b9b365e23";
  console.log(`=== CONFIRMANDO IMPORTAÇÃO DO ARQUIVO EXCEL REAL PARA BATCH ${batchId} ===`);

  const confirmResult = await ImportService.confirmImport(batchId, "replace");
  console.log("✔ Confirmação do arquivo real concluída com sucesso:", confirmResult);
}

runRealImport();
