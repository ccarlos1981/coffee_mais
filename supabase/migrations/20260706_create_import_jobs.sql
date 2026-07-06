-- 1. Criar tabela de controle de lotes de importação
CREATE TABLE IF NOT EXISTS public.cm_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_arquivo TEXT NOT NULL,
    file_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    registros_count INTEGER NOT NULL,
    investimento_total NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'sucesso'::text,
    ip_address TEXT
);

-- 2. Alterar tabela de ações de investimento para vincular ao lote de importação
ALTER TABLE public.cm_acoes_investimento 
ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES public.cm_import_jobs(id) ON DELETE SET NULL;

-- 3. Adicionar índice na coluna import_batch_id para otimização de buscas/deletions
CREATE INDEX IF NOT EXISTS idx_cm_acoes_import_batch_id ON public.cm_acoes_investimento(import_batch_id);

-- 4. Adicionar Foreign Key física de integridade para a coluna codigo_matriz
ALTER TABLE public.cm_acoes_investimento 
ADD CONSTRAINT fk_cm_acoes_codigo_matriz 
FOREIGN KEY (codigo_matriz) REFERENCES public.cm_redes_matrizes(codigo);

-- 5. Configurar Row Level Security (RLS) para a tabela cm_import_jobs
ALTER TABLE public.cm_import_jobs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para cm_import_jobs
CREATE POLICY "Enable read access for all authenticated users" 
ON public.cm_import_jobs 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Enable insert access for authenticated users with role" 
ON public.cm_import_jobs 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('Admin', 'Gerente Regional', 'Controladoria', 'Trade')
  )
);

CREATE POLICY "Enable delete access for admins" 
ON public.cm_import_jobs 
FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles 
    WHERE id = auth.uid() 
    AND role = 'Admin'
  )
);
