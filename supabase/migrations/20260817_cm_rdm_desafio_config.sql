-- Migration: Criar tabela cm_rdm_desafio_config para personalização dos percentuais do Desafio DRE no RDM
CREATE TABLE IF NOT EXISTS cm_rdm_desafio_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id TEXT NOT NULL UNIQUE,
  manager_name TEXT,
  impostos_pct NUMERIC NOT NULL DEFAULT 0.035,
  investimento_pct NUMERIC NOT NULL DEFAULT 0.100,
  cpv_pct NUMERIC NOT NULL DEFAULT 0.460,
  frete_pct NUMERIC NOT NULL DEFAULT 0.030,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);

ALTER TABLE cm_rdm_desafio_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cm_rdm_desafio_config' AND policyname = 'Autenticados podem ler cm_rdm_desafio_config'
  ) THEN
    CREATE POLICY "Autenticados podem ler cm_rdm_desafio_config"
      ON cm_rdm_desafio_config FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cm_rdm_desafio_config' AND policyname = 'Apenas admins podem modificar cm_rdm_desafio_config'
  ) THEN
    CREATE POLICY "Apenas admins podem modificar cm_rdm_desafio_config"
      ON cm_rdm_desafio_config FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM cm_user_profiles
          WHERE id = auth.uid() AND role IN ('Admin', 'Admin Master')
        )
      );
  END IF;
END $$;
