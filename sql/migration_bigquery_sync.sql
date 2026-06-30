-- ============================================================
-- Migration: BigQuery Sync Infrastructure
-- 1. Create cm_sync_logs table for audit trail
-- 2. Add chave_bq column to cm_faturamento_sankhya for UPSERT
-- ============================================================

-- 1. Sync Logs table
CREATE TABLE IF NOT EXISTS cm_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'bigquery'
    CHECK (source IN ('bigquery', 'excel')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('RUNNING', 'SUCCESS', 'ERROR')),
  period_start DATE,
  period_end DATE,
  rows_fetched INTEGER DEFAULT 0,
  rows_inserted INTEGER DEFAULT 0,
  rows_updated INTEGER DEFAULT 0,
  error_message TEXT,
  triggered_by TEXT NOT NULL DEFAULT 'manual'
    CHECK (triggered_by IN ('manual', 'cron_06', 'cron_12', 'cron_18', 'reconciliation')),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON cm_sync_logs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_triggered ON cm_sync_logs(triggered_by, started_at DESC);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON cm_sync_logs TO anon, authenticated, service_role;

-- 2. Add chave_bq to cm_faturamento_sankhya (UNIQUE INDEX only, no column-level UNIQUE)
ALTER TABLE cm_faturamento_sankhya
  ADD COLUMN IF NOT EXISTS chave_bq TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cm_faturamento_chave_bq 
  ON cm_faturamento_sankhya(chave_bq);
