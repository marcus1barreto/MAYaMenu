#!/usr/bin/env bash
# ==============================================================================
# MAYaMenu HQ Portable — Console de Operador Air-Gapped (Modo Pendrive)
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTA=3333
URL="http://localhost:${PORTA}"

echo "=================================================================="
echo "🛡️  MAYaMenu HQ Portable — Console Físico de Operador"
echo "=================================================================="
echo "📁 Diretório de Execução: ${DIR}"

# 1. Verifica se o Node.js está instalado na máquina
if ! command -v node &> /dev/null; then
  echo "❌ Node.js não foi encontrado nesta máquina."
  echo "👉 Por favor, instale o Node.js (https://nodejs.org) ou use o pacote com runtime portátil embutido."
  read -p "Pressione [Enter] para sair..."
  exit 1
fi

NODE_VERSION=$(node -v)
echo "⚡ Runtime detectado: Node.js ${NODE_VERSION}"

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
  elif command -v open &> /dev/null; then
    open "${URL}" > /dev/null 2>&1 || true
  fi
}

abrir_navegador &

echo ""
echo "🚀 Iniciando Servidor Local do SuperAdmin em: ${URL}"
echo "ℹ️  Para encerrar a sessão segura, pressione [Ctrl + C] nesta janela."
echo "=================================================================="

exec node "${DIR}/server.mjs"
