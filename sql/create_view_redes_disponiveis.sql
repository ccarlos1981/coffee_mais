-- Create or replace view to get distinct networks (redes) from base_atendimento
CREATE OR REPLACE VIEW view_redes_disponiveis AS
SELECT DISTINCT rede
FROM base_atendimento
WHERE rede IS NOT NULL AND TRIM(rede) <> ''
ORDER BY rede;
