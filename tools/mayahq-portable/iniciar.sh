#!/usr/bin/env bash
# ==============================================================================
# MAYaMenu HQ Portable — Console de Operador Air-Gapped (Linux)
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTA=3333
URL="http://localhost:${PORTA}"

echo "=================================================================="
echo "🛡️  MAYaMenu HQ Portable — Console Físico de Operador (Linux)"
echo "=================================================================="
echo "📁 Diretório de Execução: ${DIR}"

# 1. Seleciona Runtime do Node.js (Portátil no pendrive ou Global do Sistema)
NODE_CMD=""

if [ -f "${DIR}/bin/linux/node" ]; then
  chmod +x "${DIR}/bin/linux/node" 2>/dev/null || true
  NODE_CMD="${DIR}/bin/linux/node"
  echo "⚡ Usando Node.js Portátil Embutido (bin/linux/node)"
elif command -v node &> /dev/null; then
  NODE_CMD="node"
  NODE_VER=$(node -v)
  echo "⚡ Usando Node.js Global do Sistema Operacional (${NODE_VER})"
else
  echo "❌ Node.js não foi encontrado nesta máquina nem no pendrive."
  echo "👉 Opção 1: Instale o Node.js em https://nodejs.org"
  echo "👉 Opção 2: Copie o executável 'node' para a pasta 'bin/linux/node' deste pendrive."
  read -p "Pressione [Enter] para sair..."
  exit 1
fi

# 2. Verifica a existência da chave de serviço privada
CHAVE_PATH="${DIR}/chaves/service-account.json"
if [ ! -f "${CHAVE_PATH}" ]; then
  echo "⚠️  AVISO DE SEGURANÇA:"
  echo "   O arquivo 'chaves/service-account.json' não foi encontrado no pendrive."
  echo "   O console iniciará no modo de demonstração local ou pedirá autenticação do operador."
else
  echo "🔐 Chave de serviço detectada: ${CHAVE_PATH}"
fi

# 3. Abre o navegador automaticamente
abrir_navegador() {
  sleep 1.5
  if command -v xdg-open &> /dev/null; then
    xdg-open "${URL}" > /dev/null 2>&1 || true
  elif command -v google-chrome &> /dev/null; then
    google-chrome "${URL}" > /dev/null 2>&1 || true
  elif command -v firefox &> /dev/null; then
    firefox "${URL}" > /dev/null 2>&1 || true
  fi
}

abrir_navegador &

echo ""
echo "🚀 Iniciando Servidor Local do SuperAdmin em: ${URL}"
echo "ℹ️  Para encerrar a sessão segura, pressione [Ctrl + C] nesta janela."
echo "=================================================================="

exec "${NODE_CMD}" "${DIR}/server.mjs"
