#!/bin/bash

# Define o diretório do projeto e entra nele
PROJECT_DIR="/Users/cristiano/Projetos/Coffe Mais"
cd "$PROJECT_DIR" || exit 1

# Garante que a pasta de backups compactados existe
mkdir -p backups

# Configura o ambiente para encontrar o Node.js via NVM
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
fi

# Fallback se o comando node ainda não estiver no PATH
if ! command -v node &> /dev/null; then
    export PATH="/Users/cristiano/.nvm/versions/node/v24.14.1/bin:$PATH"
fi

# Define a data do backup
DATE=$(date +%Y-%m-%d)
echo "=========================================="
echo "=== Iniciando Backup: $DATE às $(date) ==="
echo "=========================================="

# 1. Executa o backup das tabelas do banco de dados Supabase
echo "[1/3] Carregando dados do Supabase..."
node scripts/backup_db.js

# 2. Compacta o código-fonte em um .zip na pasta backups/
ZIP_NAME="backups/coffe-mais-backup-$DATE.zip"
echo "[2/3] Gerando arquivo zip: $ZIP_NAME..."
zip -r "$ZIP_NAME" . \
  -x "node_modules/*" \
  -x ".next/*" \
  -x "backup_*/*" \
  -x "backups/*" \
  -x "promotor_app/build/*" \
  -x "promotor_app/.dart_tool/*" \
  -x ".git/*" \
  -x ".agents/*" \
  -x ".claude/*" \
  -x ".cursor/*" \
  -x ".windsurf/*" \
  -x "*.zip"

# 3. Retenção de backups: mantém apenas os 7 backups mais recentes (arquivos .zip)
echo "[3/3] Limpando backups antigos..."
cd backups || exit 1

echo "Verificando arquivos .zip na pasta backups/ (mantendo os 7 últimos)..."
ls -t *.zip 2>/dev/null | tail -n +8 | while read -r old_zip; do
    echo "Removendo backup zip antigo: $old_zip"
    rm "$old_zip"
done

# Retorna ao diretório principal do projeto e limpa pastas de backup temporárias de dados backup_*
cd "$PROJECT_DIR" || exit 1
echo "Verificando pastas de dados antigas backup_* (mantendo as 7 últimas)..."
ls -td backup_* 2>/dev/null | tail -n +8 | while read -r old_dir; do
    echo "Removendo pasta de dados antiga: $old_dir"
    rm -rf "$old_dir"
done

echo "=========================================="
echo "=== Backup concluído com sucesso em $(date) ==="
echo "=========================================="
