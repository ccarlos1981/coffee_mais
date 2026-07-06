# Project-Scoped Rules: Coffee Mais Hub de Importação

## Modo de Estabilização Ativo
A partir de 06/07/2026, o Hub de Importação de Dados entrou oficialmente em fase de estabilização.

### Regras Mandatórias:
1. **Sem Novas Funcionalidades:** Não adicione novas funcionalidades ao Hub. Registre novas ideias ou solicitações de features no backlog para sprints futuras.
2. **Foco em Qualidade:** Toda modificação deve se concentrar em:
   * Correção de bugs cadastrais ou lógicos.
   * Otimização de performance de consulta e escrita (limitação de lotes, índices, concorrência).
   * Redução de pegada de memória (garbage collection, stream processing de buffers).
   * Aperfeiçoamento do design e experiência do usuário (feedback visual, legibilidade).
3. **Simplicidade:** Não aumente a complexidade arquitetural do código Mantenha soluções diretas, modulares e transacionais.

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

