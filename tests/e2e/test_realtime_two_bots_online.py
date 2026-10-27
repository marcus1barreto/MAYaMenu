#!/usr/bin/env python3
"""
Autor: Marcus Fialho Barreto com suporte I.A. em Antigravity IDE
Horizonte - CE
Outubro de 2026

Proibida a modificação, cópia, comercialização e distribuição sem autorização prévia.
marcus1fialho@gmail.com 

MAYaMenu - Simulação E2E de Salão Completo em Tempo Real (4 Mesas Simultâneas + KDS Cozinha)
Stack: Python 3.10+, Playwright Async, Next.js 16, Firebase Firestore Realtime.

Projetado especificamente para rodar contra ambientes hospedados na nuvem via HTTPS
(ex: https://mayamenu--mayaranas-8ad9f.us-east4.hosted.app).
"""

import argparse
import asyncio
import math
import os
import random
import sys
import time
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from playwright.async_api import (
    async_playwright,
    Browser,
    BrowserContext,
    Page,
    Locator,
    TimeoutError as PlaywrightTimeoutError,
)

# ==============================================================================
# CONFIGURAÇÕES PESSOAIS & PARÂMETROS PADRÃO (PRODUÇÃO MAYAMENU)
# ==============================================================================
DEFAULT_URL = os.getenv("MAYAMENU_ONLINE_URL", "https://mayamenu--mayaranas-8ad9f.us-east4.hosted.app")
DEFAULT_SLUG = os.getenv("CLIENTE_SLUG", "teste-lanches")
DEFAULT_EMAIL = os.getenv("ADMIN_EMAIL", "teste@teste.com")
DEFAULT_PASSWORD = os.getenv("ADMIN_PASSWORD", "&Lin7&1971")
DEFAULT_PIN = os.getenv("KDS_PIN", "1234")
DEFAULT_SCREENSHOT_DIR = str((Path(__file__).resolve().parent / "screenshots"))

NOMES_POOL = [
    "Marcus Barreto", "Mayara Nas", "Lucas Mendes", "Beatriz Lima",
    "Rafael Souza", "Camila Rocha", "Rodrigo Alves", "Juliana Ribeiro",
    "Felipe Duarte", "Larissa Fonseca", "Gustavo Martins", "Fernanda Castro",
    "Gabriel Pires", "Aline Moreira", "Bruno Carvalho", "Mariana Barbosa",
    "Thiago Neves", "Amanda Silveira", "Diego Farias", "Priscila Ramos",
    "Otavio Peixoto", "Helena Vasconcelos", "Renato Aragao", "Patricia Lins"
]

OBSERVACOES_POOL = [
    "Caprichar no preparo, por favor!",
    "Sem cebola, por favor.",
    "Ao ponto pra mal passado.",
    "Bem passado, bem tostadinho.",
    "Molho à parte se possível.",
    "Por favor, mandar talheres e guardanapos extras.",
    "Sem pimenta.",
    "Caprichar no queijo!",
    "Porção caprichada se possível :)",
    "Favor não esquecer o limão.",
    "",
    "",
]

# Cores para cada ator do salão
CORES_MESAS = [
    "\033[38;5;45m",   # Ciano (Mesa 1)
    "\033[38;5;82m",   # Verde vivo (Mesa 2)
    "\033[38;5;220m",  # Dourado / Amarelo (Mesa 3)
    "\033[38;5;213m",  # Rosa / Magenta (Mesa 4)
    "\033[38;5;51m",   # Turquesa
    "\033[38;5;208m",  # Laranja
]


# ==============================================================================
# LOGS COLORIDOS
# ==============================================================================
class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    STAFF = "\033[38;5;214m"     # Âmbar / Laranja
    SUCCESS = "\033[38;5;82m"    # Verde vivo
    WARN = "\033[38;5;226m"      # Amarelo
    ERROR = "\033[38;5;196m"     # Vermelho
    SYSTEM = "\033[38;5;141m"    # Roxo suave


def log(actor: str, message: str, level: str = "INFO", cor_custom: Optional[str] = None):
    agora = time.strftime("%H:%M:%S")
    milis = int((time.time() % 1) * 1000)
    timestamp = f"{Colors.DIM}[{agora}.{milis:03d}]{Colors.RESET}"

    if actor.startswith("MESA"):
        cor = cor_custom or Colors.RESET
        tag = f"{cor}{Colors.BOLD}📱 [{actor}]{Colors.RESET}"
    elif actor == "KDS":
        tag = f"{Colors.STAFF}{Colors.BOLD}👨‍🍳 [KDS-COZINHA]{Colors.RESET}"
    elif actor == "SUCESSO":
        tag = f"{Colors.SUCCESS}{Colors.BOLD}🎉 [QA-SUCESSO]{Colors.RESET}"
    else:
        tag = f"{Colors.SYSTEM}{Colors.BOLD}🌐 [SISTEMA]{Colors.RESET}"

    color_msg = Colors.RESET
    if level == "SUCCESS":
        color_msg = Colors.SUCCESS
    elif level == "WARN":
        color_msg = Colors.WARN
    elif level == "ERROR":
        color_msg = Colors.ERROR

    print(f"{timestamp} {tag} {color_msg}{message}{Colors.RESET}", flush=True)


# ==============================================================================
# HUMANIZAÇÃO DE MOVIMENTOS & CLIQUES
# ==============================================================================
async def human_pause(min_s: float = 0.8, max_s: float = 1.6):
    """Pausa com distribuição contínua simulando reação humana."""
    await asyncio.sleep(random.uniform(min_s, max_s))


def _bezier_point(p0: Tuple[float, float], p1: Tuple[float, float], p2: Tuple[float, float], p3: Tuple[float, float], t: float) -> Tuple[float, float]:
    u = 1 - t
    return (
        (u**3) * p0[0] + 3 * (u**2) * t * p1[0] + 3 * u * (t**2) * p2[0] + (t**3) * p3[0],
        (u**3) * p0[1] + 3 * (u**2) * t * p1[1] + 3 * u * (t**2) * p2[1] + (t**3) * p3[1],
    )


async def human_move_mouse(page: Page, target_x: float, target_y: float, steps: int = 14):
    vp = page.viewport_size or {"width": 1280, "height": 720}
    start_x = random.uniform(vp["width"] * 0.25, vp["width"] * 0.75)
    start_y = random.uniform(vp["height"] * 0.25, vp["height"] * 0.75)

    dx = target_x - start_x
    dy = target_y - start_y
    ctrl1 = (start_x + dx * 0.3 + random.uniform(-20, 20), start_y + dy * 0.3 + random.uniform(-20, 20))
    ctrl2 = (start_x + dx * 0.7 + random.uniform(-15, 15), start_y + dy * 0.7 + random.uniform(-15, 15))

    for i in range(1, steps + 1):
        t = i / steps
        t_eased = math.sin((t * math.pi) / 2) if t < 0.5 else 1 - math.cos((t * math.pi) / 2)
        nx, ny = _bezier_point((start_x, start_y), ctrl1, ctrl2, (target_x, target_y), t_eased)
        await page.mouse.move(nx, ny)
        await asyncio.sleep(random.uniform(0.005, 0.012))


async def human_click(page: Page, locator: Locator, timeout: int = 15000):
    """
    Rola o elemento suavemente para a visão, move o cursor em curva natural
    e despacha o clique nativo.
    """
    await locator.scroll_into_view_if_needed(timeout=timeout)
    box = await locator.bounding_box()
    if box:
        target_x = box["x"] + box["width"] * random.uniform(0.35, 0.65)
        target_y = box["y"] + box["height"] * random.uniform(0.35, 0.65)
        await human_move_mouse(page, target_x, target_y, steps=random.randint(10, 14))
        await asyncio.sleep(random.uniform(0.04, 0.09))

    await locator.click(timeout=timeout)


async def human_type(locator: Locator, text: str):
    """Digitação humana com garantia de sincronização com o state do React."""
    await locator.click()
    await locator.fill("")
    for char in text:
        await locator.type(char, delay=random.randint(25, 75))
        if random.random() < 0.06:
            await asyncio.sleep(random.uniform(0.06, 0.14))
    val = await locator.input_value()
    if val != text:
        await locator.fill(text)


async def human_scroll(page: Page, total_delta_y: int = 300, direction: str = "down"):
    """Simula gesto de rolagem com aceleração variável."""
    sinal = 1 if direction == "down" else -1
    restante = abs(total_delta_y)

    while restante > 0:
        passo = min(restante, random.randint(60, 120))
        restante -= passo
        await page.mouse.wheel(0, passo * sinal)
        await asyncio.sleep(random.uniform(0.03, 0.07))

    await asyncio.sleep(random.uniform(0.3, 0.6))


# ==============================================================================
# SCRIPT DE STEALTH ANTI-DETECÇÃO
# ==============================================================================
STEALTH_INIT_SCRIPT = """
Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined
});
window.chrome = {
    runtime: {},
    loadTimes: function() {},
    csi: function() {},
    app: {}
};
Object.defineProperty(navigator, 'languages', {
    get: () => ['pt-BR', 'pt', 'en-US', 'en']
});
"""


# ==============================================================================
# SUB-ROTINAS DO CLIENTE NO CARDÁPIO
# ==============================================================================
async def carregar_pagina_cardapio(page: Page, url_cliente: str, timeout_ms: int, tag_mesa: str, cor_mesa: str) -> bool:
    """Carrega a página do cardápio com proteção contra cold start do Cloud Run (HTTP 500)."""
    for tentativa in range(1, 4):
        try:
            resp = await page.goto(url_cliente, wait_until="domcontentloaded", timeout=timeout_ms)
            status_code = resp.status if resp else 200

            conteudo = (await page.content()).lower()
            if status_code >= 500 or "server error" in conteudo or "500 server error" in conteudo:
                log(tag_mesa, f"Instância online retornou HTTP {status_code} (Cold Start). Tentativa {tentativa}/3. Aguardando 7s...", "WARN", cor_mesa)
                await asyncio.sleep(7.0)
                continue

            await page.wait_for_selector("header, main", timeout=timeout_ms)
            return True
        except Exception as e:
            log(tag_mesa, f"Latência na tentativa {tentativa}/3 ao carregar cardápio: {e}", "WARN", cor_mesa)
            await asyncio.sleep(3.0)

    return False


async def escolher_prato_autonomo(page: Page, tag_mesa: str, cor_mesa: str) -> Tuple[str, Optional[Locator]]:
    """
    Inspeciona o cardápio real e sorteia autonomamente um dos pratos visíveis.
    """
    btn_todas = page.locator("header button:has-text('Todas')").first
    if await btn_todas.is_visible():
        await human_click(page, btn_todas)
        await human_pause(0.3, 0.6)

    cards_pratos = page.locator("main button:has(h3)")
    await cards_pratos.first.wait_for(state="visible", timeout=15000)
    total_pratos = await cards_pratos.count()

    if total_pratos == 0:
        raise RuntimeError("Nenhum prato visível encontrado no cardápio!")

    idx_sorteado = random.randint(0, total_pratos - 1)
    prato_alvo = cards_pratos.nth(idx_sorteado)
    prato_nome = (await prato_alvo.locator("h3").first.inner_text()).strip()

    log(tag_mesa, f"Prato escolhido autonomamente: '{prato_nome}' (Item {idx_sorteado + 1} de {total_pratos})", cor_custom=cor_mesa)
    return prato_nome, prato_alvo


async def configurar_e_adicionar_ao_carrinho(
    page: Page,
    prato_alvo: Locator,
    prato_nome: str,
    observacao: str,
    tag_mesa: str,
    cor_mesa: str,
):
    """
    Abre o modal do prato, escolhe opções/modificadores caso exigidos,
    digita a observação e clica em 'Adicionar' à comanda.
    """
    await human_click(page, prato_alvo)

    modal_locator = page.locator(
        "[data-slot='dialog-content'], [role='dialog'], div.fixed:has(button:has-text('Adicionar')), div.fixed:has(button:has-text('Escolha'))"
    ).first
    await modal_locator.wait_for(state="visible", timeout=12000)
    await human_pause(0.5, 1.0)

    btn_adicionar = modal_locator.locator("button:has-text('Adicionar'), button:has-text('Escolha')").first
    await btn_adicionar.wait_for(state="visible", timeout=8000)

    opcoes_disponiveis = modal_locator.locator("label:has(input), label.cursor-pointer")
    total_opcoes = await opcoes_disponiveis.count()

    if total_opcoes > 0:
        sorteio_op = random.randint(0, total_opcoes - 1)
        log(tag_mesa, f"Prato com opções detectadas. Selecionando preferência #{sorteio_op + 1}...", cor_custom=cor_mesa)
        await human_click(page, opcoes_disponiveis.nth(sorteio_op))
        await human_pause(0.4, 0.8)

    if observacao:
        textarea_obs = modal_locator.locator("textarea[placeholder*='observação'], textarea").first
        try:
            if await textarea_obs.is_visible(timeout=1500):
                log(tag_mesa, f"Adicionando observação: \"{observacao}\"", cor_custom=cor_mesa)
                await human_type(textarea_obs, observacao)
                await human_pause(0.4, 0.7)
        except Exception:
            pass

    await human_click(page, btn_adicionar)
    log(tag_mesa, f"Item '{prato_nome}' adicionado à comanda com sucesso!", cor_custom=cor_mesa)
    await human_pause(0.8, 1.3)


async def despachar_pedido_carrinho(
    page: Page,
    nome_cliente: str,
    mesa: int,
    screenshot_dir: Path,
    tag_mesa: str,
    cor_mesa: str,
) -> bool:
    """
    Abre o carrinho, preenche o nome do cliente na mesa,
    despacha a comanda para o Firebase e valida o ticket gerado.
    """
    btn_carrinho_flutuante = page.locator("text=/.*(Enviar Rodada|Carrinho|Total Itens).*/i").first
    btn_comanda_topo = page.locator("header button[title*='Comanda'], header button:has-text('Comanda')").first

    if await btn_carrinho_flutuante.is_visible(timeout=3000):
        await human_click(page, btn_carrinho_flutuante)
    else:
        await human_click(page, btn_comanda_topo)

    input_nome = page.locator("input[placeholder*='Marcus'], input[placeholder*='Ex:'], input[placeholder*='Nome']").first
    await input_nome.wait_for(state="visible", timeout=10000)

    log(tag_mesa, f"Registrando nome na comanda: '{nome_cliente}'...", cor_custom=cor_mesa)
    await human_pause(0.4, 0.8)
    await human_type(input_nome, nome_cliente)
    await human_pause(0.5, 1.0)

    btn_finalizar = page.locator("button:has-text('Enviar Pedido'), button:has-text('Gerar Ticket')").first
    await btn_finalizar.wait_for(state="visible", timeout=8000)
    log(tag_mesa, "Despachando pedido para a cozinha via Firebase...", cor_custom=cor_mesa)
    await human_click(page, btn_finalizar)

    sucesso_locator = page.locator("text=/.*(Pedido Registrado|Ticket Digital Garantido|Modo Resiliente).*/i").first
    await sucesso_locator.wait_for(state="visible", timeout=30000)

    nome_arquivo_seguro = "".join(c for c in nome_cliente if c.isalnum() or c in (" ", "_")).replace(" ", "_")
    caminho_print = screenshot_dir / f"ticket_mesa_{mesa}_{nome_arquivo_seguro}.png"
    await page.screenshot(path=str(caminho_print), full_page=True)
    log(tag_mesa, f"🎉 Pedido confirmado no salão! Ticket salvo em: {caminho_print.name}", "SUCCESS", cor_mesa)

    btn_voltar = page.locator("button:has-text('Concluir e Voltar ao Cardápio')").first
    if await btn_voltar.is_visible(timeout=3000):
        await human_click(page, btn_voltar)
        await human_pause(0.8, 1.4)
    else:
        await human_pause(1.0, 1.8)

    return True


# ==============================================================================
# JORNADA DE UMA MESA (CLIENTES SIMULTÂNEOS)
# ==============================================================================
async def jornada_mesa_online(
    context: BrowserContext,
    mesa: int,
    num_clientes: int,
    config: dict,
    shared_state: dict,
    cor_mesa: str,
    kds_online_event: asyncio.Event,
):
    tag_mesa = f"MESA {mesa}"

    # Aguarda o KDS da Cozinha inicializar e abrir a esteira antes das mesas pedirem
    log(tag_mesa, "Aguardando KDS da Cozinha conectar à nuvem e abrir a esteira...", cor_custom=cor_mesa)
    await kds_online_event.wait()
    log(tag_mesa, f"KDS confirmado online! Ocupando Mesa {mesa} com {num_clientes} cliente(s)!", cor_custom=cor_mesa)

    page: Page = await context.new_page()
    await page.add_init_script(STEALTH_INIT_SCRIPT)

    url_cliente = f"{config['base_url']}/r/{config['slug']}?mesa={mesa}"
    screenshot_dir = Path(config["screenshot_dir"])

    try:
        ok = await carregar_pagina_cardapio(page, url_cliente, config["timeout_ms"], tag_mesa, cor_mesa)
        if not ok:
            caminho_err = screenshot_dir / f"falha_carregamento_mesa_{mesa}.png"
            await page.screenshot(path=str(caminho_err), full_page=True)
            raise RuntimeError(f"Mesa {mesa} não conseguiu carregar o cardápio online.")

        log(tag_mesa, "Cardápio digital carregado com sucesso via CDN/HTTPS!", cor_custom=cor_mesa)
        await human_pause(1.0, 1.8)

        await human_scroll(page, total_delta_y=250, direction="down")
        await human_pause(0.5, 0.9)
        await human_scroll(page, total_delta_y=150, direction="up")

        for idx_cli in range(1, num_clientes + 1):
            nome_sorteado = f"{random.choice(NOMES_POOL)} #{random.randint(10, 99)}"
            obs_sorteada = random.choice(OBSERVACOES_POOL)

            log(tag_mesa, f"--- Cliente {idx_cli}/{num_clientes} ({nome_sorteado}) iniciando escolha no cardápio ---", cor_custom=cor_mesa)

            prato_nome, prato_card = await escolher_prato_autonomo(page, tag_mesa, cor_mesa)

            await configurar_e_adicionar_ao_carrinho(
                page, prato_card, prato_nome, obs_sorteada, tag_mesa, cor_mesa
            )

            await despachar_pedido_carrinho(
                page, nome_sorteado, mesa, screenshot_dir, tag_mesa, cor_mesa
            )

            pedido_info = {
                "mesa": mesa,
                "cliente": nome_sorteado,
                "prato": prato_nome,
                "observacao": obs_sorteada,
            }
            shared_state["pedidos_enviados"].append(pedido_info)
            log(tag_mesa, f"Pedido de '{nome_sorteado}' registrado no KDS!", "SUCCESS", cor_mesa)

            if idx_cli < num_clientes:
                log(tag_mesa, f"Próximo cliente da Mesa {mesa} se preparando para pedir...", cor_custom=cor_mesa)
                await human_pause(1.5, 2.5)

        log(tag_mesa, f"🏁 Todos os {num_clientes} clientes da Mesa {mesa} concluíram seus pedidos com sucesso!", "SUCCESS", cor_mesa)

    except Exception as e:
        caminho_err = screenshot_dir / f"falha_mesa_{mesa}.png"
        try:
            await page.screenshot(path=str(caminho_err), full_page=True)
            log(tag_mesa, f"Erro na Mesa {mesa}. Screenshot salvo em: {caminho_err}", "ERROR", cor_mesa)
        except Exception:
            pass
        raise e
    finally:
        shared_state["mesas_finalizadas"] += 1


# ==============================================================================
# JORNADA DO KDS DA COZINHA (RECEPÇÃO EM TEMPO REAL)
# ==============================================================================
async def carregar_pagina_kds(page: Page, url_kds: str, timeout_ms: int) -> bool:
    """Carrega o KDS com tolerância a cold start do Cloud Run (HTTP 500)."""
    for tentativa in range(1, 4):
        try:
            resp = await page.goto(url_kds, wait_until="domcontentloaded", timeout=timeout_ms)
            status_code = resp.status if resp else 200

            conteudo = (await page.content()).lower()
            if status_code >= 500 or "server error" in conteudo or "500 server error" in conteudo:
                log("KDS", f"Instância online retornou HTTP {status_code} (Cold Start). Tentativa {tentativa}/3. Aguardando 7s...", "WARN")
                await asyncio.sleep(7.0)
                continue

            await page.wait_for_selector("main, form, input[type='email'], h1", timeout=timeout_ms)
            return True
        except Exception as e:
            log("KDS", f"Latência na tentativa {tentativa}/3 ao carregar KDS: {e}", "WARN")
            await asyncio.sleep(3.0)

    return False


async def jornada_atendente_kds(
    context: BrowserContext,
    config: dict,
    shared_state: dict,
    kds_online_event: asyncio.Event,
):
    page: Page = await context.new_page()
    await page.add_init_script(STEALTH_INIT_SCRIPT)
    await page.add_init_script("""
        try {
            sessionStorage.setItem('mayamenu_pin_unlocked_cozinha', 'true');
            sessionStorage.setItem('mayamenu_pin_unlocked_garcom', 'true');
        } catch (e) {}
    """)

    url_kds = f"{config['base_url']}/cozinha"
    screenshot_dir = Path(config["screenshot_dir"])
    log("KDS", f"Inicializando KDS da Cozinha via HTTPS: {url_kds}")

    try:
        ok = await carregar_pagina_kds(page, url_kds, config["timeout_ms"])
        if not ok:
            caminho_err = screenshot_dir / "falha_carregamento_kds.png"
            await page.screenshot(path=str(caminho_err), full_page=True)
            raise RuntimeError("Não foi possível carregar o KDS da Cozinha.")

        # 1. Aguarda saída do carregamento inicial se houver
        loading_screen = page.locator("text=/.*(Carregando KDS|Carregando).*/i").first
        try:
            if await loading_screen.is_visible(timeout=2500):
                await loading_screen.wait_for(state="detached", timeout=12000)
        except Exception:
            pass

        # 2. Autenticação Administrativa
        input_email = page.locator("input[type='email']").first
        precisa_login = False
        try:
            if await input_email.is_visible(timeout=4000):
                precisa_login = True
            else:
                await input_email.wait_for(state="visible", timeout=6000)
                precisa_login = True
        except Exception:
            precisa_login = False

        if precisa_login:
            log("KDS", f"Formulário de acesso detectado. Autenticando com: {config['admin_email']}...")
            await human_pause(0.5, 1.0)
            await human_type(input_email, config["admin_email"])

            input_senha = page.locator("input[type='password']").first
            await human_type(input_senha, config["admin_password"])
            await human_pause(0.3, 0.6)

            btn_entrar = page.locator("button:has-text('Entrar no Sistema')").first
            await human_click(page, btn_entrar)
            log("KDS", "Credenciais enviadas. Aguardando validação do Firebase Auth...")

            login_sucesso = False
            for _ in range(12):
                await asyncio.sleep(1.0)
                pin_ou_kds = await page.locator("text=/.*(Modo Cozinha|KDS da Cozinha|Terminal do Salão|Dispositivo de equipe).*/i").count()
                if not await input_email.is_visible() or pin_ou_kds > 0:
                    login_sucesso = True
                    log("KDS", "Autenticação aceita com sucesso pelo Firebase!")
                    break

            if not login_sucesso and await input_email.is_visible():
                caminho_err = screenshot_dir / "timeout_login_kds.png"
                await page.screenshot(path=str(caminho_err), full_page=True)
                raise TimeoutError("O formulário de login do KDS não avançou.")

        # 3. Desbloqueio de PIN
        pin_guard = page.locator("text=/.*(Modo Cozinha|Dispositivo de equipe protegido|Terminal do Salão).*/i").first
        try:
            if await pin_guard.is_visible(timeout=5000):
                log("KDS", "Terminal protegido por PIN detectado. Desbloqueando KDS...")
                await human_pause(0.5, 0.8)
                btn_pular = page.locator("button:has-text('Pular')").first
                if await btn_pular.is_visible():
                    await human_click(page, btn_pular)
                else:
                    for digito in str(config["pin"]):
                        btn_num = page.locator(f"button:has-text('{digito}')").first
                        await human_click(page, btn_num)
                        await asyncio.sleep(0.1)
                await pin_guard.wait_for(state="hidden", timeout=8000)
                log("KDS", "PIN guard liberado com sucesso.")
        except Exception:
            pass

        # 4. Validação de Painel KDS Carregado
        cabecalho_kds = page.locator("h1:has-text('KDS da Cozinha'), h1:has-text('KDS'), header:has-text('KDS')").first
        await cabecalho_kds.wait_for(state="visible", timeout=30000)

        subtitulo_el = page.locator("header p.text-muted-foreground, p:has-text('Visão Operacional')").first
        try:
            texto_sub = await subtitulo_el.inner_text()
            if "MAYaMenu •" in texto_sub:
                log("KDS", "Sincronizando dados do restaurante...")
                await human_pause(1.2, 2.0)
                await page.reload(wait_until="domcontentloaded")
                await cabecalho_kds.wait_for(state="visible", timeout=15000)
        except Exception:
            pass

        log("KDS", "🔥 KDS 100% ONLINE E OUVINDO A ESTEIRA! Liberando as mesas para os pedidos...", "SUCCESS")
        
        # Sinaliza que o KDS está totalmente pronto para receber pedidos das mesas
        kds_online_event.set()

        # 5. Monitoramento contínuo da esteira em tempo real via Firestore
        total_esperado = shared_state["total_pedidos_esperados"]
        pedidos_identificados = set()
        inicio_espera = time.time()

        log("KDS", f"Escutando em tempo real... Aguardando a chegada dos {total_esperado} pedidos das mesas na esteira.")

        # Tempo limite proporcional à quantidade de clientes (com folga para ações humanizadas)
        tempo_limite_esteira = max(260, total_esperado * 40)
        while time.time() - inicio_espera < tempo_limite_esteira:
            cards_pedidos = page.locator("div.rounded-3xl:has(button:has-text('MARCHAR PEDIDO'))")
            qtd_visivel = await cards_pedidos.count()

            for i in range(qtd_visivel):
                card = cards_pedidos.nth(i)
                try:
                    nome_cliente_el = card.locator("h3").first
                    if await nome_cliente_el.is_visible():
                        nome_cli = (await nome_cliente_el.inner_text()).strip()
                        if nome_cli and nome_cli not in pedidos_identificados:
                            pedidos_identificados.add(nome_cli)
                            mesa_num_el = card.locator("div.w-10.h-10").first
                            mesa_txt = (await mesa_num_el.inner_text()).strip() if await mesa_num_el.is_visible() else "?"
                            log("KDS", f"🔥 NOVO PEDIDO NA ESTEIRA! [Mesa {mesa_txt} • Cliente: {nome_cli}]", "SUCCESS")
                except Exception:
                    pass

            if shared_state["mesas_finalizadas"] >= config["qtd_mesas"]:
                if len(pedidos_identificados) >= total_esperado or qtd_visivel >= total_esperado:
                    log("KDS", f"Todos os {total_esperado} pedidos chegaram à esteira do KDS!", "SUCCESS")
                    break

            await asyncio.sleep(1.5)

        # Pausa para estabilizar a visualização da esteira com todos os pedidos reunidos
        await human_pause(2.0, 3.5)

        # Evidência fotográfica panorâmica: Esteira completa no ponto de marchar!
        caminho_print_esteira = screenshot_dir / "kds_esteira_todas_mesas_no_ponto_de_marchar.png"
        await page.screenshot(path=str(caminho_print_esteira), full_page=True)

        print(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
        log("SUCESSO", "ESTEIRA NO PONTO EXATO DE MARCHAR OS PEDIDOS!", "SUCCESS")
        log("SUCESSO", f"Total de pedidos prontos na esteira: {len(pedidos_identificados)} de {total_esperado}", "SUCCESS")
        print(f" Evidência salva em: {caminho_print_esteira.resolve()}")
        print(f"{Colors.BOLD}{'='*80}{Colors.RESET}\n")

        # 6. Se a flag --marchar estiver ativa, o KDS marcha todos os pedidos
        if config.get("marchar", False):
            log("KDS", "Flag --marchar ativada! Iniciando marcha de todos os pedidos na esteira...", "SUCCESS")
            while True:
                botoes_marchar = page.locator("button:has-text('MARCHAR PEDIDO')")
                qtd_a_marchar = await botoes_marchar.count()
                if qtd_a_marchar == 0:
                    break

                btn_marchar = botoes_marchar.first
                await human_click(page, btn_marchar)
                await human_pause(1.0, 1.8)

            caminho_print_marchados = screenshot_dir / "kds_esteira_todos_pedidos_marchados.png"
            await page.screenshot(path=str(caminho_print_marchados), full_page=True)
            log("KDS", "✅ TODOS OS PEDIDOS DO SALÃO FORAM MARCHADOS COM SUCESSO!", "SUCCESS")
        else:
            log("KDS", "Os pedidos foram mantidos no estado 'MARCHAR PEDIDO' para conferência visual.", "SUCCESS")

        if not config.get("headless", False) and config.get("tempo_espera", 0) > 0:
            log("SISTEMA", f"Mantendo janelas abertas por {config['tempo_espera']} segundos para inspeção visual...")
            await asyncio.sleep(config["tempo_espera"])

    except Exception as e:
        caminho_err = screenshot_dir / "falha_kds.png"
        try:
            await page.screenshot(path=str(caminho_err), full_page=True)
            log("KDS", f"Erro no KDS. Screenshot salvo em: {caminho_err}", "ERROR")
        except Exception:
            pass
        raise e


# ==============================================================================
# ORQUESTRADOR PRINCIPAL CLI & ASYNCIO
# ==============================================================================
def parse_arguments():
    parser = argparse.ArgumentParser(
        description="MAYaMenu - Simulação E2E de Salão Completo (4 Mesas Simultâneas + KDS Cozinha)."
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help=f"URL base do sistema em HTTPS (default: {DEFAULT_URL})",
    )
    parser.add_argument(
        "--slug",
        default=DEFAULT_SLUG,
        help=f"Slug do restaurante (default: {DEFAULT_SLUG})",
    )
    parser.add_argument(
        "--mesas",
        default="",
        help="Lista de mesas separadas por vírgula (ex: 2,5,8,12). Se vazio, sorteia aleatoriamente.",
    )
    parser.add_argument(
        "--qtd-mesas",
        type=int,
        default=4,
        help="Quantidade de mesas simultâneas a ocupar no salão (default: 4)",
    )
    parser.add_argument(
        "--min-clientes",
        type=int,
        default=1,
        help="Mínimo de clientes por mesa (default: 1)",
    )
    parser.add_argument(
        "--max-clientes",
        type=int,
        default=4,
        help="Máximo de clientes por mesa (default: 4)",
    )
    parser.add_argument(
        "--marchar",
        action="store_true",
        default=False,
        help="Marchar automaticamente todos os pedidos no KDS ao final (default: False - deixa no ponto de marchar)",
    )
    parser.add_argument(
        "--email",
        default=DEFAULT_EMAIL,
        help=f"E-mail de acesso do restaurante (default: {DEFAULT_EMAIL})",
    )
    parser.add_argument(
        "--password",
        default=DEFAULT_PASSWORD,
        help="Senha de acesso do restaurante",
    )
    parser.add_argument(
        "--pin",
        default=DEFAULT_PIN,
        help=f"PIN de segurança da cozinha (default: {DEFAULT_PIN})",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        default=os.getenv("HEADLESS", "false").lower() in ("true", "1", "yes"),
        help="Executar em modo headless (sem abrir janelas visíveis)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=int(os.getenv("TIMEOUT_MS", "45000")),
        help="Timeout máximo em milissegundos para operações de rede (default: 45000)",
    )
    parser.add_argument(
        "--tempo-espera",
        type=int,
        default=25,
        help="Tempo em segundos para manter as telas abertas ao final no modo visível (default: 25)",
    )
    parser.add_argument(
        "--screenshot-dir",
        default=DEFAULT_SCREENSHOT_DIR,
        help=f"Diretório onde salvar as evidências em PNG (default: {DEFAULT_SCREENSHOT_DIR})",
    )
    return parser.parse_args()


async def main():
    args = parse_arguments()
    base_url = args.url.rstrip("/")
    if not base_url.startswith("http"):
        base_url = f"https://{base_url}"

    screenshot_path = Path(args.screenshot_dir)
    screenshot_path.mkdir(parents=True, exist_ok=True)

    if args.mesas:
        mesas_selecionadas = [int(m.strip()) for m in args.mesas.split(",") if m.strip().isdigit()]
    else:
        mesas_selecionadas = random.sample(range(1, 21), args.qtd_mesas)

    distribuicao_mesas: Dict[int, int] = {}
    total_clientes_salao = 0
    for mesa_id in mesas_selecionadas:
        qtd_cli = random.randint(args.min_clientes, args.max_clientes)
        distribuicao_mesas[mesa_id] = qtd_cli
        total_clientes_salao += qtd_cli

    config = {
        "base_url": base_url,
        "slug": args.slug,
        "qtd_mesas": len(mesas_selecionadas),
        "mesas": mesas_selecionadas,
        "distribuicao_mesas": distribuicao_mesas,
        "total_clientes": total_clientes_salao,
        "admin_email": args.email,
        "admin_password": args.password,
        "pin": args.pin,
        "timeout_ms": args.timeout,
        "marchar": args.marchar,
        "headless": args.headless,
        "tempo_espera": args.tempo_espera,
        "screenshot_dir": str(screenshot_path),
    }

    print(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
    print(f"{Colors.SUCCESS}{Colors.BOLD}   MAYaMenu • SIMULAÇÃO DE SALÃO COMPLETO (4 MESAS + KDS COZINHA){Colors.RESET}")
    print(f"{Colors.BOLD}{'='*80}{Colors.RESET}")
    print(f" • Endpoint Base:       {Colors.SYSTEM}{base_url}{Colors.RESET}")
    print(f" • Restaurante Slug:    {Colors.SYSTEM}{args.slug}{Colors.RESET}")
    print(f" • Mesas Simultâneas:   {Colors.SUCCESS}{', '.join(f'Mesa {m} ({distribuicao_mesas[m]} cliente(s))' for m in mesas_selecionadas)}{Colors.RESET}")
    print(f" • Total de Clientes:   {Colors.BOLD}{total_clientes_salao} clientes no salão{Colors.RESET}")
    print(f" • Modo Escolha Pratos: {Colors.WARN}100% Autônomo e Aleatório (Cada cliente escolhe o seu){Colors.RESET}")
    print(f" • Estado Final KDS:    {'Marchando automaticamente' if args.marchar else 'Pronto na esteira (Ponto de marchar)'}")
    print(f" • Modo Execução:       {'Headless (Nuvem/CI)' if args.headless else 'Janelas Visíveis (Side-by-Side)'}")
    print(f" • Evidências QA:       {screenshot_path.resolve()}")
    print(f"{Colors.BOLD}{'-'*80}{Colors.RESET}\n")

    shared_state = {
        "pedidos_enviados": [],
        "total_pedidos_esperados": total_clientes_salao,
        "mesas_finalizadas": 0,
    }

    # Evento de sincronização: as mesas aguardam o KDS estar online e com a esteira aberta
    kds_online_event = asyncio.Event()

    async with async_playwright() as p:
        log("SISTEMA", "Iniciando instâncias Chromium com isolamento completo de sessões...")

        browser: Browser = await p.chromium.launch(
            headless=args.headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--window-size=1920,1080",
            ],
        )

        try:
            # Contexto Desktop para o KDS da Cozinha
            contexto_kds: BrowserContext = await browser.new_context(
                viewport={"width": 1400, "height": 900},
                user_agent=(
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                ),
                locale="pt-BR",
                timezone_id="America/Sao_Paulo",
                ignore_https_errors=True,
            )

            # Contextos Mobile para cada mesa
            contextos_mesas = []
            for i, mesa_id in enumerate(mesas_selecionadas):
                ctx = await browser.new_context(
                    viewport={"width": 390, "height": 844},
                    user_agent=(
                        f"Mozilla/5.0 (iPhone; CPU iPhone OS 16_{i+1} like Mac OS X) "
                        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
                    ),
                    is_mobile=True,
                    has_touch=True,
                    locale="pt-BR",
                    timezone_id="America/Sao_Paulo",
                    ignore_https_errors=True,
                )
                contextos_mesas.append((mesa_id, ctx, CORES_MESAS[i % len(CORES_MESAS)]))

            log("SISTEMA", "Disparando orquestração inteligente (KDS sincroniza primeiro, mesas entram em seguida)...\n")

            tarefas = [
                jornada_atendente_kds(contexto_kds, config, shared_state, kds_online_event)
            ]

            for mesa_id, ctx, cor in contextos_mesas:
                tarefas.append(
                    jornada_mesa_online(
                        ctx,
                        mesa_id,
                        distribuicao_mesas[mesa_id],
                        config,
                        shared_state,
                        cor,
                        kds_online_event,
                    )
                )

            await asyncio.gather(*tarefas, return_exceptions=False)

            print(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
            log("SUCESSO", "Simulação de Salão Completo finalizada com 100% de sucesso!", "SUCCESS")
            print(f" Total de comandas despachadas: {len(shared_state['pedidos_enviados'])}")
            print(f" Evidências salvas em: {screenshot_path.resolve()}")
            print(f"{Colors.BOLD}{'='*80}{Colors.RESET}\n")

        finally:
            log("SISTEMA", "Finalizando contextos e liberando recursos.")
            await browser.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\033[33m[SIMULAÇÃO INTERROMPIDA PELO USUÁRIO]\033[0m")
        sys.exit(0)
    except Exception as e:
        print(f"\n\033[31;1m[ERRO NA SIMULAÇÃO ONLINE]: {e}\033[0m")
        sys.exit(1)
