# Diretrizes Obrigatórias de UX, Design System e UI do MAYaMenu

Este documento estabelece as regras inegociáveis de Design e Experiência do Usuário (UX) para todo o ecossistema MAYaMenu (Landing Page, PWA do Cliente, Painel Administrativo, Garçom e KDS).

---

## 1. Tema Único Centralizado (Identidade iFood)
- **Cores Primárias**:
  - Vermelho Principal: `#EA1D2C` (`rose-600` / `primary`)
  - Fundo Padrão: Branco `#FFFFFF` com tons suaves de suporte (`neutral-50` / `neutral-100`).
  - Textos de Alto Contraste: `neutral-950` para títulos, `neutral-600` / `neutral-700` para corpos de texto.
- **Regra de Não-Regressão**:
  - É **expressamente proibido** reintroduzir seletores de temas, esquemas de cores customizados ou alternâncias de paleta (Dark/Light) nas telas de clientes e de gestão.
  - A rota `/admin/identidade-interna` é uma referência privada para o administrador e **nunca deve possuir links públicos** na navegação.
  - O único ambiente autorizado a utilizar fundo escuro é o **KDS de Cozinha** (`/cozinha`), projetado especificamente para telas e iluminação de cozinhas profissionais.

---

## 2. Tipografia e Escala Material 3 (M3)
- Seguir estritamente as camadas de importância do [Google Material Design 3](https://m3.material.io):
  - **Display / Headline**: Títulos de grande impacto visual, limpos e com quebras de linha controladas.
  - **Title**: Seções e nomes de produtos ou comandas, com peso negrito (`font-black` ou `font-bold`).
  - **Body**: Textos explicativos com entrelinha arejada (`leading-relaxed`), sem blocos densos ou poluídos.
  - **Label**: Metadados, tags de status e badges (ex: "Free Vitalício", "KDS Cozinha") em caixa alta (`uppercase`), tamanho reduzido (`text-[10px]` a `text-xs`) e espaçamento proporcional (`tracking-wider`).

---

## 3. Ergonomia Mobile e Telas Táteis (Mobile-First)
- **Áreas Mínimas de Toque**: Todos os botões, checkboxes, inputs e cartões clicáveis devem ter área de toque mínima de **44px x 44px**.
- **Contraste no Telemóvel**: Não usar cinzas claros demais para textos essenciais. Todo texto deve ser legível sob luz solar ou iluminação fraca de salão.
- **Feedback Háptico e Visual**: Todo clique em comanda, adição ao carrinho ou fechamento de conta deve ter feedback visual imediato (animação sutil `active:scale-95`, micro-shimmer ou toast).

---

## 4. Experiência do Onboarding & Cartão Digital
- O fluxo de entrada (Opção C) deve sempre manter o **Cartão de Concessão Digital** com sensação de credencial física tátil.
- O canal de suporte/envio de boas-vindas via WhatsApp deve manter os links essenciais (Acesso, Cardápio e Manual).
- O Manual e a Central de Ajuda (`/manual`) devem permanecer públicos e atualizados para dúvidas operacionais, garantias de estabilidade e conformidade com a LGPD.
