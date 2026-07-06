# Project-Scoped Rules: Coffee Mais Hub de Importação

## Modo de Estabilização Ativo
A partir de 06/07/2026, o Hub de Importação de Dados e todo o ecossistema do Coffee++ entraram oficialmente em fase de estabilização.

### Regras Mandatórias de Estabilização:
1. **Não refatorar código que já funciona**: Evitar qualquer refatoração de código que esteja operacional.
2. **Preservar a arquitetura existente**: Não alterar a arquitetura ou infraestrutura atual.
3. **Não substituir componentes sem necessidade**: Evitar substituições de componentes visuais ou lógicos estáveis.
4. **Preservar regras de negócio homologadas**: Não alterar regras de domínio já validadas e em produção.
5. **Sem melhorias estéticas não solicitadas**: Não realizar ajustes de estilo ou layout sem solicitação expressa.
6. **Não alterar APIs públicas**: Preservar contratos de rotas e serviços existentes para evitar quebras.
7. **Abordagem Incremental**: Toda alteração deve ser uma extensão incremental e retrocompatível.
8. **Verificação Prévia**: Verificar se uma lógica ou serviço (ex: `ProdutoConversaoService`) já existe antes de codificar. Reutilizar sempre para evitar duplicação.
9. **Minimização de Impacto**: Havendo múltiplas abordagens de implementação, adotar a que cause menor atrito e impacto no sistema global.

### Lista de Verificação Obrigatória (Fim de Sprint):
* Executar `npx tsc --noEmit` para garantir ausência de erros de tipagem.
* Executar `npm run build` para garantir que o pacote Next.js compila perfeitamente.
* Validar lints, migrações SQL, integridade de RLS e garantir ausência total de regressões.

---

## 4. Diretrizes de Master Data e Conversão Logística (Coffee++)
A partir de 06/07/2026, o **Cadastro Mestre de Conversão Logística** torna-se um componente de domínio oficial do Coffee++.
Qualquer desenvolvimento futuro que manipule produtos ou volumes de venda deve seguir rigorosamente as regras abaixo:

1. **Sem Cálculos Próprios**: Nenhum módulo ou funcionalidade poderá implementar cálculos próprios de conversão física entre Unidades (UN), Caixas ou Kg.
2. **Exclusividade do Serviço**: Toda conversão lógica do sistema deve consumir exclusivamente o `ProdutoConversaoService`.
3. **Sem Hardcoding**: Nenhum valor de fator logístico (ex: 20 un/caixa, 12 un/caixa, etc.) poderá ficar fixo (hardcoded) no frontend, backend, SQL, relatórios, dashboards, RPCs ou automações.
4. **Verificação Prévia**: Ao criar novos fluxos ou módulos que manipulem produtos, verifique e integre o `ProdutoConversaoService` antes de introduzir qualquer regra aritmética de volume.
5. **Fonte Única de Verdade (Single Source of Truth)**: O Cadastro Mestre (`cm_skus_conversao`) é o único regulador do sistema para obter:
   * Unidades por caixa;
   * Peso unitário da embalagem;
   * Peso total por caixa;
   * Conversões físicas cruzadas;
   * Vigências das regras de embalagem.
6. **Preservação de Compatibilidade**: Qualquer evolução deste domínio deve preservar compatibilidade reversa com os módulos consumidores existentes (Promotor, Investimentos, Planejamento, Faturamento, Dashboards/BI e futuros módulos).
7. **Privilegiar Reutilização**: Em vez de criar tabelas, serviços ou regras paralelas de volume ou faturamento, sempre privilegie e reaproveite as estruturas do Master Data.

