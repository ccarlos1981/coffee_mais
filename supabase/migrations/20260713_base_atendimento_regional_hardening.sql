-- 1. Endurecimento de Segurança (RLS) para cm_base_atendimento_regional
-- Remover a política permissiva antiga
DROP POLICY IF EXISTS "Allow all authenticated users full access on regional mapping" ON public.cm_base_atendimento_regional;

-- Criar política de leitura liberada para todos os usuários autenticados
CREATE POLICY "Allow read access to all authenticated users" 
ON public.cm_base_atendimento_regional 
FOR SELECT 
TO authenticated 
USING (true);

-- Criar política de escrita/modificação/deleção exclusiva para Admin, CEO e Financeiro
CREATE POLICY "Allow write access to admin and financeiro only" 
ON public.cm_base_atendimento_regional 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.cm_user_profiles up
        WHERE up.id = auth.uid() AND up.role IN ('Admin', 'CEO', 'Financeiro')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.cm_user_profiles up
        WHERE up.id = auth.uid() AND up.role IN ('Admin', 'CEO', 'Financeiro')
    )
);

-- 2. Gatilho de Auditoria para a tabela cm_base_atendimento_regional
CREATE OR REPLACE FUNCTION public.fn_audit_cm_base_atendimento_regional()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.cm_audit_logs (table_name, action, old_data, new_data, user_id)
    VALUES (
        'cm_base_atendimento_regional',
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        auth.uid()
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_cm_base_atendimento_regional ON public.cm_base_atendimento_regional;
CREATE TRIGGER trg_audit_cm_base_atendimento_regional
AFTER INSERT OR UPDATE OR DELETE ON public.cm_base_atendimento_regional
FOR EACH ROW
EXECUTE FUNCTION public.fn_audit_cm_base_atendimento_regional();
