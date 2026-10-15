# Análise dos Atores e Plano de Ajustes — MAYaMenu Alpha

**Data da análise:** 14/10/2026
**Documento base (pétreo, não alterado):** [especificacao-tecnica-alpha.md](./especificacao-tecnica-alpha.md)
**Natureza deste documento:** complemento vivo. Registra o estado real do código, as lacunas encontradas e as decisões de rumo. Quando houver conflito entre este documento e a especificação, a divergência deve ser discutida e decidida explicitamente (ver seção 6).

> Metodologia: a análise foi feita lendo o código-fonte. Os quatro atores ainda não foram exercitados juntos em execução.

---

## 1. Estado atual (o que está pronto e verificado)

| Item | Estado | Observação |
|---|---|---|
| Hospedagem (Firebase App Hosting) | No ar | CI/CD por push na branch `main` do GitHub (`marcus1barreto/MAYaMenu`). |
| Variáveis de ambiente | Configuradas | `apphosting.yaml` e `.env.local`. |
| Firestore (`mayamenu-bd`) | Ativo | Banco nomeado, não o `(default)`. Id configurado em `src/lib/firebase.ts`. |
| Gravação e leitura no Firestore | **Testado** | Cliente anônimo cria e lê a própria comanda. Tentativa de apagar retorna `PERMISSION_DENIED`, como previsto. |
| Authentication | Ativo | E-mail/senha e anônimo (com limpeza automática de 30 dias). |
| Storage | Ativo | Regras em `storage.rules` (leitura pública, escrita autenticada). |
| Persistência offline | Ativa | Firestore com cache IndexedDB multi-aba; timeouts de 3 s (auth) e 4 s (gravação) com fallback para o Ticket QR. |
| Memória local do cliente | Implementada | `src/lib/historico-cliente.ts` (comprovantes em `localStorage`, até 20 visitas, nome lembrado). Botão "Meus Comprovantes" no cardápio. |
| Modal operacional da mesa | Implementado | `mesa-detalhe-modal.tsx`: comandas por pessoa, rateio, lançamento manual, QR da mesa. |

---

## 2. Achados da análise

### A. Os atores não estão conectados entre si (crítico)
- Não há nenhum `onSnapshot` no projeto. Só o Cliente grava no Firestore de verdade.
- Cozinha, Garçom e Admin trabalham sobre dados fictícios em estado local:
  - KDS: `PEDIDOS_INICIAIS_KDS` (`kds-view.tsx`).
  - Garçom: `MESAS_INICIAIS` (`garcom-view.tsx`).
  - Admin: segunda cópia independente do estado das mesas (`admin-dashboard.tsx`).
- Consequências: o pedido do cliente não chega à cozinha nem ao garçom; um item lançado no Admin não aparece no Garçom nem no KDS.
- O cardápio vem de `CARDAPIO_DEMO`. O switch "esgotado" do Admin não afeta o que o cliente vê.
- O `slug` da URL é ignorado: qualquer slug exibe o restaurante demo.

### B. Não existe identidade por papel (alto)
- `/admin`, `/cozinha` e `/garcom` usam o mesmo teste de acesso (`!user || user.isAnonymous`).
- As regras do Firestore só conhecem dois perfis: dono (`ownerId`) e cliente anônimo.
- Para usar o KDS, a equipe precisaria do login do dono, com acesso a cardápio e configurações.

### C. Sobreposição entre Admin e Garçom (médio)
- A aba Mesas do Admin reproduz a operação do Garçom (mesmo modal, cobrar, liberar, lançar item).
- O modal fica em `components/admin/` mas é usado pelo Garçom; o Admin importa tipos e dados do Garçom. Os limites entre módulos estão borrados.

### D. O modelo de dados não comporta a cozinha (alto)
- A comanda tem um único `status` (`pedindo`, `aguardando_pratos`, `conta_pedida`, `pago`), que é o ciclo de vida do **cliente na mesa**.
- O KDS precisa de um estado de **preparo** (`a_fazer`, `pronto`), por pedido ou por item. São conceitos distintos e não cabem no mesmo campo.
- O envio atual usa `setDoc(..., { merge: true })` na comanda. No Firestore, `merge` **substitui arrays inteiros**, então um segundo pedido do mesmo cliente apagaria o primeiro. É necessário modelar rodadas de pedido.

### E. Inconsistência de identificador do restaurante (alto)
- O Cliente grava em `restaurantes/rest-demo-alpha`, que não existe como documento.
- O Auth cria o restaurante do dono com `id = uid`.
- Pela regra `isOwner`, nenhum dono real conseguiria ler comandas gravadas no id demo. O teste de gravação passou porque exercitou só o lado do cliente.

### F. A verificar (não confirmado no código)
- Se a interface do cliente aciona o estado `conta_pedida` (pedir a conta). O estado existe nas regras e no mock do Garçom.

---

## 3. Divergências entre a especificação e o código

| Tema | Especificação | Código atual | Ação sugerida |
|---|---|---|---|
| Nomes das coleções | `restaurants`, `menus`, `tables/{id}/open_orders` | `restaurantes`, `cardapio`, `mesas/{id}/comandas_abertas` | Manter os nomes do código (já em regras e testes) e registrar a equivalência aqui. |
| Id do restaurante | uid do dono | Cliente usa `rest-demo-alpha`; Auth usa uid | Unificar (achado E). |
| Segurança do painel | `request.auth.uid == restaurantId` | `ownerId` + `isOwner()` | Evoluir para papéis (achado B). |
| Garçom injeta pedido do QR | Prevista | Existe o scanner, mas grava só em estado local | Gravar no Firestore (Fase 2). |
| Persistência offline | `enableIndexedDbPersistence` | `persistentLocalCache` (API atual do SDK) | Equivalente; nenhuma ação. |

---

## 4. Contrato proposto por ator

| Ator | Lê | Escreve | Não pode |
|---|---|---|---|
| **Cliente** | Cardápio, a própria comanda | Pedidos, pedido de conta | Ver outras comandas, alterar status |
| **Cozinha** | Pedidos pendentes de todas as mesas | Status de preparo | Ver valores, cobrar, editar cardápio |
| **Garçom** | Mesas, comandas, status dos pratos | Lançar item, cobrar, liberar mesa | Editar cardápio e configurações |
| **Admin** | Tudo | Cardápio, equipe, configurações, QR; pode atuar como garçom | — |

Fronteira entre Admin e Garçom (proposta): o Admin **monitora** mesas e imprime QR; a **operação** da mesa fica no Garçom.

---

## 5. Decisões do Responsável pelo Produto (Oficiais)

| # | Decisão | Deliberação Oficial | Status |
|---|---|---|---|
| 1 | Identidade da equipe | Modelo enxuto: Lojista autentica (`ownerId`). PIN numérico por função nos tablets compartilhados (`cozinha`, `garcom`), mantendo controle do `dono`. | **Aprovada** |
| 2 | Aba Mesas do Admin | Admin exclusivamente para monitoramento de status, gestão de cardápio e QR Codes físicos. Operação de salão centralizada em `/garcom`. Componentes neutros movidos para `components/salao/`. | **Aprovada** |
| 3 | Modelo de pedido e rodadas | Subcoleção `pedidos` sob comanda do cliente: `/mesas/{id}/comandas_abertas/{clienteId}/pedidos/{pedidoId}` com status `a_fazer` \| `pronto` \| `entregue`. Comanda pai mantém status de sessão (`pedindo` \| `aguardando_pratos` \| `conta_pedida` \| `pago`) e subtotal acumulado via `increment`. | **Aprovada** |

---

## 6. Plano de ajustes (status de execução)

**Fase 1 — Fundação de dados [CONCLUÍDA]**
1. ✅ **Unificar o identificador do restaurante:** Resolução dinâmica pelo slug (`/r/[slug]`) via serviço `src/lib/restaurante-service.ts`, com fallback resiliente offline para o demo.
2. ✅ **Atualizar Tipagens (`src/types/index.ts`):** Criados `ItemPedido`, `PedidoRodada` e refatorada a `ComandaCliente` como sessão agregadora.
3. ✅ **Atualizar `firestore.rules`:** Regras para a subcoleção `/pedidos/{pedidoId}` com permissão de criação pelo cliente e gestão de preparo pela equipe/dono.
4. ✅ **Gravação em Rodadas:** `CartDrawer` refatorado para persistir em `pedidos/{pedidoId}` somando ao pai via `increment(subtotal)` e `aguardando_pratos`, eliminando sobrescrita de arrays no Firestore.
5. ✅ **Ação "Pedir a Conta" do Cliente:** Botão e feedback visual em `MenuView` com atualização do status para `conta_pedida`.
6. ✅ **Isolamento de Salão:** Modal de mesa movido para `src/components/salao/mesa-detalhe-modal.tsx`.
7. ✅ **Validação de Build:** `next build` concluído com sucesso com Turbopack e Serwist PWA.

**Fase 2 — Conectar os atores [CONCLUÍDA]**
8. ✅ **Cardápio em Tempo Real:** Cliente ([`MenuView`](file:///media/mbarreto/geral_ext4/mayaranas/mayamenu/src/components/cliente/menu-view.tsx)) e Admin ([`AdminDashboard`](file:///media/mbarreto/geral_ext4/mayaranas/mayamenu/src/components/admin/admin-dashboard.tsx)) sincronizados via `escutarCardapio`. Quando o admin pausa um prato esgotado, ele se reflete instantaneamente para os clientes no cardápio digital.
9. ✅ **KDS da Cozinha Conectado:** [`KdsView`](file:///media/mbarreto/geral_ext4/mayaranas/mayamenu/src/components/admin/kds-view.tsx) escutando a subcoleção de pedidos/rodadas (`collectionGroup("pedidos")`) filtrada pelo restaurante. Ação "MARCHAR PEDIDO" atualiza o Firestore em tempo real.
10. ✅ **Garçom Conectado & Injeção de Contingência:** [`GarcomView`](file:///media/mbarreto/geral_ext4/mayaranas/mayamenu/src/components/garcom/garcom-view.tsx) escutando `comandas_abertas` de todas as mesas. Botão de fechar conta atualiza a comanda para `pago`, e a leitura do QR de contingência injeta o pedido diretamente no Firestore disparando no KDS da cozinha.
11. ✅ **Admin em Modo Monitoramento:** [`MesaDetalheModal`](file:///media/mbarreto/geral_ext4/mayaranas/mayamenu/src/components/salao/mesa-detalhe-modal.tsx) configurado com `modoSomenteLeitura={true}` no painel do lojista, restringindo ações operacionais ao `/garcom`.
12. ✅ **Trava por PIN de Função:** Implementado [`PinLockGuard`](file:///media/mbarreto/geral_ext4/mayaranas/mayamenu/src/components/salao/pin-lock-guard.tsx) para travar os tablets compartilhados nos modos `cozinha` (PIN 1234) e `garcom` (PIN 4321).
13. ✅ **Validação de Build:** `npm run build` executado e aprovado com código 0 com Serwist PWA e Turbopack.

**Fase 3 — Refinamento por ator [CONCLUÍDA]**
14. ✅ **Cliente (PWA):**
    - Adicionado campo opcional `categoria` nos tipos e itens do cardápio.
    - Implementadas pílulas deslizantes horizontais para filtragem rápida de categorias ("Todos", "Hambúrgueres", "Pizzas", "Bebidas", "Sobremesas") e busca por texto com resposta instantânea e feedback tátil em [`MenuView`](file:///media/mbarreto/geral_ext4/mayaranas/mayamenu/src/components/cliente/menu-view.tsx).
15. ✅ **Admin (Gestão de Cardápio):**
    - CRUD completo implementado em [`restaurante-service.ts`](file:///media/mbarreto/geral_ext4/mayaranas/mayamenu/src/lib/restaurante-service.ts) e integrado no [`AdminDashboard`](file:///media/mbarreto/geral_ext4/mayaranas/mayamenu/src/components/admin/admin-dashboard.tsx).
    - Botão "Adicionar Prato", modal Dialog com campos de nome, categoria, preço, descrição e foto, edição de itens existentes e exclusão com confirmação.
    - Sincronização em tempo real de itens adicionados/editados/pausados diretamente no Firestore.
16. ✅ **Cozinha (KDS) & Garçom:**
    - Visual ergonômico, cartões destacados para comandos táteis rápidos ("MARCHAR PEDIDO" de 56px de altura).
    - Destaque em vermelho nas personalizações e modificadores conforme especificação técnica.
    - Mapa de mesas com badges de status de conta pedida com indicação visual pulsante.
17. ✅ **Validação de Build:** `npm run build` executado e aprovado com sucesso via Turbopack e Serwist PWA.

---

## 7. Desconexão do cliente e memória local (regras acordadas)

- **Quando desconectar:** Ao ser marcada como `pago` ou ao liberar a mesa. Timeout oficial de inatividade definido em **4 horas** (`SESSAO_MESA_TIMEOUT_MS`).
- **Ao desconectar:** Encerrar os listeners do Firestore e marcar comprovante em `localStorage` como `concluido`.
- **Memória local:** `src/lib/historico-cliente.ts` registra as visitas locais com hash de autenticação legível, dados do restaurante e mesa. Helper `marcarVisitaAtualComoPaga` preparado para a Fase 2 ao escutar o evento `pago`.
