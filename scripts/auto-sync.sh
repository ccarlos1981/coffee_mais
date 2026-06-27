#!/bin/bash

# ============================================================
#  Auto-Sync GitHub - Coffee Mais
#  Roda a cada 3 horas para salvar e enviar alterações
# ============================================================

PROJECT_DIR="/Users/cristiano/Projetos/Coffe Mais"
LOG_FILE="$PROJECT_DIR/backups/auto-sync.log"
TIMESTAMP=$(date '+%d/%m/%Y %H:%M')

cd "$PROJECT_DIR" || exit 1

# Verifica se há alterações para salvar
if git diff --quiet && git diff --staged --quiet; then
  echo "[$TIMESTAMP] Nenhuma alteração encontrada. Nada a enviar." >> "$LOG_FILE"
  exit 0
fi

# Adiciona todas as alterações
git add -A

# Faz o commit com data e hora automática
git commit -m "auto-save: $TIMESTAMP"

# Envia para o GitHub
if git push origin main >> "$LOG_FILE" 2>&1; then
  echo "[$TIMESTAMP] ✅ Alterações enviadas com sucesso para o GitHub." >> "$LOG_FILE"
else
  echo "[$TIMESTAMP] ❌ Erro ao enviar para o GitHub. Verifique a conexão." >> "$LOG_FILE"
fi
