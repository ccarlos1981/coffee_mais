-- Add unique index to cm_sync_logs to prevent duplicate uploads of the same file concurrently or consecutively
CREATE UNIQUE INDEX IF NOT EXISTS idx_cm_sync_logs_unique_hash 
ON public.cm_sync_logs ((metadata->>'file_hash')) 
WHERE status IN ('RUNNING', 'SUCCESS') AND source = 'excel';
