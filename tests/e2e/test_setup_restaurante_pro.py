#!/usr/bin/env python3
"""
Autor: Marcus Fialho Barreto com suporte I.A. em Antigravity IDE
Horizonte - CE
Outubro de 2026

MAYaMenu - Setup Automatizado de Restaurante PRÓ + Cadastro de 12 Pratos + Operação Realtime (KDS + Mesas)
Stack: Python 3.10+, Playwright Async, Next.js, Firebase Firestore Realtime.

Recursos Especiais:
  • Cursor Visual Neon em Tempo Real (Mostra exatamente onde o bot está olhando, focando e clicando).
  • Trajetórias de mouse humanizadas e destaques de foco nos campos de input.
  • Emissão de Concessão PRÓ via Central /superadmin (Teto de 60 pratos e 30 mesas).
  • Ativação automática no portal efêmero /ativar/[codigo].
  • Cadastro em lote balanceado de 12 pratos (Entradas, Hambúrgueres, Bebidas, Sobremesas).
  • Operação em tempo real com KDS da Cozinha e Cliente Mobile na Mesa.
"""

import argparse
import asyncio
import math
import os
import random
import sys
import time
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
from playwright.async_api import (
    async_playwright,
    Browser,
    BrowserContext,
    Page,
    Locator,
    TimeoutError as PlaywrightTimeoutError,
)

# ==============================================================================
# CONFIGURAÇÕES PADRÃO & PARÂMETROS
# ==============================================================================
DEFAULT_ONLINE_URL = "https://mayamenu--mayaranas-8ad9f.us-east4.hosted.app"
DEFAULT_LOCAL_URL = "http://localhost:3000"
DEFAULT_PIN = "1234"
DEFAULT_SCREENSHOT_DIR = str((Path(__file__).resolve().parent / "screenshots"))

# 12 Pratos Gastronômicos Balanceados para o Cardápio PRÓ
PRATOS_MOCK = [
    # --- ENTRADAS (3) ---
    {
        "nome": "Batata Rústica Trufada",
        "categoria": "Entradas",
        "preco": "28.50",
        "tempo": "10",
        "descricao": "Batatas crocantes temperadas com azeite de trufas brancas, parmesão ralado na hora e alecrim fresco.",
        "foto_index": 4,  # Petiscos / Batatas
    },
    {
        "nome": "Dadinhos de Tapioca com Geleia",
        "categoria": "Entradas",
        "preco": "26.00",
        "tempo": "12",
        "descricao": "Cubos dourados de queijo coalho e tapioca crocante servidos com geleia de pimenta defumada artesanal.",
        "foto_index": 4,
    },
    {
        "nome": "Anéis de Cebola Empanados",
        "categoria": "Entradas",
        "preco": "24.00",
        "tempo": "8",
        "descricao": "Cebolas doces selecionadas empanadas em crosta crocante com molho barbecue especial.",
        "foto_index": 4,
    },
    # --- HAMBÚRGUERES ARTESANAIS (4) ---
    {
        "nome": "MAYa Classic Smash",
        "categoria": "Hambúrgueres",
        "preco": "34.90",
        "tempo": "15",
        "descricao": "Dois smash burgers de 90g, queijo cheddar inglês derretido, cebola na chapa e maionese da casa no brioche.",
        "foto_index": 0,  # Burger Artesanal
    },
    {
        "nome": "Bacon Supreme Melt",
        "categoria": "Hambúrgueres",
        "preco": "39.90",
        "tempo": "18",
        "descricao": "Blend angus 180g grelhado ao ponto, tiras generosas de bacon caramelizado, creme cheddar melt e picles crocante.",
        "foto_index": 0,
    },
    {
        "nome": "Burger Gorgonzola & Mel",
        "categoria": "Hambúrgueres",
        "preco": "42.50",
        "tempo": "18",
        "descricao": "Blend de fraldinha 180g, creme de gorgonzola dolce, crocante de nozes e fio de mel de flor de laranjeira.",
        "foto_index": 0,
    },
    {
        "nome": "Smoked BBQ Ribs Burger",
        "categoria": "Hambúrgueres",
        "preco": "44.00",
        "tempo": "20",
        "descricao": "Costela desfiada lentamente defumada em lenha de macieira, queijo monterey jack e salada coleslaw crocante.",
        "foto_index": 0,
    },
    # --- BEBIDAS ARTESANAIS (3) ---
    {
        "nome": "Soda Italiana Frutas Vermelhas",
        "categoria": "Bebidas",
        "preco": "16.00",
        "tempo": "5",
        "descricao": "Água com gás premium, xarope de amora, framboesa e morango com fatias de limão siciliano.",
        "foto_index": 2,  # Coquetel Tropical
    },
    {
        "nome": "Chá Gelado da Casa com Pêssego",
        "categoria": "Bebidas",
        "preco": "14.50",
        "tempo": "5",
        "descricao": "Infusão artesanal de chá preto com néctar de pêssego natural e folhas frescas de hortelã.",
        "foto_index": 2,
    },
    {
        "nome": "Suco de Maracujá com Tangerina",
        "categoria": "Bebidas",
        "preco": "15.00",
        "tempo": "5",
        "descricao": "Suco natural cítrico batido na hora com gelo e folhas frescas de manjericão roxo.",
        "foto_index": 2,
    },
    # --- SOBREMESAS (2) ---
    {
        "nome": "Petit Gâteau Belga",
        "categoria": "Sobremesas",
        "preco": "27.00",
        "tempo": "12",
        "descricao": "Bolo morno de puro chocolate belga 70% com interior cremoso, acompanhado de sorvete de baunilha de Madagascar.",
        "foto_index": 3,  # Gelato Silvestre
    },
    {
        "nome": "Cheesecake de Frutas Amarelas",
        "categoria": "Sobremesas",
        "preco": "25.00",
        "tempo": "8",
        "descricao": "Base amanteigada com creme de cream cheese aerado e coulis artesanal de manga com maracujá.",
        "foto_index": 3,
    },
]

# Script JavaScript que desenha o ponteiro visual e o rastro de foco na tela
MOUSE_HELPER_JS = """
(() => {
    if (window.__playwright_visual_mouse_installed) return;
    window.__playwright_visual_mouse_installed = true;

    // Elemento do Cursor Neon
    const cursor = document.createElement('div');
    cursor.id = 'playwright-neon-pointer';
    cursor.style.position = 'fixed';
    cursor.style.top = '0px';
    cursor.style.left = '0px';
    cursor.style.width = '26px';
    cursor.style.height = '26px';
    cursor.style.borderRadius = '50%';
    cursor.style.backgroundColor = 'rgba(244, 63, 94, 0.85)'; // Rose neon vibrante
    cursor.style.border = '2px solid #ffffff';
    cursor.style.boxShadow = '0 0 16px rgba(244, 63, 94, 0.95), 0 0 6px rgba(0,0,0,0.6)';
    cursor.style.pointerEvents = 'none';
    cursor.style.zIndex = '2147483647';
    cursor.style.transform = 'translate(-50%, -50%)';
    cursor.style.transition = 'transform 0.08s ease-out, background-color 0.15s ease, box-shadow 0.15s ease';

    // Núcleo central branco
    const centerDot = document.createElement('div');
    centerDot.style.position = 'absolute';
    centerDot.style.top = '50%';
    centerDot.style.left = '50%';
    centerDot.style.width = '8px';
    centerDot.style.height = '8px';
    centerDot.style.borderRadius = '50%';
    centerDot.style.backgroundColor = '#ffffff';
    centerDot.style.transform = 'translate(-50%, -50%)';
    cursor.appendChild(centerDot);

    // Indicador de Foco / Digitação
    const label = document.createElement('div');
    label.id = 'playwright-pointer-label';
    label.style.position = 'absolute';
    label.style.left = '22px';
    label.style.top = '-8px';
    label.style.padding = '2px 6px';
    label.style.borderRadius = '6px';
    label.style.backgroundColor = '#0f172a';
    label.style.color = '#38bdf8';
    label.style.fontFamily = 'monospace';
    label.style.fontSize = '10px';
    label.style.fontWeight = 'bold';
    label.style.whiteSpace = 'nowrap';
    label.style.border = '1px solid #38bdf8';
    label.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
    label.style.display = 'none';
    cursor.appendChild(label);

    document.documentElement.appendChild(cursor);

    // Rastreia movimentação do mouse
    window.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
    }, { passive: true });

    // Animação ao clicar (Fica verde esmeralda pulsante)
    window.addEventListener('mousedown', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(0.7)';
        cursor.style.backgroundColor = 'rgba(16, 185, 129, 0.95)'; // Verde Esmeralda
        cursor.style.boxShadow = '0 0 20px rgba(16, 185, 129, 1), 0 0 8px rgba(0,0,0,0.6)';
    }, { passive: true });

    window.addEventListener('mouseup', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(1)';
        cursor.style.backgroundColor = 'rgba(244, 63, 94, 0.85)'; // Volta para Rose
        cursor.style.boxShadow = '0 0 16px rgba(244, 63, 94, 0.95), 0 0 6px rgba(0,0,0,0.6)';
    }, { passive: true });

    // Destaca campos que receberam foco
    window.addEventListener('focusin', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
            e.target.style.outline = '2px solid #f43f5e';
            e.target.style.outlineOffset = '2px';
            label.style.display = 'block';
            label.textContent = e.target.placeholder || e.target.name || 'Digitação';
        }
    }, { passive: true });

    window.addEventListener('focusout', (e) => {
        if (e.target && e.target.style) {
            e.target.style.outline = '';
            e.target.style.outlineOffset = '';
            label.style.display = 'none';
        }
    }, { passive: true });
})();
"""


# ==============================================================================
# LOGS COLORIDOS COM TIMESTAMP
# ==============================================================================
class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    CLIENT = "\033[38;5;45m"     # Ciano vibrante
    STAFF = "\033[38;5;214m"     # Âmbar / Laranja
    PRO = "\033[38;5;141m"       # Púrpura / Violeta (Plano PRÓ)
    SUCCESS = "\033[38;5;82m"    # Verde vivo
    WARN = "\033[38;5;226m"      # Amarelo
    ERROR = "\033[38;5;196m"     # Vermelho
    SYSTEM = "\033[38;5;39m"     # Azul vivo


def log(actor: str, message: str, level: str = "INFO"):
    agora = time.strftime("%H:%M:%S")
    milis = int((time.time() % 1) * 1000)
    timestamp = f"{Colors.DIM}[{agora}.{milis:03d}]{Colors.RESET}"

    if actor == "SUPERADMIN":
        tag = f"{Colors.PRO}{Colors.BOLD}👑 [SUPERADMIN-PRO]{Colors.RESET}"
    elif actor == "ATIVACAO":
        tag = f"{Colors.PRO}{Colors.BOLD}🔑 [ONBOARDING-PRO]{Colors.RESET}"
    elif actor == "CARDAPIO":
        tag = f"{Colors.STAFF}{Colors.BOLD}🍽️  [GESTOR-PRATOS]{Colors.RESET}"
    elif actor == "KDS":
        tag = f"{Colors.STAFF}{Colors.BOLD}👨‍🍳 [KDS-COZINHA]{Colors.RESET}"
    elif actor == "CLIENTE":
        tag = f"{Colors.CLIENT}{Colors.BOLD}📱 [CLIENTE-MOBILE]{Colors.RESET}"
    elif actor == "SUCESSO":
        tag = f"{Colors.SUCCESS}{Colors.BOLD}✨ [E2E-SUCESSO]{Colors.RESET}"
    else:
        tag = f"{Colors.SYSTEM}{Colors.BOLD}⚡ [SISTEMA]{Colors.RESET}"

    color_msg = Colors.RESET
    if level == "SUCCESS":
        color_msg = Colors.SUCCESS
    elif level == "WARN":
        color_msg = Colors.WARN
    elif level == "ERROR":
        color_msg = Colors.ERROR

    print(f"{timestamp} {tag} {color_msg}{message}{Colors.RESET}", flush=True)


# ==============================================================================
# MOVIMENTOS VISUAIS E CLIQUES SUAVES
# ==============================================================================
async def human_pause(min_s: float = 0.5, max_s: float = 1.2):
    """Simula micro-hesitações humanas de raciocínio."""
    await asyncio.sleep(random.uniform(min_s, max_s))


async def visual_move_and_click(page: Page, locator: Locator, steps: int = 14):
    """Move o ponteiro suavemente até o elemento para você enxergar o foco antes do clique."""
    await locator.scroll_into_view_if_needed(timeout=10000)
    box = await locator.bounding_box()
    if box:
        target_x = box["x"] + box["width"] * random.uniform(0.4, 0.6)
        target_y = box["y"] + box["height"] * random.uniform(0.4, 0.6)
        await page.mouse.move(target_x, target_y, steps=steps)
        await asyncio.sleep(0.08)
    await locator.click()


async def human_type(page: Page, locator: Locator, text: str, delay_range: Tuple[int, int] = (25, 65)):
    """Move o mouse até o campo, clica e digita caractere a caractere."""
    await visual_move_and_click(page, locator, steps=10)
    await locator.fill("")
    for char in text:
        await locator.type(char, delay=random.randint(*delay_range))
        if random.random() < 0.08:
            await asyncio.sleep(random.uniform(0.06, 0.14))


# ==============================================================================
# ETAPA 1: CRIAÇÃO DA CONCESSÃO PRÓ NO SUPERADMIN
# ==============================================================================
async def emitir_licenca_pro(page: Page, base_url: str, tag_bot: str) -> str:
    superadmin_url = f"{base_url}/superadmin"
    log("SUPERADMIN", f"Acessando painel da Gerência Geral: {superadmin_url}")
    await page.goto(superadmin_url, wait_until="domcontentloaded", timeout=45000)
    await human_pause(1.0, 1.8)

    # 1. Clica na aba de 'Emissão & Convites Disponíveis'
    btn_aba_ativas = page.locator("button:has-text('Emissão & Convites Disponíveis'), button:has-text('Disponíveis')").first
    if await btn_aba_ativas.is_visible(timeout=5000):
        await visual_move_and_click(page, btn_aba_ativas)
        await human_pause(0.5, 1.0)

    # 2. Seleciona o plano PRÓ
    btn_pro = page.locator("button:has-text('pro')").first
    await btn_pro.wait_for(state="visible", timeout=8000)
    await visual_move_and_click(page, btn_pro)
    log("SUPERADMIN", "Plano PRÓ selecionado (Teto de 60 pratos e 30 mesas liberado).")
    await human_pause(0.4, 0.8)

    # 3. Preenche responsável / identificador do teste
    input_resp = page.locator("input[placeholder*='Ex: Marcus Barreto'], input[placeholder*='Destinatário']").first
    if await input_resp.is_visible(timeout=4000):
        await human_type(page, input_resp, f"Bot Automatizado PRÓ ({tag_bot})")
        await human_pause(0.3, 0.6)

    # 4. Clica em 'Gerar Código de Licença'
    btn_gerar = page.locator("button:has-text('Gerar Código de Licença'), button:has-text('Gerando')").first
    await visual_move_and_click(page, btn_gerar)
    log("SUPERADMIN", "Disparando emissão da licença PRÓ via Firestore...")

    # 5. Localiza a nova licença emitida no DOM (formato MAYA-XXXX-XXXX)
    codigo_locator = page.locator("text=/MAYA-[A-Z0-9]{4}-[A-Z0-9]{4}/").first
    await codigo_locator.wait_for(state="visible", timeout=12000)
    codigo_licenca = (await codigo_locator.inner_text()).strip()

    log("SUPERADMIN", f"Chave de Concessão PRÓ Emitida: {Colors.PRO}{codigo_licenca}{Colors.RESET}", "SUCCESS")
    return codigo_licenca


# ==============================================================================
# ETAPA 2: ATIVAÇÃO DO RESTAURANTE PRÓ (/ativar/[codigo])
# ==============================================================================
async def ativar_restaurante_pro(page: Page, base_url: str, codigo_licenca: str, dados_restaurante: dict):
    ativar_url = f"{base_url}/ativar/{codigo_licenca}"
    log("ATIVACAO", f"Navegando para o portal de ativação efêmero: {ativar_url}")
    await page.goto(ativar_url, wait_until="domcontentloaded", timeout=45000)
    await human_pause(1.0, 1.8)

    # Validação do badge de verificação
    badge = page.locator("text=/Licença Verificada:.*PRO/i").first
    await badge.wait_for(state="visible", timeout=15000)
    log("ATIVACAO", "Licença validada e autenticada como nível PRÓ pela aplicação.")

    # Preenchimento dos dados do estabelecimento
    input_nome = page.locator("input[placeholder*='Burger do Marcus'], input[placeholder*='Nome']").first
    await human_type(page, input_nome, dados_restaurante["nome"])

    input_slug = page.locator("input[placeholder*='burger-do-marcus'], input[placeholder*='slug']").first
    await human_type(page, input_slug, dados_restaurante["slug"])

    # Modelo Operacional: Híbrido
    btn_hibrido = page.locator("button:has-text('Híbrido (Padrão)')").first
    if await btn_hibrido.is_visible(timeout=3000):
        await visual_move_and_click(page, btn_hibrido)

    # Credenciais Administrativas
    input_email = page.locator("input[type='email']").first
    await human_type(page, input_email, dados_restaurante["email"])

    input_senha = page.locator("input[type='password']").first
    await human_type(page, input_senha, dados_restaurante["senha"])
    await human_pause(0.5, 1.0)

    # Submissão - aceita o texto exato do botão ('Ativar Estabelecimento & Entrar') ou fallback por type='submit'
    btn_ativar = page.locator(
        "button:has-text('Ativar Estabelecimento & Entrar'), button[type='submit'], button:has-text('Ativar e Acessar')"
    ).first
    await btn_ativar.wait_for(state="visible", timeout=15000)
    log("ATIVACAO", "Ativando restaurante e provisionando salão no Firestore...")
    await visual_move_and_click(page, btn_ativar)

    # Aguarda redirecionamento para o /admin autenticado
    await page.wait_for_url("**/admin**", timeout=30000)
    log("ATIVACAO", f"Restaurante PRÓ ativado com sucesso! Painel carregado em /admin.", "SUCCESS")
    await human_pause(1.5, 2.5)


# ==============================================================================
# ETAPA 3: INSERÇÃO AUTOMATIZADA DOS 12 PRATOS
# ==============================================================================
async def cadastrar_doze_pratos(page: Page, pratos: List[Dict[str, Any]]):
    log("CARDAPIO", f"Iniciando cadastro em lote de {len(pratos)} pratos com limite estendido do Plano PRÓ...")

    for idx, prato in enumerate(pratos, start=1):
        log("CARDAPIO", f"[{idx:02d}/{len(pratos)}] Cadastrando item: '{prato['nome']}' ({prato['categoria']} - R$ {prato['preco']})...")

        # Verifica se está no GuidedEmptyCardapio (onboarding do 1º prato quando cardápio está zerado)
        guided_passo1 = page.locator("button:has-text('Avançar'), button:has-text('Lanches'), button:has-text('Entradas')")
        guided_passo2 = page.locator("text=/Qual delícia será ofertada/i")

        eh_guided = False
        try:
            if idx == 1 and (await guided_passo2.is_visible(timeout=2000) or await guided_passo1.first.is_visible(timeout=2000)):
                eh_guided = True
        except Exception:
            eh_guided = False

        if eh_guided:
            log("CARDAPIO", "Detectado assistente de onboarding inicial. Criando o 1º prato pelo assistente guiado...")
            # Passo 1: Seleciona categoria no grid
            btn_cat_guided = page.locator(f"button:has-text('{prato['categoria']}'), button:has-text('Lanches'), button:has-text('Porções')").first
            if await btn_cat_guided.is_visible(timeout=3000):
                await visual_move_and_click(page, btn_cat_guided)
                await human_pause(0.4, 0.8)

            btn_avancar = page.locator("button:has-text('Avançar')").first
            if await btn_avancar.is_visible(timeout=2000):
                await visual_move_and_click(page, btn_avancar)
                await human_pause(0.4, 0.8)

            # Passo 2: Preenche nome, descrição, preço
            input_nome_g = page.locator("input[placeholder*='Ex: Smash Burger Duplo Bacon']").first
            await human_type(page, input_nome_g, prato["nome"])

            textarea_desc_g = page.locator("textarea[placeholder*='2 blends de 100g']").first
            await human_type(page, textarea_desc_g, prato["descricao"])

            input_preco_g = page.locator("input[placeholder*='34,90']").first
            await human_type(page, input_preco_g, prato["preco"].replace(".", ","))

            btn_passo3 = page.locator("button:has-text('Próximo: Foto & Imagem')").first
            await visual_move_and_click(page, btn_passo3)
            await human_pause(0.6, 1.0)

            # Passo 3: Concluir e Publicar
            btn_concluir_g = page.locator("button:has-text('Concluir e Publicar Cardápio')").first
            await visual_move_and_click(page, btn_concluir_g)
            await human_pause(2.0, 3.5)

            # Aguarda a tabela com o botão padrão aparecer
            btn_novo_espera = page.locator("button:has-text('Adicionar Novo Item')").first
            await btn_novo_espera.wait_for(state="visible", timeout=20000)
            log("CARDAPIO", f"✅ [01/{len(pratos)}] Primeiro prato publicado com sucesso pelo onboarding!", "SUCCESS")
            continue

        # FLUXO PADRÃO DO MODAL DE ADICIONAR ITEM (Para os itens subsequentes)
        btn_novo_item = page.locator("button:has-text('+ Adicionar Novo Item'), button:has-text('Adicionar Novo Item')").first
        await btn_novo_item.wait_for(state="visible", timeout=12000)
        await visual_move_and_click(page, btn_novo_item)

        modal_prato = page.locator("[role='dialog']").first
        await modal_prato.wait_for(state="visible", timeout=8000)
        await human_pause(0.3, 0.6)

        # 1. Nome do Prato
        input_nome = modal_prato.locator("input[placeholder*='Ex: Smash Burger Duplo']").first
        await human_type(page, input_nome, prato["nome"])

        # 2. Categoria
        input_cat = modal_prato.locator("input[list='lista-categorias']").first
        await human_type(page, input_cat, prato["categoria"])

        # 3. Preço Base (R$)
        input_preco = modal_prato.locator("input[type='number'][step='0.01']").first
        await human_type(page, input_preco, prato["preco"])

        # 4. Tempo Estimado (min)
        input_tempo = modal_prato.locator("input[type='number'][placeholder='15']").first
        if await input_tempo.is_visible(timeout=2000):
            await human_type(page, input_tempo, prato["tempo"])

        # 5. Descrição
        textarea_desc = modal_prato.locator("textarea[placeholder*='Dois burgers']").first
        await human_type(page, textarea_desc, prato["descricao"])

        # 6. Foto da Galeria MAYa Media Library
        fotos_galeria = modal_prato.locator(".grid-cols-5 button")
        count_fotos = await fotos_galeria.count()
        if count_fotos > 0:
            idx_foto = min(prato.get("foto_index", 0), count_fotos - 1)
            await visual_move_and_click(page, fotos_galeria.nth(idx_foto), steps=8)

        await human_pause(0.3, 0.6)

        # 7. Salva o Prato
        btn_salvar = modal_prato.locator("button[type='submit']:has-text('Salvar Prato'), button[type='submit']:has-text('Salvar')").first
        await visual_move_and_click(page, btn_salvar)

        # Aguarda fechamento da modal
        await modal_prato.wait_for(state="detached", timeout=12000)
        await human_pause(0.4, 0.8)
        log("CARDAPIO", f"✅ [{idx:02d}/{len(pratos)}] '{prato['nome']}' cadastrado com sucesso!", "SUCCESS")

    log("CARDAPIO", f"🎉 Todos os {len(pratos)} pratos foram adicionados ao Cardápio PRÓ!", "SUCCESS")


# ==============================================================================
# ETAPA 4: JORNADA DE OPERAÇÃO EM TEMPO REAL (KDS + CLIENTE MOBILE)
# ==============================================================================
async def jornada_kds_operacao(context: BrowserContext, base_url: str, dados_restaurante: dict, kds_online_event: asyncio.Event, pedido_recebido_event: asyncio.Event):
    page: Page = await context.new_page()
    kds_url = f"{base_url}/cozinha"
    log("KDS", f"Iniciando tela operacional do KDS da Cozinha: {kds_url}")
    await page.goto(kds_url, wait_until="domcontentloaded", timeout=45000)
    await human_pause(1.0, 2.0)

    # 1. Se solicitar autenticação, faz login com as credenciais do restaurante criado
    input_email = page.locator("input[type='email']").first
    if await input_email.is_visible(timeout=3000):
        log("KDS", "Autenticando atendente com as credenciais do restaurante...")
        await human_type(page, input_email, dados_restaurante["email"])
        input_senha = page.locator("input[type='password']").first
        await human_type(page, input_senha, dados_restaurante["senha"])
        btn_login = page.locator("button[type='submit']").first
        await visual_move_and_click(page, btn_login)
        await human_pause(1.5, 2.5)

    # 2. Desbloqueia guarda de PIN da equipe (role=cozinha)
    btn_pin = page.locator("button:has-text('1')").first
    if await btn_pin.is_visible(timeout=3000):
        log("KDS", "Digitando PIN de segurança operacional ('1234')...")
        for digito in DEFAULT_PIN:
            btn_d = page.locator(f"button:has-text('{digito}')").first
            if await btn_d.is_visible(timeout=1000):
                await visual_move_and_click(page, btn_d, steps=6)
                await asyncio.sleep(0.12)
        await human_pause(1.0, 1.8)

    # 3. KDS pronto na esteira
    log("KDS", "KDS pronto e escutando pedidos em tempo real via Firestore!", "SUCCESS")
    kds_online_event.set()

    # 4. Aguarda a chegada do pedido da mesa
    log("KDS", "Aguardando comanda do cliente mobile despontar no ecrã...")
    inicio = time.time()
    card_pedido = None

    while time.time() - inicio < 45:
        btn_marchar = page.locator("button:has-text('MARCHAR PEDIDO')").first
        if await btn_marchar.is_visible():
            card_pedido = btn_marchar.locator("xpath=ancestor::div[contains(@class, 'rounded-3xl')]").first
            break
        await asyncio.sleep(1.0)

    if not card_pedido:
        raise TimeoutError("Tempo esgotado aguardando o pedido aparecer no KDS em tempo real!")

    log("KDS", "🔥 NOVO PEDIDO DETECTADO NA TELA DO KDS!", "SUCCESS")
    await human_pause(1.2, 2.0)

    # 5. Marcha o pedido
    btn_marchar_final = card_pedido.locator("button:has-text('MARCHAR PEDIDO')").first
    await visual_move_and_click(page, btn_marchar_final)
    log("KDS", "Comando 'MARCHAR PEDIDO' acionado pelo cozinheiro.")

    # 6. Confirma status Pronto
    btn_pronto = card_pedido.locator("text=/.*(Pronto|Desfazer).*/i").first
    await btn_pronto.wait_for(state="visible", timeout=8000)
    log("KDS", "✅ PEDIDO MARCHADO COM SUCESSO! Status atualizado para 'Pronto' em tempo real.", "SUCCESS")
    pedido_recebido_event.set()


async def jornada_cliente_mobile(context: BrowserContext, base_url: str, slug: str, mesa: str, kds_online_event: asyncio.Event, shared_state: dict):
    # Aguarda o KDS estar ativo
    await kds_online_event.wait()
    await human_pause(1.0, 2.0)

    page: Page = await context.new_page()
    cliente_url = f"{base_url}/r/{slug}?mesa={mesa}"
    log("CLIENTE", f"Cliente sentou-se na Mesa {mesa}. Abrindo Cardápio Digital: {cliente_url}")
    await page.goto(cliente_url, wait_until="domcontentloaded", timeout=45000)
    await human_pause(1.5, 2.5)

    # 1. Localiza um prato dos 12 recém-criados
    prato_alvo = page.locator("text=/.*(MAYa Classic Smash|Batata R[úu]stica|Burger).*/i").first
    if not await prato_alvo.is_visible(timeout=6000):
        prato_alvo = page.locator("main button").first
        await prato_alvo.wait_for(state="visible", timeout=8000)

    nome_item = (await prato_alvo.inner_text()).split("\n")[0]
    log("CLIENTE", f"Cliente escolheu degustar: '{nome_item}'. Abrindo detalhes...")
    await visual_move_and_click(page, prato_alvo)

    # 2. Modal do prato: clica em adicionar
    modal_cliente = page.locator("[role='dialog']").first
    await modal_cliente.wait_for(state="visible", timeout=8000)
    await human_pause(0.8, 1.5)

    btn_add = modal_cliente.locator("button:has-text('Adicionar')").first
    await visual_move_and_click(page, btn_add)
    log("CLIENTE", f"Item '{nome_item}' adicionado ao carrinho da Mesa {mesa}.")
    await human_pause(1.0, 1.8)

    # 3. Abre o Carrinho / Comanda
    btn_carrinho = page.locator("text=/.*(Enviar Rodada|Carrinho|Total Itens).*/i").first
    if await btn_carrinho.is_visible(timeout=3000):
        await visual_move_and_click(page, btn_carrinho)
    else:
        btn_comanda_topo = page.locator("header button[title*='Comanda'], header button:has-text('Comanda')").first
        await visual_move_and_click(page, btn_comanda_topo)

    # 4. Digita nome do cliente e envia o pedido
    input_nome_cliente = page.locator("input[placeholder*='Marcus'], input[placeholder*='Ex:']").first
    await input_nome_cliente.wait_for(state="visible", timeout=8000)
    nome_gerado = f"Marcus Barreto #{random.randint(10, 99)}"
    shared_state["nome_cliente"] = nome_gerado
    await human_type(page, input_nome_cliente, nome_gerado)
    await human_pause(0.5, 1.0)

    btn_enviar = page.locator("button:has-text('Enviar Pedido'), button:has-text('Gerar Ticket')").first
    await visual_move_and_click(page, btn_enviar)
    log("CLIENTE", "Enviando pedido da mesa diretamente para a cozinha...")

    # 5. Validação do Ticket Digital
    ticket = page.locator("text=/.*(Pedido Registrado|Ticket Digital Garantido|Modo Resiliente).*/i").first
    await ticket.wait_for(state="visible", timeout=15000)
    log("CLIENTE", "🎉 PEDIDO CONFIRMADO! Ticket Digital e QR Code ativos no ecrã da mesa.", "SUCCESS")
    await human_pause(1.5, 3.0)


# ==============================================================================
# ORQUESTRADOR PRINCIPAL
# ==============================================================================
async def main():
    parser = argparse.ArgumentParser(description="MAYaMenu - Setup de Restaurante PRÓ + 12 Pratos + Operação Realtime")
    parser.add_argument("--url", default="", help=f"URL do ambiente (Padrão: {DEFAULT_ONLINE_URL})")
    parser.add_argument("--local", action="store_true", help=f"Executa contra ambiente local ({DEFAULT_LOCAL_URL})")
    parser.add_argument("--headless", type=str, default="false", help="Rodar sem abrir janela gráfica (true/false)")
    parser.add_argument("--slow-mo", type=int, default=50, help="Delay em ms entre ações do Playwright para suavidade visual")
    parser.add_argument("--mesa", default="3", help="Número da mesa para simulação do cliente (Padrão: 3)")
    args = parser.parse_args()

    # Resolução da URL
    base_url = DEFAULT_LOCAL_URL if args.local else (args.url or DEFAULT_ONLINE_URL).rstrip("/")
    headless = args.headless.lower() in ("true", "1", "yes")

    tag_random = f"{random.randint(100, 999)}"
    slug_novo = f"bistro-pro-{tag_random}"

    dados_restaurante = {
        "nome": f"Bistrô MAYa Pró #{tag_random}",
        "slug": slug_novo,
        "email": f"admin.{slug_novo}@mayateste.com",
        "senha": f"ProPassword{tag_random}!",
    }

    print(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
    print(f"{Colors.PRO}{Colors.BOLD}   MAYaMenu • CRIAR RESTAURANTE PRÓ + 12 PRATOS + OPERAÇÃO REALTIME{Colors.RESET}")
    print(f"{Colors.BOLD}{'='*80}{Colors.RESET}")
    print(f" • Ambiente URL:   {Colors.SYSTEM}{base_url}{Colors.RESET}")
    print(f" • Estabelecimento:{Colors.PRO} {dados_restaurante['nome']}{Colors.RESET}")
    print(f" • Slug Público:   {Colors.PRO}/r/{dados_restaurante['slug']}{Colors.RESET}")
    print(f" • Admin Email:    {Colors.STAFF}{dados_restaurante['email']}{Colors.RESET}")
    print(f" • Total Pratos:   {Colors.SUCCESS}{len(PRATOS_MOCK)} pratos balanceados{Colors.RESET}")
    print(f" • Modo Janela:    {'Headless (Segundo Plano)' if headless else 'Visível (Janelas Abertas com Ponteiro Neon Ativo)'}")
    print(f"{Colors.BOLD}{'-'*80}{Colors.RESET}\n")

    screenshot_dir = Path(DEFAULT_SCREENSHOT_DIR)
    screenshot_dir.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser: Browser = await p.chromium.launch(
            headless=headless,
            slow_mo=args.slow_mo,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--window-size=1920,1080",
            ],
        )

        try:
            # Contexto 1: Gestão / Admin (Desktop 1600x950)
            ctx_admin: BrowserContext = await browser.new_context(
                viewport={"width": 1600, "height": 950},
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                locale="pt-BR",
                timezone_id="America/Sao_Paulo",
                ignore_https_errors=True,
            )
            # Injeta ponteiro visual neon em todas as páginas do contexto
            await ctx_admin.add_init_script(MOUSE_HELPER_JS)

            page_admin = await ctx_admin.new_page()

            # FASE 1: Emitir Licença PRÓ
            codigo_licenca = await emitir_licenca_pro(page_admin, base_url, tag_random)

            # FASE 2: Ativar Restaurante PRÓ
            await ativar_restaurante_pro(page_admin, base_url, codigo_licenca, dados_restaurante)

            # FASE 3: Cadastrar 12 Pratos
            await cadastrar_doze_pratos(page_admin, PRATOS_MOCK)

            # Evidência do Cardápio Completo
            evidencia_cardapio = screenshot_dir / f"cardapio_12_pratos_{slug_novo}.png"
            await page_admin.screenshot(path=str(evidencia_cardapio))
            log("SISTEMA", f"Evidência do cardápio salva em: {evidencia_cardapio}")

            # FASE 4: Iniciar Operação em Tempo Real (KDS Cozinha + Cliente Mobile na Mesa)
            print(f"\n{Colors.BOLD}{'-'*80}{Colors.RESET}")
            log("SISTEMA", "Iniciando FASE OPERACIONAL: Disparando KDS da Cozinha e Cliente na Mesa simultaneamente...\n")

            ctx_mobile: BrowserContext = await browser.new_context(
                viewport={"width": 390, "height": 844},
                user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
                is_mobile=True,
                has_touch=True,
                locale="pt-BR",
                timezone_id="America/Sao_Paulo",
                ignore_https_errors=True,
            )
            await ctx_mobile.add_init_script(MOUSE_HELPER_JS)

            kds_online_event = asyncio.Event()
            pedido_recebido_event = asyncio.Event()
            shared_state = {}

            await asyncio.gather(
                jornada_kds_operacao(ctx_admin, base_url, dados_restaurante, kds_online_event, pedido_recebido_event),
                jornada_cliente_mobile(ctx_mobile, base_url, dados_restaurante["slug"], args.mesa, kds_online_event, shared_state),
                return_exceptions=False,
            )

            print(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
            log("SUCESSO", "SETUP COMPLETO & OPERAÇÃO REALTIME CONCLUÍDOS COM 100% DE ÊXITO!", "SUCCESS")
            print(f" • Restaurante:  {dados_restaurante['nome']}")
            print(f" • Licença:      {codigo_licenca} (Plano PRÓ)")
            print(f" • Cardápio:     12 pratos cadastrados e ativos")
            print(f" • Pedido Mesa:  Recebido e Marchado com Sucesso no KDS")
            print(f" • Link Público: {base_url}/r/{dados_restaurante['slug']}?mesa={args.mesa}")
            print(f"{Colors.BOLD}{'='*80}{Colors.RESET}\n")

        finally:
            log("SISTEMA", "Encerrando sessões de teste e liberando Chromium.")
            await browser.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n{Colors.WARN}[OPERAÇÃO CANCELADA PELO USUÁRIO]{Colors.RESET}")
        sys.exit(0)
    except Exception as e:
        print(f"\n{Colors.ERROR}{Colors.BOLD}[FALHA NA EXECUÇÃO]: {e}{Colors.RESET}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
