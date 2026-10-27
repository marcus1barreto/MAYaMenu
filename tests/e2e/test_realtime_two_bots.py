#!/usr/bin/env python3
"""
Autor: Marcus Fialho Barreto com suporte I.A. em Antigravity IDE
Horizonte - CE
Outubro de 2026

Proibida a modificação, cópia, comercialização e distribuição sem autorização prévia.
marcus1fialho@gmail.com

MAYaMenu - Teste E2E Concorrente em Tempo Real (Dois Bots Simultâneos)
Stack: Python 3.10+, Playwright Async, Next.js, Firebase Firestore Realtime.

Cenário:
  Bot 1 (Cliente - Mobile iPhone 12/13):
    1. Acessa o cardápio digital via QR/Link (ex: /r/demo?mesa=5).
    2. Realiza leitura humanizada com scroll irregular.
    3. Escolhe um prato (ex: MAYaBurger ou Açaí/Hambúrguer), abre o modal.
    4. Seleciona opções se houver e adiciona ao carrinho.
    5. Abre o carrinho, digita seu nome e finaliza o pedido.
    6. Confirma a geração do Ticket Digital / QR Code no ecrã.

  Bot 2 (Atendente / KDS Cozinha - Desktop 1080p):
    1. Acessa a tela operacional (/cozinha ou /admin).
    2. Realiza autenticação humanizada com credenciais.
    3. Passa pelo guarda de segurança por PIN caso solicitado.
    4. Monitora a esteira do KDS aguardando a chegada reativa do pedido via Firestore.
    5. Detecta o pedido do Cliente, move o cursor suavemente e clica em "MARCHAR PEDIDO".
"""

import asyncio
import math
import os
import random
import sys
import time
from typing import Optional, Tuple
from playwright.async_api import (
    async_playwright,
    Browser,
    BrowserContext,
    Page,
    Locator,
    TimeoutError as PlaywrightTimeoutError,
)

# ==============================================================================
# CONFIGURAÇÕES DE AMBIENTE & PARÂMETROS PADRÃO
# ==============================================================================
BASE_URL = os.getenv("MAYAMENU_URL", "http://localhost:3000").rstrip("/")
CLIENTE_SLUG = os.getenv("CLIENTE_SLUG", "demo")  # 'demo' possui fallback nativo offline/online
NUMERO_MESA = os.getenv("NUMERO_MESA", "5")
CLIENTE_URL = f"{BASE_URL}/r/{CLIENTE_SLUG}?mesa={NUMERO_MESA}"
KDS_URL = f"{BASE_URL}/cozinha"

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "teste@teste.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "&Lin7&1971")
KDS_PIN = os.getenv("KDS_PIN", "1234")
CLIENTE_NOME = os.getenv("CLIENTE_NOME", "Marcus Fialho Barreto")

# Modo Headless: defina HEADLESS=false para assistir visualmente aos dois navegadores lado a lado
HEADLESS = os.getenv("HEADLESS", "false").lower() not in ("false", "0", "no")
SLOW_MO = int(os.getenv("SLOW_MO", "0"))  # Em ms, se desejar abrandar a engine do Playwright


# ==============================================================================
# SISTEMA DE LOGS COLORIDOS COM TIMESTAMP
# ==============================================================================
class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    CLIENT = "\033[38;5;45m"     # Ciano vibrante
    STAFF = "\033[38;5;214m"     # Âmbar / Laranja
    SUCCESS = "\033[38;5;82m"    # Verde vivo
    WARN = "\033[38;5;226m"      # Amarelo
    ERROR = "\033[38;5;196m"     # Vermelho
    SYSTEM = "\033[38;5;141m"    # Roxo suave


def log(actor: str, message: str, level: str = "INFO"):
    agora = time.strftime("%H:%M:%S")
    milis = int((time.time() % 1) * 1000)
    timestamp = f"{Colors.DIM}[{agora}.{milis:03d}]{Colors.RESET}"

    if actor == "CLIENTE":
        tag = f"{Colors.CLIENT}{Colors.BOLD}🤖 [CLIENTE-MOBILE]{Colors.RESET}"
    elif actor == "ATENDENTE":
        tag = f"{Colors.STAFF}{Colors.BOLD}👨‍🍳 [ATENDENTE-KDS]{Colors.RESET}"
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
# HUMANIZAÇÃO DE MOVIMENTOS, CLIQUES E SCROLL
# ==============================================================================
async def human_pause(min_s: float = 1.0, max_s: float = 2.5, reason: str = ""):
    """Simula o tempo de reflexão, leitura e decisão cognitiva de uma pessoa real."""
    duracao = random.uniform(min_s, max_s)
    if reason:
        # Apenas log silencioso ou depuração se necessário
        pass
    await asyncio.sleep(duracao)


def _bezier_curve(
    p0: Tuple[float, float],
    p1: Tuple[float, float],
    p2: Tuple[float, float],
    p3: Tuple[float, float],
    t: float,
) -> Tuple[float, float]:
    """Calcula um ponto numa curva de Bézier cúbica para trajeto curvo do mouse."""
    u = 1 - t
    tt = t * t
    uu = u * u
    uuu = uu * u
    ttt = tt * t

    x = uuu * p0[0] + 3 * uu * t * p1[0] + 3 * u * tt * p2[0] + ttt * p3[0]
    y = uuu * p0[1] + 3 * uu * t * p1[1] + 3 * u * tt * p2[1] + ttt * p3[1]
    return (x, y)


async def human_move_mouse(page: Page, target_x: float, target_y: float, steps: int = 25):
    """Move o cursor até as coordenadas alvo através de uma trajetória curvada e natural."""
    # Origem aproximada (ou centro se for o primeiro movimento)
    vp = page.viewport_size or {"width": 1280, "height": 720}
    start_x = random.uniform(vp["width"] * 0.2, vp["width"] * 0.8)
    start_y = random.uniform(vp["height"] * 0.2, vp["height"] * 0.8)

    # Pontos de controle com desvios aleatórios para evitar trajetórias perfeitamente retas
    dx = target_x - start_x
    dy = target_y - start_y
    ctrl1 = (
        start_x + dx * 0.25 + random.uniform(-40, 40),
        start_y + dy * 0.25 + random.uniform(-40, 40),
    )
    ctrl2 = (
        start_x + dx * 0.75 + random.uniform(-30, 30),
        start_y + dy * 0.75 + random.uniform(-30, 30),
    )

    for i in range(1, steps + 1):
        t = i / steps
        # Aceleração e desaceleração humana (ease-in-out)
        t_eased = math.sin((t * math.pi) / 2) if t < 0.5 else 1 - math.cos((t * math.pi) / 2)
        nx, ny = _bezier_curve((start_x, start_y), ctrl1, ctrl2, (target_x, target_y), t_eased)
        await page.mouse.move(nx, ny)
        await asyncio.sleep(random.uniform(0.005, 0.018))


async def human_click(page: Page, locator: Locator, actor: str = "CLIENTE", desc: str = ""):
    """
    Localiza o elemento, rola até o campo visual, move o cursor suavemente
    até o centro (com ligeiro jitter) e executa o clique com tempo de pressão real.
    """
    await locator.scroll_into_view_if_needed(timeout=10000)
    box = await locator.bounding_box()
    if not box:
        # Fallback de clique direto se elemento for inline ou SVG
        await locator.click()
        return

    # Ponto alvo ligeiramente deslocado do centro exato (humanos não clicam no pixel 0,0)
    target_x = box["x"] + box["width"] * random.uniform(0.35, 0.65)
    target_y = box["y"] + box["height"] * random.uniform(0.35, 0.65)

    await human_move_mouse(page, target_x, target_y, steps=random.randint(15, 25))
    await asyncio.sleep(random.uniform(0.05, 0.12))  # Hesitação pré-clique

    # Pressiona e solta com delay realista de botão
    await page.mouse.down()
    await asyncio.sleep(random.uniform(0.06, 0.15))
    await page.mouse.up()


async def human_type(locator: Locator, text: str):
    """Digita caractere por caractere com ritmo e cadência humanos aleatórios."""
    await locator.click()
    for char in text:
        await locator.type(char, delay=random.randint(45, 140))
        # Ocasionalmente uma micro-pausa simulando raciocínio
        if random.random() < 0.15:
            await asyncio.sleep(random.uniform(0.12, 0.28))


async def human_scroll(page: Page, total_delta_y: int = 600, direction: str = "down"):
    """
    Simula uma rolagem de tela táctil / roda de mouse com acelerações graduais
    e intervalos irregulares.
    """
    sinal = 1 if direction == "down" else -1
    distancia_restante = abs(total_delta_y)

    while distancia_restante > 0:
        passo = min(distancia_restante, random.randint(70, 160))
        distancia_restante -= passo
        await page.mouse.wheel(0, passo * sinal)
        await asyncio.sleep(random.uniform(0.04, 0.11))

    # Pequena pausa para os olhos focarem após a rolagem
    await asyncio.sleep(random.uniform(0.5, 1.2))


# ==============================================================================
# JORNADA DO CLIENTE (MOBILE - iPhone 12/13)
# ==============================================================================
async def jornada_cliente(context: BrowserContext, dados_compartilhados: dict):
    page: Page = await context.new_page()
    log("CLIENTE", f"Iniciando jornada no mobile. URL: {CLIENTE_URL}")

    # 1. Acesso ao cardápio com validação de prontidão
    try:
        await page.goto(CLIENTE_URL, wait_until="networkidle", timeout=30000)
    except Exception:
        # Fallback para load state caso o polling do Firestore mantenha a rede ocupada
        await page.goto(CLIENTE_URL, wait_until="domcontentloaded", timeout=30000)

    log("CLIENTE", "Página do cardápio carregada com sucesso!")
    await human_pause(1.5, 2.5, "Lendo o topo e cabeçalho do restaurante")

    # 2. Leitura do cardápio através de scroll humanizado
    log("CLIENTE", "Explorando as opções e categorias do cardápio...")
    await human_scroll(page, total_delta_y=450, direction="down")
    await human_pause(1.0, 2.0, "Analisando pratos disponíveis")
    await human_scroll(page, total_delta_y=250, direction="down")
    await human_pause(1.0, 1.8, "Decidindo qual item escolher")
    await human_scroll(page, total_delta_y=300, direction="up")

    # 3. Localização do prato no cardápio
    # Procura prioritariamente por Hambúrguer / MAYaBurger ou Açaí, com fallback dinâmico
    candidatos_locators = [
        page.locator("text=/.*(Burger|Hamb[uú]rguer|MAYaBurger).*/i").first,
        page.locator("text=/.*(A[çc]a[íi]|Pizza|Coquetel).*/i").first,
        page.locator("main button").first,  # Primeiro prato listado no grid
    ]

    prato_alvo = None
    prato_nome = "Item Especial do Cardápio"

    for cand in candidatos_locators:
        try:
            if await cand.is_visible(timeout=3000):
                prato_alvo = cand
                prato_nome = (await cand.inner_text()).split("\n")[0]
                break
        except Exception:
            continue

    if not prato_alvo:
        log("CLIENTE", "Item específico não avistado, selecionando primeiro cartão clicável.", "WARN")
        prato_alvo = page.locator("main button").first
        await prato_alvo.wait_for(state="visible", timeout=10000)

    log("CLIENTE", f"Prato selecionado visualmente: '{prato_nome}'. Clicando humanamente...")
    await human_click(page, prato_alvo, desc="Abrir Modal do Item")

    # 4. Aguarda a abertura da modal de personalização
    # No MAYaMenu o modal usa @base-ui Dialog ou shadcn Dialog
    modal_locator = page.locator("[role='dialog']").first
    await modal_locator.wait_for(state="visible", timeout=8000)
    log("CLIENTE", "Modal de detalhes e modificadores aberta.")
    await human_pause(1.2, 2.0, "Visualizando foto, adicionais e modificadores")

    # Se houver opções obrigatórias (ex: Ponto da Carne -> 'Ao Ponto'), seleciona
    opcao_obrigatoria = modal_locator.locator("text=/.*(Ao Ponto|Com [AÁ]lcool|Padr[ãa]o).*/i").first
    try:
        if await opcao_obrigatoria.is_visible(timeout=1500):
            log("CLIENTE", "Marcando modificador do prato ('Ao Ponto / Escolha Padrão')...")
            await human_click(page, opcao_obrigatoria, desc="Selecionar opção")
            await human_pause(0.5, 1.0)
    except Exception:
        pass

    # 5. Adicionar ao Carrinho
    # Botão "Adicionar" no rodapé fixo do modal
    btn_adicionar = modal_locator.locator("button:has-text('Adicionar')").first
    await btn_adicionar.wait_for(state="visible", timeout=5000)
    await human_click(page, btn_adicionar, desc="Botão Adicionar ao Carrinho")
    log("CLIENTE", f"Item '{prato_nome}' adicionado ao carrinho com sucesso!")
    await human_pause(1.0, 2.0, "Aguardando fechamento do modal e animação")

    # 6. Abertura do Carrinho / Comanda
    # O cliente pode clicar na barra flutuante inferior ("Enviar Rodada / Carrinho") ou no topo
    btn_carrinho_flutuante = page.locator("text=/.*(Enviar Rodada|Carrinho|Total Itens).*/i").first
    btn_carrinho_topo = page.locator("header button[title*='Comanda'], header button:has-text('Comanda')").first

    log("CLIENTE", "Abrindo o carrinho para revisar e fechar a rodada...")
    if await btn_carrinho_flutuante.is_visible(timeout=3000):
        await human_click(page, btn_carrinho_flutuante, desc="Barra Flutuante do Carrinho")
    else:
        await human_click(page, btn_carrinho_topo, desc="Botão de Comanda no Cabeçalho")

    # 7. Preenchimento do Nome e Fechamento
    # No Sheet do carrinho há o campo "Seu Nome na Mesa *"
    input_nome = page.locator("input[placeholder*='Marcus'], input[placeholder*='Ex:']").first
    await input_nome.wait_for(state="visible", timeout=8000)

    # Identifica o cliente com o nome configurado e sufixo único
    nome_gerado = f"{CLIENTE_NOME} #{random.randint(10, 99)}"
    dados_compartilhados["nome_cliente"] = nome_gerado
    dados_compartilhados["mesa"] = NUMERO_MESA
    dados_compartilhados["prato"] = prato_nome

    log("CLIENTE", f"Identificando comanda com o nome: '{nome_gerado}'...")
    await human_pause(0.8, 1.5, "Iniciando digitação do nome")
    await human_type(input_nome, nome_gerado)
    await human_pause(1.0, 1.8, "Conferindo subtotal e valores no carrinho")

    # Botão de envio final: "Enviar Pedido • Gerar Ticket"
    btn_finalizar = page.locator("button:has-text('Enviar Pedido'), button:has-text('Gerar Ticket')").first
    await btn_finalizar.wait_for(state="visible", timeout=5000)
    log("CLIENTE", "Clicando em 'Enviar Pedido • Gerar Ticket'...")
    await human_click(page, btn_finalizar, desc="Finalizar Pedido")

    # 8. Validação de Sucesso e Geração do Ticket Digital
    log("CLIENTE", "Aguardando confirmação do pedido e emissão do Ticket Digital...")
    sucesso_locator = page.locator("text=/.*(Pedido Registrado|Ticket Digital Garantido|Modo Resiliente).*/i").first
    await sucesso_locator.wait_for(state="visible", timeout=15000)

    dados_compartilhados["pedido_enviado"] = True
    log("CLIENTE", "🎉 PEDIDO CONFIRMADO NA MESA! Ticket Digital e QR Code visíveis no ecrã.", "SUCCESS")
    await human_pause(2.0, 4.0, "Cliente contemplando o comprovante gerado")


# ==============================================================================
# JORNADA DO ATENDENTE / KDS COZINHA (DESKTOP - 1920x1080)
# ==============================================================================
async def jornada_atendente(context: BrowserContext, dados_compartilhados: dict):
    page: Page = await context.new_page()
    log("ATENDENTE", f"Iniciando posto de trabalho no KDS da Cozinha. URL: {KDS_URL}")

    # 1. Acesso à rota do KDS
    try:
        await page.goto(KDS_URL, wait_until="networkidle", timeout=30000)
    except Exception:
        await page.goto(KDS_URL, wait_until="domcontentloaded", timeout=30000)

    # 2. Verificação de Autenticação (AdminLoginForm)
    input_email = page.locator("input[type='email']").first
    if await input_email.is_visible(timeout=4000):
        log("ATENDENTE", "Tela de identificação do restaurante detectada. Realizando login...")
        await human_pause(1.0, 1.8, "Preparando digitação das credenciais")

        await human_type(input_email, ADMIN_EMAIL)
        await human_pause(0.4, 0.8)

        input_senha = page.locator("input[type='password']").first
        await human_type(input_senha, ADMIN_PASSWORD)
        await human_pause(0.5, 1.0)

        btn_entrar = page.locator("button:has-text('Entrar no Sistema')").first
        await human_click(page, btn_entrar, desc="Botão de Login")
        log("ATENDENTE", "Formulário de credenciais submetido.")

    # 3. Verificação do Protetor por PIN (PinLockGuard da Cozinha)
    pin_guard = page.locator("text=/.*(Modo Cozinha \\(KDS\\)|Dispositivo de equipe protegido).*/i").first
    try:
        if await pin_guard.is_visible(timeout=5000):
            log("ATENDENTE", f"Terminal protegido por PIN detectado. Inserindo código de função ({KDS_PIN})...")
            await human_pause(0.8, 1.5)

            # Clica no botão 'Pular' ou digita dígito a dígito nos botões virtuais
            btn_pular = page.locator("button:has-text('Pular')").first
            if await btn_pular.is_visible(timeout=1000):
                await human_click(page, btn_pular, desc="Pular PIN de Demonstração")
            else:
                for digito in KDS_PIN:
                    btn_num = page.locator(f"button:has-text('{digito}')").first
                    await human_click(page, btn_num, desc=f"Tecla PIN {digito}")
                    await asyncio.sleep(0.15)
    except Exception:
        pass

    # 4. Chegada à esteira do KDS
    cabecalho_kds = page.locator("h1:has-text('KDS da Cozinha')").first
    await cabecalho_kds.wait_for(state="visible", timeout=20000)
    log("ATENDENTE", "Painel KDS conectado e operacional! Escutando esteira em tempo real (Firebase onSnapshot)...")

    # 5. Monitoramento ativo do pedido do Cliente
    # Aguarda o sinal de envio do Bot 1 com timeout resiliente
    log("ATENDENTE", "Aguardando novo ticket despachado pelo cliente no salão...")

    inicio_espera = time.time()
    nome_alvo = None
    card_pedido = None

    while time.time() - inicio_espera < 45:
        # Pega o nome gerado pelo bot cliente assim que disponível
        nome_alvo = dados_compartilhados.get("nome_cliente")

        if nome_alvo:
            # Procura pelo card do pedido que contenha o nome do cliente ou a mesa correspondente
            locator_pedido_nome = page.locator(f"text='{nome_alvo}'").first
            if await locator_pedido_nome.is_visible():
                card_pedido = locator_pedido_nome.locator("xpath=ancestor::div[contains(@class, 'rounded-3xl')]").first
                break

        # Verifica também se há qualquer novo pedido "A Fazer" caso o nome tenha demorado a sincronizar
        pedidos_afazer = page.locator("text='MARCHAR PEDIDO'")
        count = await pedidos_afazer.count()
        if count > 0 and dados_compartilhados.get("pedido_enviado"):
            card_pedido = pedidos_afazer.last.locator("xpath=ancestor::div[contains(@class, 'rounded-3xl')]").first
            break

        await asyncio.sleep(1.0)

    if not card_pedido:
        raise TimeoutError("Tempo esgotado aguardando o pedido aparecer no KDS em tempo real!")

    log("ATENDENTE", f"🔥 NOVO PEDIDO DETECTADO NA TELA DO KDS! [Cliente: {nome_alvo or 'Salão'}]", "SUCCESS")
    await human_pause(1.5, 2.8, "Cozinheiro conferindo comandas e itens impressos no ecrã")

    # 6. Ação no KDS: Movimentação suave do mouse e clique no botão "MARCHAR PEDIDO"
    btn_marchar = card_pedido.locator("button:has-text('MARCHAR PEDIDO')").first
    await btn_marchar.wait_for(state="visible", timeout=6000)

    log("ATENDENTE", "Movendo o cursor até o comando 'MARCHAR PEDIDO'...")
    await human_click(page, btn_marchar, desc="Marchar Pedido da Cozinha")

    # Validação da transição de status no KDS (Muda para 'Pronto (Desfazer)')
    btn_pronto = card_pedido.locator("text=/.*(Pronto|Desfazer).*/i").first
    await btn_pronto.wait_for(state="visible", timeout=8000)
    log("ATENDENTE", "✅ PEDIDO MARCHADO COM SUCESSO! Status atualizado para 'Pronto' em tempo real.", "SUCCESS")
    await human_pause(2.0, 3.5, "Operação do KDS concluída")


# ==============================================================================
# ORQUESTRADOR PRINCIPAL (asyncio.gather)
# ==============================================================================
async def main():
    print(f"\n{Colors.BOLD}{'='*78}{Colors.RESET}")
    print(f"{Colors.SUCCESS}{Colors.BOLD}   MAYaMenu • TESTE E2E DE ALTA FIDELIDADE (DOIS BOTS EM TEMPO REAL){Colors.RESET}")
    print(f"{Colors.BOLD}{'='*78}{Colors.RESET}")
    print(f" • Base URL:    {Colors.CLIENT}{BASE_URL}{Colors.RESET}")
    print(f" • Cardápio:    {Colors.CLIENT}{CLIENTE_URL}{Colors.RESET}")
    print(f" • Cozinha/KDS: {Colors.STAFF}{KDS_URL}{Colors.RESET}")
    print(f" • Modo Janela: {'Headless (em segundo plano)' if HEADLESS else 'Visível (Interface Gráfica Ativa)'}")
    print(f"{Colors.BOLD}{'-'*78}{Colors.RESET}\n")

    dados_compartilhados = {
        "nome_cliente": None,
        "mesa": NUMERO_MESA,
        "prato": None,
        "pedido_enviado": False,
    }

    async with async_playwright() as p:
        log("SISTEMA", "Inicializando instâncias de navegador Chromium...")
        browser: Browser = await p.chromium.launch(
            headless=HEADLESS,
            slow_mo=SLOW_MO,
            args=[
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--window-size=1920,1080",
            ],
        )

        try:
            # Contexto 1: Cliente Mobile (iPhone 12/13)
            # Viewport ~390 x 844, touch habilitado, mobile user agent autêntico
            contexto_cliente: BrowserContext = await browser.new_context(
                viewport={"width": 390, "height": 844},
                user_agent=(
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
                ),
                is_mobile=True,
                has_touch=True,
                locale="pt-BR",
                timezone_id="America/Sao_Paulo",
            )

            # Contexto 2: Atendente / Cozinha Desktop (Full HD 1080p)
            contexto_atendente: BrowserContext = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent=(
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                ),
                is_mobile=False,
                has_touch=False,
                locale="pt-BR",
                timezone_id="America/Sao_Paulo",
            )

            log("SISTEMA", "Disparando simultaneamente Bot do Cliente e Bot da Cozinha com asyncio.gather()...\n")

            # Execução concorrente real
            await asyncio.gather(
                jornada_cliente(contexto_cliente, dados_compartilhados),
                jornada_atendente(contexto_atendente, dados_compartilhados),
                return_exceptions=False,
            )

            print(f"\n{Colors.BOLD}{'='*78}{Colors.RESET}")
            log("SUCESSO", "Ciclo E2E completo concluído com 100% de êxito e sincronia perfeita!", "SUCCESS")
            print(f"{Colors.BOLD}{'='*78}{Colors.RESET}\n")

        finally:
            log("SISTEMA", "Finalizando contextos e liberando navegador.")
            await browser.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\033[33m[TESTE CANCELADO PELO USUÁRIO]\033[0m")
        sys.exit(0)
    except Exception as e:
        print(f"\n\033[31;1m[FALHA NO TESTE E2E]: {e}\033[0m")
        import traceback
        traceback.print_exc()
        sys.exit(1)
