#!/usr/bin/env bash
# ==============================================================================
# MAYaMenu HQ — Ativador de Auto-Execução Instantânea no Linux
# ==============================================================================
# Executando este script uma única vez no seu PC Linux, toda vez que este pendrive
# for inserido, o console MAYaMenu HQ será iniciado automaticamente sem precisar
# clicar em nada!
# ==============================================================================

set -e

echo "=================================================================="
echo "🛡️  MAYaMenu HQ — Configuração de Auto-Execução no Linux"
echo "=================================================================="
echo ""

USUARIO=$(whoami)
SCRIPT_DISPARADOR="/home/${USUARIO}/.local/bin/mayahq-autoexec.sh"
REGRA_UDEV="/etc/udev/rules.d/99-mayahq-autoexec.rules"

mkdir -p "/home/${USUARIO}/.local/bin"

# 1. Cria o script sentinela que detecta o pendrive montado
cat << 'EOF' > "${SCRIPT_DISPARADOR}"
#!/usr/bin/env bash
# Aguarda a montagem automática do desktop (GNOME/KDE)
sleep 2

# Procura a pasta do console em todos os pontos de montagem do usuário
for MONTAGEM in /media/"$(whoami)"/* /run/media/"$(whoami)"/*; do
  if [ -f "${MONTAGEM}/iniciar.sh" ] && [ -f "${MONTAGEM}/server.mjs" ]; then
    echo "🛡️ MAYaMenu HQ detectado em: ${MONTAGEM}. Disparando..."
    nohup "${MONTAGEM}/iniciar.sh" >/dev/null 2>&1 &
    exit 0
  fi
done
EOF

chmod +x "${SCRIPT_DISPARADOR}"
echo "✅ Sentinela instalado em: ${SCRIPT_DISPARADOR}"

# 2. Registra o monitor no udev (precisa de sudo)
echo ""
echo "🔑 Para permitir que o sistema detecte a inserção do pendrive,"
echo "   precisamos registrar a regra udev no sistema."
echo ""

sudo bash -c "cat << 'EOF' > ${REGRA_UDEV}
ACTION==\"add\", SUBSYSTEM==\"block\", KERNEL==\"sd[a-z][0-9]\", RUN+=\"/bin/su ${USUARIO} -c '${SCRIPT_DISPARADOR}'\"
EOF"

sudo udevadm control --reload-rules
sudo udevadm trigger

echo ""
echo "🎉 CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!"
echo "👉 Agora, sempre que você espetar este pendrive neste computador,"
echo "   o console abrirá no seu navegador automaticamente!"
echo "=================================================================="
