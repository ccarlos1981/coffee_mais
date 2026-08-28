-- Wave 14.1: Security Definer Search Path Gap Remediation
-- Reference: Contra-Auditoria B.4-Z.14 / Achado ACH-W14-01
-- Objective: Ensure 100% of active SECURITY DEFINER functions have explicit search_path = public, pg_temp
-- Fail-Closed Principle: Zero business logic alterations, purely configuration hardening.

-- Section 1: The 7 pending active functions identified in B.4-Z.14
ALTER FUNCTION public.cm_audit_trigger_func() SET search_path = public, pg_temp;
ALTER FUNCTION public.execute_readonly_query(query_text text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_last_day_sales() SET search_path = public, pg_temp;
ALTER FUNCTION public.proc_processar_ocorrencia_aprovada() SET search_path = public, pg_temp;
ALTER FUNCTION public.refresh_mv_inconsistencias() SET search_path = public, pg_temp;
ALTER FUNCTION public.rpc_importar_atendimento_sankhya(p_items jsonb, p_batch_id text, p_force_override boolean) SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_base_atendimento_to_cm_clientes() SET search_path = public, pg_temp;

-- Section 2: Re-enforce uniform search_path on sync functions previously set to public only
ALTER FUNCTION public.sync_cm_clientes_to_base_atendimento() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_cm_clientes_to_redes_matrizes() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_cm_redes_matrizes_to_clientes_safe() SET search_path = public, pg_temp;
