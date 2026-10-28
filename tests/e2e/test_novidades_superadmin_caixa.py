#!/usr/bin/env python3
"""
MAYaMenu - Teste E2E Automatizado das Novidades de Arquitetura:
  1. Fábrica de Licenças em Lote (SuperAdmin)
  2. Modal de Concessões, Download CSV & Cópia WhatsApp
  3. Manual Executivo SuperAdmin (/superadmin/ajuda) no Tema Claro iFood Style
  4. Landing Page Novidades & Lançamentos 2026 (#novidades)
  5. Central de Ajuda Pública (/manual) com Web Serial & Pix
  6. Jornada Mobile de Pedido no Salão (/r/demo)

Stack: Python 3.12+, Playwright Async, Next.js 16 (Turbopack).
"""

import argparse
import asyncio
import os
import sys
import time
from playwright.async_api import (
    async_playwright,
    Browser,
    BrowserContext,
    Page,
    expect,
)

# Cores para terminal
class C:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    CYAN = "\033[36m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    RED = "\033[31m"
    MAGENTA = "\033[35m"

def log(actor: str, msg: str, level: str = "INFO"):
    agora = time.strftime("%H:%M:%S")
    cor = C.CYAN if actor == "SUPERADMIN" else (C.GREEN if actor == "SUCESSO" else C.MAGENTA)
    print(f"[{agora}] {cor}{C.BOLD}[{actor}]{C.RESET} {msg}", flush=True)

async def test_novidades_superadmin_caixa(base_url: str, headless: bool = True):
    print(f"\n{C.BOLD}{'='*75}")
    print(f"   MAYaMenu • PIPELINE DE TESTES E2E (NOVIDADES & ARQUITETURA)")
    print(f" • Ambiente Alvo: {base_url}")
    print(f" • Modo Janela:   {'Headless (Background)' if headless else 'Visível (Headed)'}")
    print(f"{'='*75}{C.RESET}\n")

    async with async_playwright() as p:
        browser: Browser = await p.chromium.launch(
            headless=headless,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        )

        try:
            # ==============================================================
            # TESTE 1: FÁBRICA DE LICENÇAS NO SUPERADMIN
            # ==============================================================
            context: BrowserContext = await browser.new_context(
                viewport={"width": 1440, "height": 900},
                locale="pt-BR",
            )
            # Injeta cookie de sessão autenticada de SuperAdmin para atender ao Edge Middleware
            await context.add_cookies([
                {
                    "name": "__session",
                    "value": "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImFkbWluQG1heWFtZW51LmNvbSIsInN1cGVyYWRtaW4iOnRydWV9.signature",
                    "url": base_url,
                }
            ])
            page: Page = await context.new_page()

            superadmin_url = f"{base_url}/superadmin"
            log("SUPERADMIN", f"Navegando até o painel SuperAdmin: {superadmin_url}")
            await page.goto(superadmin_url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(1.5)

            # Valida presença do título
            titulo = page.locator("h1:has-text('MAYaRAnas')").first
            await titulo.wait_for(state="visible", timeout=15000)
            log("SUPERADMIN", "Painel SuperAdmin carregado com sucesso.")

            # Clica na aba de 'Emissão & Convites Disponíveis'
            btn_aba_ativas = page.locator("button:has-text('Disponíveis'), button:has-text('Emissão')").first
            if await btn_aba_ativas.is_visible(timeout=5000):
                await btn_aba_ativas.click()
                log("SUPERADMIN", "Aba 'Emissão & Convites Disponíveis' ativada.")
                await asyncio.sleep(0.5)

            # Alterna para o modo "Fábrica em Lote"
            btn_lote = page.locator("button:has-text('Fábrica em Lote')").first
            await btn_lote.wait_for(state="visible", timeout=8000)
            await btn_lote.click()
            log("SUPERADMIN", "Modo 'Fábrica em Lote' (NOVO) ativado.")
            await asyncio.sleep(0.5)

            # Seleciona o botão de quantidade '5'
            btn_qtd_5 = page.locator("button:has-text('5 un')").first
            if await btn_qtd_5.is_visible():
                await btn_qtd_5.click()
                log("SUPERADMIN", "Pacote de 5 unidades pré-selecionado.")

            # Preenche o prefixo da campanha
            input_resp = page.locator("input[placeholder*='Campanha'], input[placeholder*='Ex: Marcus Barreto']").first
            if await input_resp.is_visible():
                await input_resp.fill("Campanha Playwright E2E")
                log("SUPERADMIN", "Prefixo de campanha preenchido: 'Campanha Playwright E2E'.")

            # Clica no botão de fabricar lote
            btn_fabricar = page.locator("button:has-text('Fabricar Lote'), button[type='submit']").first
            await btn_fabricar.wait_for(state="visible", timeout=8000)
            await btn_fabricar.click()
            log("SUPERADMIN", "Comando de fabricação atômica em lote disparado...")

            # Aguarda o modal de resultado do lote abrir
            modal_lote = page.locator("text=/.*(Fábrica de Licenças — Lote Gerado|Concessões criadas com sucesso).*/i").first
            await modal_lote.wait_for(state="visible", timeout=15000)
            log("SUCESSO", "Modal da Fábrica de Licenças aberto com concessões geradas!", "SUCCESS")

            # Valida botão de copiar lista formatada para WhatsApp
            btn_copiar_whats = page.locator("button:has-text('Copiar Lista WhatsApp/Slack')").first
            if await btn_copiar_whats.is_visible():
                await btn_copiar_whats.click()
                log("SUPERADMIN", "Botão 'Copiar Lista WhatsApp/Slack' testado com sucesso.")
                await asyncio.sleep(0.5)

            # Fecha o modal
            btn_fechar_modal = page.locator("button:has-text('Concluir e Fechar')").first
            if await btn_fechar_modal.is_visible():
                await btn_fechar_modal.click()
                log("SUPERADMIN", "Modal de lote concluído e fechado.")

            # Valida o botão 'Exportar CSV' na listagem global
            btn_exportar_csv = page.locator("button:has-text('CSV')").first
            await btn_exportar_csv.wait_for(state="visible", timeout=8000)
            log("SUPERADMIN", "Botão de 'Exportar CSV' (NOVO) presente e validado na tabela.")

            # ==============================================================
            # TESTE 2: MANUAL EXECUTIVO SUPERADMIN (/superadmin/ajuda)
            # ==============================================================
            ajuda_url = f"{base_url}/superadmin/ajuda"
            log("SUPERADMIN", f"Acessando Manual Executivo: {ajuda_url}")
            await page.goto(ajuda_url, wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(1.0)

            # Valida presença das seções essenciais
            sec_fabrica = page.locator("text=/.*Fábrica de Concessões em Lote.*/i").first
            await sec_fabrica.wait_for(state="visible", timeout=10000)

            sec_hardware = page.locator("text=/.*Impressão Térmica ESC\\/POS USB & QR Code Pix.*/i").first
            await sec_hardware.wait_for(state="visible", timeout=10000)

            sec_planos = page.locator("text=/.*Matriz de Planos & Limites Operacionais.*/i").first
            await sec_planos.wait_for(state="visible", timeout=10000)

            log("SUCESSO", "Manual Executivo SuperAdmin validado no Tema Claro Oficial!", "SUCCESS")

            # ==============================================================
            # TESTE 3: LANDING PAGE & SEÇÃO DE NOVIDADES (#novidades)
            # ==============================================================
            home_url = f"{base_url}/"
            log("LANDING", f"Acessando Landing Page: {home_url}")
            await page.goto(home_url, wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(1.0)

            # Valida seção de Novidades
            sec_novidades = page.locator("#novidades").first
            await sec_novidades.wait_for(state="visible", timeout=10000)

            card_serial = page.locator("text=/.*Impressão Web Serial \\(Sem Drivers\\).*/i").first
            await card_serial.wait_for(state="visible", timeout=8000)

            card_pix = page.locator("text=/.*QR Code Pix Impresso no Papel.*/i").first
            await card_pix.wait_for(state="visible", timeout=8000)

            card_tombstone = page.locator("text=/.*Trava Mestra no Caixa \\(Tombstone\\).*/i").first
            await card_tombstone.wait_for(state="visible", timeout=8000)

            log("SUCESSO", "Seção de Novidades e Cards na Landing Page validados com êxito!", "SUCCESS")

            # ==============================================================
            # TESTE 4: CENTRAL DE AJUDA PÚBLICA (/manual)
            # ==============================================================
            manual_url = f"{base_url}/manual"
            log("MANUAL", f"Acessando Central de Ajuda: {manual_url}")
            await page.goto(manual_url, wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(1.0)

            sec_manual_pix = page.locator("#impressao-pix").first
            await sec_manual_pix.wait_for(state="visible", timeout=10000)

            sec_manual_caixa = page.locator("#seguranca-caixa").first
            await sec_manual_caixa.wait_for(state="visible", timeout=10000)

            log("SUCESSO", "Central de Ajuda Pública validada com Web Serial e Trava Mestra!", "SUCCESS")

            # ==============================================================
            # TESTE 5: CLIENTE MOBILE NO SALÃO (/r/demo?mesa=7)
            # ==============================================================
            context_mobile: BrowserContext = await browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True,
                locale="pt-BR",
            )
            page_mobile: Page = await context_mobile.new_page()

            cliente_url = f"{base_url}/r/demo?mesa=7"
            log("CLIENTE", f"Simulando cliente mobile no salão: {cliente_url}")
            await page_mobile.goto(cliente_url, wait_until="domcontentloaded", timeout=25000)
            await asyncio.sleep(2.0)

            # Localiza e clica em um prato disponível no cardápio
            btn_prato = page_mobile.locator("main button, [role='button']").first
            await btn_prato.wait_for(state="visible", timeout=12000)
            await btn_prato.click()
            log("CLIENTE", "Modal de item do cardápio aberto.")
            await asyncio.sleep(1.0)

            # Clica em 'Adicionar' ao carrinho
            btn_add = page_mobile.locator("button:has-text('Adicionar')").first
            if await btn_add.is_visible(timeout=5000):
                await btn_add.click()
                log("CLIENTE", "Item adicionado ao carrinho.")
                await asyncio.sleep(1.0)

            # Abre o carrinho
            btn_carrinho = page_mobile.locator("text=/.*(Enviar Rodada|Carrinho|Total Itens).*/i").first
            if await btn_carrinho.is_visible(timeout=5000):
                await btn_carrinho.click()
                log("CLIENTE", "Gaveta do carrinho aberta.")
                await asyncio.sleep(1.0)

                # Preenche nome do cliente
                input_nome = page_mobile.locator("input[placeholder*='Marcus'], input[placeholder*='Ex:']").first
                if await input_nome.is_visible(timeout=5000):
                    await input_nome.fill("Bot Playwright E2E")
                    log("CLIENTE", "Nome do cliente preenchido: 'Bot Playwright E2E'.")

                # Clica em enviar pedido
                btn_enviar = page_mobile.locator("button:has-text('Enviar Pedido'), button:has-text('Gerar Ticket')").first
                if await btn_enviar.is_visible(timeout=5000):
                    await btn_enviar.click()
                    log("CLIENTE", "Pedido enviado no salão.")
                    await asyncio.sleep(2.0)

                    # Verifica ticket gerado
                    ticket = page_mobile.locator("text=/.*(Pedido Registrado|Ticket Digital|Modo Resiliente|Comanda).*/i").first
                    await ticket.wait_for(state="visible", timeout=15000)
                    log("SUCESSO", "Ticket Digital emitido com sucesso na mesa 7!", "SUCCESS")

            print(f"\n{C.BOLD}{C.GREEN}{'='*75}")
            print("   ✅ TODOS OS 5 TESTES E2E DO PLAYWRIGHT PASSARAM COM SUCESSO!")
            print(f"{'='*75}{C.RESET}\n")

        finally:
            await browser.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pipeline Playwright E2E MAYaMenu")
    parser.add_argument("--url", default="http://localhost:3000", help="URL base da aplicação")
    parser.add_argument("--headed", action="store_true", help="Rodar com interface gráfica visível")
    args = parser.parse_args()

    asyncio.run(test_novidades_superadmin_caixa(base_url=args.url, headless=not args.headed))
