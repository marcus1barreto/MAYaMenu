# Documento de Especificação Técnica e Planejamento - Versão Alpha
**Projeto:** MAYaMenu (Plataforma de Cardápio Digital e Pedidos)
**Organização:** MAYaRAnas Sistemas
**Estágio Atual:** Desenvolvimento Alpha (MVP)

## 1. Diretrizes Globais e Filosofia
*   **Lema:** "O menos é mais". Foco absoluto em simplicidade, usabilidade e eficiência.
*   **Resiliência (Offline-First):** O sistema prevê intermitência de rede. Pedidos em andamento e geração de comprovantes (QR Code) devem funcionar mesmo com quedas de internet.
*   **PWA Nativo (Sem instalação):** O acesso do cliente se dá via leitura de QR Code físico na mesa, que abre um Progressive Web App direto no navegador (Chrome/Safari). 
*   **Performance (Core Web Vitals):** Tempo de carregamento (TTFB) próximo a zero usando ISR do Next.js.

## 2. Stack Tecnológico
*   **Frontend & KDS (Painel):** Next.js (App Router), React, Tailwind CSS, shadcn/ui.
*   **Backend & Banco de Dados:** Firebase Blaze (Firestore com persistência offline, Authentication, Storage).
*   **Hospedagem:** Firebase App Hosting (suporte a SSR e ISR).
*   **Leitura/Geração de QR Code:** `qrcode.react` e `html5-qrcode` (ou similares leves).

## 3. Modelagem de Dados (Firestore - Esquema NoSQL)
Estrutura desenhada para evitar concorrência e facilitar o fechamento de contas fracionadas.

*   **Coleção:** `restaurants`
    *   `id` (string, PK - O uid do dono gerado no Firebase Auth)
    *   `name` (string)
    *   `slug` (string) - URL pública (ex: `/r/burguer-do-ze`)
    *   `theme` (objeto) - `primaryColor` (hex), `mode` (light/dark/auto), `logoUrl`, `coverUrl`.
    
    *   **Subcoleção:** `menus` (Itens do cardápio)
        *   `id` (string)
        *   `name`, `description`, `price` (number - preço único nesta fase), `category`, `imageUrl`, `available` (boolean).
        *   `modifiers` (array) - Ex: `[{ title: "Ponto da Carne", required: true, options: ["Ao ponto", "Bem passado"] }]`.
        
    *   **Subcoleção:** `tables` -> `open_orders` (Comandas por cliente na mesa)
        *   Caminho: `restaurants/{restId}/tables/{tableId}/open_orders/{customerId}`
        *   `customerId` é gerado após o cliente inserir o nome inicial.
        *   Esta estrutura evita conflitos (Race Condition) se várias pessoas na mesma mesa pedirem ao mesmo tempo, e facilita mostrar o subtotal individual na hora da conta.

## 4. Fluxos e Regras de Negócio (Aditivos Consolidados)

### 4.1. O "Ticket Digital" e Contingência Offline
*   Todo pedido finalizado pelo cliente gera um **QR Code (Ticket Digital)** na tela, independentemente de ter internet ou não.
*   O Payload do QR Code é um JSON enxuto: `{"id":"[ID_DO_PEDIDO]","t":12,"i":[{"id":"a1","q":2}]}`.
*   Se o cliente estiver sem internet, o pedido não é perdido. A UI mostra o QR Code e orienta: "Mostre ao garçom". O garçom escaneia com o app dele e injeta o pedido no Firebase.

### 4.2. Painel Administrativo (Onboarding Self-Service)
*   **Acesso:** O lojista cria a conta (Email/Senha ou Google) e o sistema já libera o painel e cria a estrutura no banco.
*   **Segurança:** Regras do Firestore rigorosas: `allow read, write: if request.auth.uid == restaurantId`.
*   **Imagem Padrão:** Se o lojista não subir imagem de capa, utilizar uma imagem de "mesa rústica desfocada" como padrão.

### 4.3. Interface de UX (Cliente)
*   **Tematização Minimalista:** O layout consome a `primaryColor` definida pelo lojista. O resto é branco/preto/cinza para garantir contraste.
*   **Regra dos 3 Passos:** Nome -> Adicionar Itens -> Confirmar. Sem cadastros complexos.
*   **Botões e Touch:** Componentes "Fat-finger friendly" (grandes e fáceis de tocar) baseados nas Leis de UX.

### 4.4. Operação (KDS e Garçom)
*   **Visão da Cozinha (KDS):** Tela simples dividida em "A Fazer" e "Pronto". Cartões grandes mostrando a Mesa, o Nome do Cliente, e destacando modificadores em VERMELHO. Botão único: "MARCHAR".
*   **Visão do Garçom:** Mapa visual das mesas. Mostra quem já pediu a conta (com o valor fracionado por pessoa já calculado pelo app, mas o pagamento em si é feito offline na maquininha física). Possui o botão para "Ler QR Code" (Contingência).

## 5. Instruções Iniciais de Codificação (Antigravity)
1.  Inicialize o projeto Next.js com Tailwind e adicione o `shadcn/ui`.
2.  Configure o Firebase Client SDK (Auth, Firestore com `enableIndexedDbPersistence`, Storage).
3.  Configure o `next-pwa` (manifesto e service workers).
4.  Crie as rotas públicas ISR (`/r/[slug]`) e as rotas protegidas do painel (`/admin`).
5.  Implemente o gerador de Payload/QR Code no checkout do cliente.

---

## 6. Roadmap & Implementações Futuras (Aditivo SuperAdmin e Monetização)

### 6.1. Gerência Geral do Sistema (SuperAdmin MAYaRAnas)
*   **Portal Exclusivo:** Interface separada da administração dos restaurantes (`/superadmin` ou `/gestao`).
*   **Gerador de Tokens / UIDs de Ativação:** O SuperAdmin gera chaves de concessão criptográficas ou alfanuméricas (ex: `MAYA-LIC-XXXX-YYYY`).
*   **Concessão de Estabelecimentos:** O novo restaurante só conclui o cadastro/onboarding se fornecer um Token de Licença válido concedido pela gerência.
*   **Gestão de Status da Concessão:** Ativo, Suspenso, Em Atraso ou Bloqueado, com interrupção instantânea do serviço via Firestore.

### 6.2. Camadas de Gratuidade (Modelo Freemium / Tiers)
*   **Plano Gratuito / Básico (Free Tier):**
    *   Limite máximo de pratos/itens ativos no cardápio (ex: até 15 ou 20 itens).
    *   Limite máximo de mesas simultâneas (ex: até 5 ou 10 mesas físicas).
    *   Relatórios e histórico resumidos.
*   **Planos Pagos (Pro / Enterprise):**
    *   Itens de cardápio ilimitados.
    *   Mesas ilimitadas e setores múltiplos (Salão, Varanda, Balcão, Delivery).
    *   Múltiplos terminais simultâneos para Garçom e Cozinha (KDS).
    *   Customização visual profunda e relatórios gerenciais avançados.

### 6.3. Isolamento da Demonstração (Sandbox /demo)
*   **Sandbox Dedicada (`/demo`):** Ambiente isolado com dados mockados contendo seletor para Cliente (Mesa 12), KDS da Cozinha e Terminal do Garçom.
*   **Fluxo Oficial Limpo:** As rotas oficiais (`/admin`, `/cozinha`, `/garcom`, `/r/[slug]`) operam exclusivamente com instâncias reais de restaurantes e comandas salvas no Firestore.
*   **Depreciação Futura:** Em release futura pré-lançamento comercial, a rota `/demo` será descontinuada e removida.