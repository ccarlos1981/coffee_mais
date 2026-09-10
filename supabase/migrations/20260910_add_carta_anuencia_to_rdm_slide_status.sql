-- Migration: Incluir novo slide 'carta_anuencia' (Slide 15 Oficial) na constraint de slide_key
-- Tabela: public.cm_rdm_slide_status
-- Autorização: Exclusiva para cristiano.santos@coffeemais.com
-- Total de Slides Oficiais: 30

ALTER TABLE public.cm_rdm_slide_status 
  DROP CONSTRAINT IF EXISTS chk_cm_rdm_slide_key_allowed;

ALTER TABLE public.cm_rdm_slide_status 
  ADD CONSTRAINT chk_cm_rdm_slide_key_allowed 
  CHECK (slide_key IN (
    'capa',
    'agenda',
    'cover_fup',
    'follow_up',
    'cover_farol',
    'farol_metas',
    'cover_dre',
    'dre',
    'dre_acumulado',
    'dre_rede',
    'cover_invest',
    'invest_fases',
    'invest_cliente',
    'invest_rede',
    'carta_anuencia',
    'cover_resultado',
    'fat_mensal',
    'vol_mensal',
    'vol_preco_medio',
    'preco_yoy',
    'preco_tabela',
    'vol_matriz',
    'preco_familia',
    'cover_plano',
    'plano_acao',
    'cover_projecao',
    'projecao_vendas',
    'cover_rotas',
    'agenda_rotas',
    'obrigado'
  ));
