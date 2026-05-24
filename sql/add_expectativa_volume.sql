-- Add expectativa_volume column to cm_acoes_investimento table
ALTER TABLE cm_acoes_investimento
ADD COLUMN IF NOT EXISTS expectativa_volume numeric(10,2);
