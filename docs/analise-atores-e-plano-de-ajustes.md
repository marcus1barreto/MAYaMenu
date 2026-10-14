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

## 5. Decisões pendentes (aguardam o responsável pelo produto)

| # | Decisão | Proposta | Status |
|---|---|---|---|
| 1 | Identidade da equipe | Papéis `dono`, `garcom`, `cozinha`. Opção de PIN por função para tablets compartilhados. | **Pendente** |
| 2 | Aba Mesas do Admin | Somente monitoramento e impressão de QR. | **Pendente** |
| 3 | Modelo de pedido | Subcoleção `pedidos` por comanda (uma rodada por documento, com status de preparo próprio). Altera modelo e regras. | **Pendente** |

Qualquer uma destas propostas pode ser contestada antes de implementar.

---

## 6. Plano de ajustes (ordem recomendada)

**Fase 1 — Fundação de dados**
1. Unificar o identificador do restaurante (achado E) e resolver o restaurante pelo `slug`.
2. Definir o modelo de `pedidos` e separar status de comanda de status de preparo (achado D).
3. Atualizar `firestore.rules` para os papéis aprovados (achado B) e para o novo modelo.

**Fase 2 — Conectar os atores**
4. Cardápio real no Firestore (Cliente e Admin passam a ler e escrever a mesma fonte).
5. Cozinha e Garçom lendo `pedidos` e `comandas` com `onSnapshot`.
6. Admin em modo monitoramento; operação concentrada no Garçom (achado C).
7. Scanner do Garçom gravando no Firestore.

**Fase 3 — Refinamento por ator**
8. Cliente (PWA), Cozinha (KDS), Garçom/Salão, Admin: ajustes de fluxo e visual, um ator por vez.

**Backlog já registrado (do pedido anterior)**
- Cliente: categorias em abas fixas, feedback sonoro/tátil, filtros rápidos.
- Garçom e KDS: sincronização em tempo real, alerta sonoro de novo pedido, fechamento e rateio.
- Admin: CRUD completo de pratos com upload de foto no Storage, cadastro do restaurante, impressão de QR físicos.

---

## 7. Desconexão do cliente e memória local (regras acordadas)

- **Quando desconectar:** ao ser marcada como `pago` ou ao liberar a mesa. Como segurança, expirar a sessão da mesa após período de inatividade (valor a definir, sugestão de 4 a 6 horas).
- **Ao desconectar:** encerrar os listeners do Firestore e manter apenas o comprovante em `localStorage`.
- **Memória local:** restaurante, mesa, data, itens, total e código de autenticação do comprovante. Sem custo de banco e sem dados pessoais na nuvem.
- **Pendência técnica:** hoje o comprovante é salvo com status `ativo` e nada o marca como concluído quando o garçom fecha a conta. Isso depende da Fase 2 (cliente escutando a própria comanda).
