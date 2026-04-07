# CLAUDE.md — Coffee Mais

Este arquivo fornece contexto para o Claude Code sobre o projeto Coffee Mais.

## Sobre o Projeto
Coffee Mais é um projeto desenvolvido com Supabase como backend.

## Idioma
- Comunique-se sempre em **Português Brasileiro** (pt-BR)
- Código: variáveis e funções em inglês
- Commits e documentação em português

## Stack
- **Backend:** Supabase (PostgreSQL 17, Auth, Storage, Edge Functions)
- **Supabase Project:** `ncncazbhpoxjlyvcbvqa`
- **Região:** us-east-1

## Convenções
- TypeScript strict mode
- camelCase para variáveis/funções
- PascalCase para componentes/classes
- kebab-case para nomes de arquivos
- snake_case para tabelas e colunas do banco
- RLS obrigatório em todas as tabelas

## Segurança
- Nunca expor service_role key no frontend
- Usar anon key apenas no client
- Validar todos os inputs no backend

## BMAD
- Projeto usa BMAD Method v6 para metodologia de desenvolvimento
- Skills disponíveis em `_bmad/`
- Use `/bmad-help` para guias de workflow
