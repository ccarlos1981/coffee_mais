# ADR-002: Dashboard Favorites

**Status**: Aceita  
**Data**: 2026-07-13  
**Baseline**: Seção 11 do AGENTS.md  

---

## Contexto

A personalização da Home do Coffee++ necessitava de um mecanismo estável e persistente para favoritos, evitando inconsistências causadas por armazenamento local (localStorage/sessionStorage) e garantindo que a experiência do usuário fosse preservada entre dispositivos e sessões.

## Decisão

Utilizar a tabela `cm_user_favorites` com RLS (Row-Level Security) como fonte única oficial para favoritos do dashboard.

### Princípios Fundamentais

1. **Sem Armazenamento Local**: Proibido persistir favoritos em `localStorage`, `sessionStorage` ou cookies.
2. **Chave Estável**: Toda persistência utiliza exclusivamente `module_key` (nunca `href`).
3. **RLS Obrigatório**: Toda leitura e escrita respeita RLS via `createClient()`. Proibido `createAdminClient()`.
4. **Ordenação Oficial**: Persistida na coluna `display_order`, com fallback `created_at ASC`.
5. **Posicionamento**: Seção Favoritos renderizada antes das demais categorias.

### Estrutura de Dados

```sql
CREATE TABLE cm_user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  module_key TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_key)
);
```

### Políticas RLS

- `SELECT`: `user_id = auth.uid()`
- `INSERT`: `user_id = auth.uid()`
- `UPDATE`: `user_id = auth.uid()`
- `DELETE`: `user_id = auth.uid()`

## Consequências

### Positivas
- Favoritos preservados entre dispositivos e sessões.
- Reordenação persistente e consistente.
- Segurança por design via RLS.

### Negativas
- Dependência de conexão com Supabase para carregar favoritos.
- Latência inicial na primeira carga (mitigada com SWR/cache).

## Referências

- AGENTS.md — Seção 11
- `src/app/actions/favorites.ts`
