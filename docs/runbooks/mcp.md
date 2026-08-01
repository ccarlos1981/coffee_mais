# Runbook — MCP Infrastructure

**Responsável**: Equipe de Desenvolvimento  
**Baseline**: Seções 67–68 do AGENTS.md  
**Health Check**: `npm run health:mcp`  

---

## Visão Geral

Este runbook cobre a operação, diagnóstico e recuperação da infraestrutura MCP do Coffee++.

## Validação Rápida

```bash
npm run health:mcp
```

Resultado esperado: **20 PASS, 0 WARN, 0 FAIL**.

---

## Incidentes Comuns

### 1. "context deadline exceeded"

**Sintoma**: Firebase MCP não inicializa. Mensagem `context deadline exceeded`.

**Diagnóstico**:
```bash
npm config get registry
cat ~/.npmrc
```

**Causa provável**: npm registry configurado com `http://` (sem TLS).

**Correção**:
```bash
npm config set registry https://registry.npmjs.org/
npm config delete strict-ssl
rm -rf ~/.npm/_npx/*firebase*
npm install -g firebase-tools@latest
npm run health:mcp
```

---

### 2. Firebase CLI não encontrado

**Sintoma**: `firebase: command not found`

**Diagnóstico**:
```bash
which firebase
npm list -g firebase-tools
```

**Correção**:
```bash
npm install -g firebase-tools@latest
```

---

### 3. Firebase não autenticado

**Sintoma**: `firebase projects:list` retorna erro de autenticação.

**Correção**:
```bash
firebase login
firebase projects:list
```

---

### 4. GitHub PAT inválido ou expirado

**Sintoma**: GitHub MCP retorna `401 Unauthorized`.

**Diagnóstico**: Verificar token no `mcp_config.json`:
```bash
cat ~/.gemini/antigravity-ide/mcp_config.json | grep GITHUB
```

**Correção**: Gerar novo PAT em https://github.com/settings/tokens e atualizar em:
- `~/.gemini/antigravity-ide/mcp_config.json`
- `~/.gemini/config/mcp_config.json`

---

### 5. Supabase Token inválido

**Sintoma**: Supabase MCP retorna erro de autenticação.

**Diagnóstico**:
```bash
cat ~/.gemini/antigravity-ide/mcp_config.json | grep SUPABASE
```

**Correção**: Gerar novo token em https://supabase.com/dashboard/account/tokens e atualizar nos `mcp_config.json`.

---

### 6. TLS version mismatch

**Sintoma**: `npm ping` falha ou retorna erro de TLS.

**Diagnóstico**:
```bash
node -e "const tls=require('tls');const s=tls.connect(443,'registry.npmjs.org',{},()=>{console.log(s.getProtocol());s.end();})"
```

**Correção**: Atualizar Node.js para versão com suporte a TLS 1.2+:
```bash
nvm install --lts
nvm use --lts
```

---

## Checklist Pós-Incidente

- [ ] Executar `npm run health:mcp` com 0 FAIL
- [ ] Verificar que todos os 5 MCPs estão respondendo
- [ ] Confirmar que `~/.npmrc` não contém `http://` ou `strict-ssl=false`
- [ ] Documentar causa raiz e correção aplicada

---

## Arquivos de Configuração

| Arquivo | Conteúdo |
|---------|----------|
| `~/.npmrc` | Registry e configurações npm |
| `~/.gemini/antigravity-ide/mcp_config.json` | Configuração dos MCP servers (IDE) |
| `~/.gemini/config/mcp_config.json` | Configuração dos MCP servers (global) |
| `scripts/health-mcp.ts` | Script de health check |
