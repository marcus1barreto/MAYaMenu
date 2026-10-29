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

# 1. Cria o script sentinela com suporte a montagem FAT e display X11/Wayland
cat << 'EOF' > "${SCRIPT_DISPARADOR}"
#!/usr/bin/env bash
LOG="/tmp/mayahq-autoexec.log"
echo "=== Trigger udev: $(date) ===" >> "$LOG"

export DISPLAY="${DISPLAY:-:0}"
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"
if [ -f "${HOME}/.Xauthority" ]; then
  export XAUTHORITY="${HOME}/.Xauthority"
fi

# Aguarda a montagem pelo desktop (até 8 segundos tentando a cada 1s)
for i in $(seq 1 8); do
  for MONTAGEM in /media/"$(whoami)"/* /media/"$(whoami)"/*/* /run/media/"$(whoami)"/* /run/media/"$(whoami)"/*/*; do
    if [ -f "${MONTAGEM}/iniciar.sh" ] && [ -f "${MONTAGEM}/server.mjs" ]; then
      echo "🛡️ MAYaMenu HQ detectado em: ${MONTAGEM}" >> "$LOG"

      # Se o servidor já estiver rodando, apenas abre o navegador
      if curl -s http://localhost:3333/api/status > /dev/null 2>&1; then
        echo "Servidor já online, abrindo navegador..." >> "$LOG"
        xdg-open "http://localhost:3333" >> "$LOG" 2>&1 &
        exit 0
      fi

      echo "Iniciando via bash..." >> "$LOG"
      cd "${MONTAGEM}"
      nohup bash "${MONTAGEM}/iniciar.sh" >> "$LOG" 2>&1 &
      echo "Disparado com sucesso!" >> "$LOG"
      exit 0
    fi
  done
  sleep 1
done

echo "Nenhum pendrive MAYaMenu montado após 8s." >> "$LOG"
EOF

chmod +x "${SCRIPT_DISPARADOR}"
echo "✅ Sentinela instalado em: ${SCRIPT_DISPARADOR}"

# 2. Registra o monitor no udev (precisa de sudo)
echo ""
echo "🔑 Registrando regra udev no sistema..."
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
