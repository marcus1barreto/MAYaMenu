@echo off
title MAYaMenu HQ Portable - Console Fisico de Operador
chcp 65001 > nul
cls

echo ==================================================================
echo 🛡️  MAYaMenu HQ Portable — Console Fisico de Operador (Windows)
echo ==================================================================
echo.

:: 1. Seleciona Runtime do Node.js (Portátil no pendrive ou Global do Sistema)
set "NODE_CMD="

if exist "%~dp0bin\win\node.exe" (
    set "NODE_CMD=%~dp0bin\win\node.exe"
    echo ⚡ Usando Node.js Portatil Embutido (bin\win\node.exe)
) else (
    where node >nul 2>nul
    if %errorlevel% equ 0 (
        set "NODE_CMD=node"
        echo ⚡ Usando Node.js Global do Sistema Operacional
    )
)

if "%NODE_CMD%"=="" (
    echo ❌ Node.js nao foi encontrado no Windows nem no pendrive.
    echo 👉 Opcao 1: Instale o Node.js em https://nodejs.org
    echo 👉 Opcao 2: Copie o executavel 'node.exe' para a pasta 'bin\win\node.exe' deste pendrive.
    echo.
    pause
    exit /b 1
)

:: 2. Verifica Chave de Servico Privada
if not exist "%~dp0chaves\service-account.json" (
    echo ⚠️  AVISO DE SEGURANCA:
    echo    Arquivo chaves\service-account.json nao encontrado no pendrive.
    echo.
) else (
    echo 🔐 Chave privada detectada em chaves\service-account.json
    echo.
)

:: 3. Abre o navegador automaticamente apos 2 segundos
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3333"

:: 4. Executa o servidor local seguro
echo 🚀 Iniciando Servidor Local em http://localhost:3333...
echo ℹ️  Para encerrar a sessao segura, basta fechar esta janela.
echo ==================================================================
echo.

"%NODE_CMD%" "%~dp0server.mjs"
pause
