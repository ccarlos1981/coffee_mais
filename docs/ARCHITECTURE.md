# Diretrizes de Arquitetura - Server Actions (Coffee++)

A partir de 06/07/2026, fica estabelecido o **padrão oficial de tratamento de erros, retornos e logs de Server Actions** no ecossistema Coffee++.

---

## 1. Contrato Unificado de Retorno: `ActionResult<T>`

Toda Server Action implementada ou sob manutenção deve retornar exclusivamente a interface `ActionResult<T>` importada de `@/lib/types/action-result`.

```typescript
import { ActionErrorCode } from "@/lib/types/action-result";

export interface ActionResult<T> {
  success: boolean;
  code?: ActionErrorCode | string;
  message?: string;
  data?: T;
  requestId?: string;
}
```

---

## 2. Códigos de Erro Padronizados: `ActionErrorCode`

Para evitar a proliferação de strings mágicas (hardcoded), utilize o enum `ActionErrorCode`:

```typescript
export enum ActionErrorCode {
  DUPLICATE_FILE = "DUPLICATE_FILE",
  EMPTY_FILE = "EMPTY_FILE",
  MISSING_HEADERS = "MISSING_HEADERS",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  NOT_FOUND = "NOT_FOUND",
  BUSINESS_RULE_VIOLATION = "BUSINESS_RULE_VIOLATION",
  INTERNAL_ERROR = "INTERNAL_ERROR"
}
```

---

## 3. Helpers de Resposta

Para simplificar a escrita de Server Actions e unificar os retornos, utilize as funções utilitárias do arquivo `@/lib/types/action-result`:

### Sucesso
Retorna os dados envolvidos na execução bem-sucedida:
```typescript
import { successResult } from "@/lib/types/action-result";

return successResult({ count: acoes.length, batchId: jobId });
```

### Erro de Negócio (Esperado)
* **Definição:** Regras de negócio violadas, validações lógicas, arquivo duplicado, falta de permissões ou dados incorretos.
* **Comportamento:** **NUNCA utilizar `throw`**. A action deve retornar o erro usando o helper `errorResult`:
```typescript
import { errorResult, ActionErrorCode } from "@/lib/types/action-result";

return errorResult(
  ActionErrorCode.DUPLICATE_FILE,
  "Este arquivo já foi importado anteriormente."
);
```

---

## 4. Tratamento de Exceções Inesperadas (Infraestrutura)

* **Definição:** Falhas de rede, queda do banco de dados, falha crítica na RPC, estouro de memória, erros de sintaxe ou qualquer exceção técnica imprevista.
* **Comportamento:** **DEVEM disparar `throw`**. A captura da exceção no bloco `catch` deve ser feita utilizando o helper `handleActionError`:
```typescript
import { handleActionError } from "@/lib/types/action-result";

try {
  // Lógica da Server Action
} catch (error) {
  handleActionError(error, {
    module: "Investimentos",
    action: "importarInvestimentosEmLote",
    userId: user?.id
  });
}
```

### O que o `handleActionError` faz por baixo dos panos:
1. **Gera um `requestId` único:** (via `crypto.randomUUID()`) que identifica unicamente o incidente.
2. **Log Estruturado no Servidor:** Imprime no console do servidor o objeto estruturado com:
   * `requestId`
   * `module`
   * `action`
   * `userId`
   * `message`
   * `code`
   * `stack trace`
3. **Lança uma Exceção Amigável:** Dispara um `throw new Error("Erro interno inesperado no servidor. Incident ID: " + requestId)`. 
   * Desta forma, o `requestId` é retornado de forma visível ao frontend, permitindo que o suporte correlacione o aviso na tela do usuário diretamente com as linhas de logs do servidor em caso de investigações.

---

## 5. Diretriz de Adoção Gradual

* **Sem Refatoração em Massa:** Não altere códigos estáveis e homologados que já estão rodando em produção.
* **Aplicação Incremental:** A adoção é obrigatória para **qualquer nova Server Action** criada no sistema e para **qualquer Server Action existente que receba manutenção ou refatoração**.
