@echo off
title MAYaMenu HQ Portable - Console Fisico de Operador
chcp 65001 > nul
cls

echo ==================================================================
echo 🛡️  MAYaMenu HQ Portable — Console Fisico de Operador
echo ==================================================================
echo.

:: 1. Verifica Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js nao foi encontrado no Windows.
    echo 👉 Instale o Node.js em https://nodejs.org para executar o console.
    echo.
    pause
    exit /b 1
)

:: 2. Verifica Chave de Servico
if not exist "%~dp0chaves\service-account.json" (
    echo ⚠️  AVISO DE SEGURANCA:
    echo    Arquivo chaves\service-account.json nao encontrado no pendrive.
    echo.
) else (
    echo 🔐 Chave privada detectada em chaves\service-account.json
    echo.
)

:: 3. Abre o navegador apos 2 segundos
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3333"

:: 4. Executa o servidor local
echo 🚀 Iniciando Servidor Local em http://localhost:3333...
echo ℹ️  Para encerrar o cofre, basta fechar esta janela.
echo ==================================================================
echo.

node "%~dp0server.mjs"
pause
