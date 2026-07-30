# ADR-003 — Reimportação Controlada de Faturamento com Autorização Server-Side

## Status
Accepted (LTS / Governed)

## Contexto do Problema

No Hub de Importação de Faturamento da plataforma Coffee++, planilhas enviadas possuem um hash SHA-256 único calculado a partir dos bytes brutos do arquivo. Anteriormente, qualquer tentativa de re-enviar uma planilha com hash SHA-256 já existente era sumariamente bloqueada com uma exceção fatal (`isDuplicate`), sem qualquer opção de autorização ou reprocessamento pela equipe de administração comercial.

Isso gerava gargalo em cenários reais de negócio onde a controladoria ou a administração precisava autorizar reprocessamentos oficiais (ex: ajustes fiscais, estornos, homologações de auditoria ou correções no ERP Sankhya). Por outro lado, permitir a reimportação descontrolada por qualquer usuário abriria o risco de sobrescritas não intencionais de faturamento.

---

## Alternativas Avaliadas

1. **Bloqueio Definitivo Estrito (Manutenção do Comportamento Antigo)**:  
   - *Desvantagem*: Exigia que administradores alterassem manualmente células irrelevantes da planilha apenas para forçar a alteração do hash SHA-256 e burlar o bloqueio.
2. **Substituição Automática Aberta a Todos os Usuários**:  
   - *Desvantagem*: Alto risco de segurança e sobrescrita acidental por usuários operacionais desatentos.
3. **Bypass por Parâmetro Booleano Enviado pelo Cliente (`allowDuplicateOverride=true`)**:  
   - *Desvantagem*: Violava o princípio de segurança *Zero Trust Client Flags*, permitindo a burla do controle por requisições manipuladas no frontend.
4. **Reimportação Controlada Server-Side com Motivo Padronizado Obrigatório (Decisão Adotada)**:  
   - *Vantagem*: O Upload realiza apenas a análise sem alterar estado. Se duplicado, responde `HTTP 409 Conflict` informando se o usuário autenticado possui perfil `Admin` / `Admin Master`. A confirmação em `/api/import/excel/confirm` valida a role via token JWT, recalcula datas `period_start` e `period_end` 100% server-side no PostgreSQL e exige justificativa padronizada com auditoria corporativa completa.

---

## Decisão Adotada

Fica estabelecido que:

1. **Separação Rígida de Responsabilidades**: O endpoint `/api/import/excel/upload` é estritamente de leitura e staging. O endpoint `/api/import/excel/confirm` é o único responsável por alterações de estado, promoção de faturamento, validação de override e invalidação de cache.
2. **Autorização Server-Side Sem Booleanos do Cliente**: Nenhuma decisão transacional crítica da plataforma depende de flags ou booleanos enviados pela aplicação cliente. Toda autorização é recalculada e validada no servidor.
3. **Imutabilidade Histórica**: O `status = 'SUCCESS'` do lote original em `cm_sync_logs` permanece imutável. O relacionamento entre lotes é registrado pelos ponteiros de substituição em metadados (`superseded_by_batch_id` no lote antigo e `replacement_of_batch_id` no lote novo).
4. **Auditoria Corporativa**: Registrada via `logAuditAction` contendo `user_id`, `role`, `timestamp`, `motivo_padrao`, `motivo_descricao`, `old_batch_id` e `new_batch_id`.
5. **Invalidação de Cache**: Toda promoção concluída dispara obrigatoriamente o `CacheInvalidationService.onImportSuccess(newBatchId)`.

---

## Impactos na Arquitetura

- **Segurança Reforçada**: Eliminação completa de parâmetros clientes de bypass.
- **Rastreabilidade Fim a Fim**: Possibilidade de auditar quem autorizou a substituição de um lote, quando ocorreu e qual foi o motivo fiscal/operacional informado.
- **Sem Quebras de Compatibilidade**: Integração transparente com as views materializadas e o pipeline de staging existente.

---

## Requisitos de Segurança & Auditoria

- **Autenticação Obrigatória**: Validação via JWT em todas as chamadas.
- **Autorização por Perfil**: Restrito às roles `Admin` e `Admin Master`.
- **Justificativa Padronizada**: Exige seleção entre `Correção Fiscal`, `Correção de Faturamento`, `Reprocessamento Operacional`, `Homologação / Testes` e `Outro` (com descrição textual obrigatória).

---

## Estratégia de Rollback

- **Isolamento em Camada Única**: Alterações contidas em `import-service.ts`, rotas de API e `upload/page.tsx`.
- **Reversão Transacional no Banco**: Caso ocorra falha durante a promoção, a RPC `promover_lote_faturamento` executa rollback automático e os dados do lote anterior permanecem intactos.

---

## Referências Oficiais

- **Commit de Homologação**: `0308512` e `c5031ad` na branch `main`.
- **Governança**: Seção 69 do `AGENTS.md` ("Baseline Oficial — Reimportação Controlada de Faturamento").
