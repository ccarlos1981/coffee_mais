# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-07-19

### Added
- **Batch Import Engine v1.0.0**: Novo mecanismo oficial de persistência para o Hub de Importação.
- **Processamento em Batches**: Particionamento e promoção de registros da staging em lotes sequenciais parametrizados (lotes de 5.000).
- **Rollback Automático**: Reversão completa automática e remoção física de dados parciais em `cm_faturamento` e tabelas de controle sob falha em qualquer lote.
- **Telemetria de Progresso**: Gravação progressiva de porcentagens e status no `cm_sync_logs` para acompanhamento do usuário.
- **Novo Pipeline de Importação**: Fluxo desacoplado com tabelas de controle permanente (`cm_import_affected_partners`) para suporte serverless sem estado (stateless).

### Changed
- **Importação de Faturamento**: A confirmação de importações pelo Hub de Importação passa a consumir obrigatoriamente a estrutura particionada do BIE.
- **Orquestração**: A orquestração das fatias de dados foi centralizada e transferida inteiramente do banco de dados (monolítico) para o backend TypeScript/Next.js.

### Deprecated
- A antiga RPC monolítica `confirmar_importacao_faturamento(...)` foi descontinuada e desativada da aplicação por apresentar limitação estrutural de timeout.

### Removed
- Nenhum componente ou tabela foi removido fisicamente nesta versão para preservar compatibilidade retrospectiva de migrations.
