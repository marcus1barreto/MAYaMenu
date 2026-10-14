# Relatório Técnico Executivo — MAYaMenu (Alpha MVP)

**Projeto:** MAYaMenu (Plataforma de Cardápio Digital e Pedidos)  
**Organização:** MAYaRAnas Sistemas  
**Status Atual:** Concluído com sucesso (Build de produção e Dev Server validados)  
**Data:** 13 de Outubro de 2026  

---

## 1. O que foi Feito e o que Temos Aqui

Construímos e integramos a infraestrutura completa do MVP Alpha do **MAYaMenu**, aderindo à filosofia *"O menos é mais"*, resiliência *Offline-First* e as diretrizes dos arquivos pétreos.

### 1.1. Arquitetura e Estrutura de Pastas
* **Next.js 16 (App Router) + Turbopack**: inicializado com TypeScript, Tailwind CSS v4 e regras de *Partial Prerendering (PPR)* e *Cache Components*.
* **shadcn/ui + Lucide Icons**: componentes de interface de alto nível (`button`, `dialog`, `sheet`, `input`, `badge`, `switch`, `tabs`, `card`, `separator`).
* **Design "Fat-Finger Friendly"**: áreas de toque amplas, contrastes elevados e micro-animações táteis.
* **Preservação dos Arquivos Pétreos**:
  * Especificação técnica guardada em `docs/especificacao-tecnica-alpha.md`.
  * Regras oficiais na raiz em `firestore.rules`.
  * Modelos de dados em `src/types/index.ts`.
  * Imagens originais de alta resolução em `assets/originais/`.
  * Cópias otimizadas em WebP (< 200 KB) em `public/images/` para garantir excelente pontuação no Core Web Vitals.

### 1.2. Módulos Implementados

| Módulo | Rota | Descrição |
|---|---|---|
| **Landing Page** | `/` | Apresenta a filosofia do projeto e botão de entrada direta na mesa de demonstração. |
| **PWA do Cliente** | `/r/[slug]?mesa=X` | Cardápio interativo, busca em tempo real, modal de personalização com modificadores, carrinho com persistência local e gerador de **Ticket Digital (QR Code)**. |
| **KDS da Cozinha** | `/cozinha` | Gestão de comandas separadas em "A Fazer" e "Pronto". Destaque visual em **vermelho vivo** para modificadores/observações e botão único **"MARCHAR"**. |
| **Terminal do Garçom** | `/garcom` | Mapa visual das mesas do salão (Livre, Ocupada, Pediu Conta), cálculo do subtotal individual fracionado por pessoa e **Leitor de Câmera para QR Code de Contingência**. |
| **Painel de Gestão** | `/admin` | Chaves liga/desliga para pausar pratos esgotados instantaneamente, mapa de links de mesas físicas e seletor da cor primária da marca. |
| **Contingência Offline** | `/~offline` | Página servida pelo service worker Serwist caso o navegador perca a conexão. |

### 1.3. Credenciais de Teste Alpha
* **E-mail:** `admin@mayamenu.com`
* **Senha:** `123456`
* Na tela de login, há um botão de **1 clique ("Preencher")** para agilizar a entrada.

---

## 2. Programação para Subir o Projeto ao Git

O repositório Git local já está criado e com todos os passos versionados. Para enviá-lo ao GitHub ou GitLab:

### Passo 1: Criar o repositório remoto
Crie um repositório vazio no GitHub (exemplo: `mayaranas/mayamenu`).

### Passo 2: Vincular e Enviar
No terminal, na pasta raiz do projeto (`/media/mbarreto/geral_ext4/mayaranas/mayamenu`), execute:

```bash
# Se usar SSH:
git remote add origin git@github.com:SEU_USUARIO/mayamenu.git

# Ou se usar HTTPS:
git remote add origin https://github.com/SEU_USUARIO/mayamenu.git

# Enviar o ramo principal
git branch -M main
git push -u origin main
```

---

## 3. Deploy no Firebase App Hosting

O **Firebase App Hosting** é a solução da Google projetada especificamente para Next.js 14+ com SSR, ISR e Server Actions.

### Passo 1: Instalar e Autenticar a Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### Passo 2: Criar o Arquivo de Configuração do App Hosting
Crie o arquivo `apphosting.yaml` na raiz do projeto:

```yaml
# apphosting.yaml
runConfig:
  minInstances: 0
  maxInstances: 5
  concurrency: 80
  cpu: 1
  memoryMiB: 1024

env:
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: "SUA_API_KEY"
  - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    value: "SEU_PROJETO.firebaseapp.com"
  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: "SEU_PROJETO"
  - variable: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    value: "SEU_PROJETO.appspot.com"
  - variable: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    value: "SEU_SENDER_ID"
  - variable: NEXT_PUBLIC_FIREBASE_APP_ID
    value: "SEU_APP_ID"
```

### Passo 3: Ativar o App Hosting via Console ou CLI
1. Acesse o [Console do Firebase](https://console.firebase.google.com/).
2. Selecione seu projeto (plano Blaze ativo).
3. Vá em **Build > App Hosting**.
4. Conecte sua conta do GitHub e selecione o repositório `mayamenu`.
5. Escolha a região (ex: `southamerica-east1` para São Paulo ou `us-central1`).
6. O Firebase App Hosting criará um pipeline automatizado de CI/CD: todo `git push` no branch `main` disparará uma nova compilação e deploy automático com URL pública segura (`.web.app`).

### Passo 4: Deploy das Regras do Firestore
Para publicar as regras de segurança blindadas diretamente:
```bash
firebase deploy --only firestore:rules
```

---

## 4. Como Deve ser Implementado o Banco de Dados (Firestore)

A modelagem de dados foi desenhada para resolver dois problemas críticos em restaurantes: **concorrência (Race Conditions)** e **fechamento de conta fracionada**.

### 4.1. Configuração Inicial no Firebase Console
1. **Ativar o Firestore Database**: Modo de Produção (São Paulo `southamerica-east1` recomendado).
2. **Ativar o Firebase Authentication**:
   - Vá em **Authentication > Sign-in method**.
   - Ative **E-mail/Senha** (para o lojista/administrador).
   - **MANDATÓRIO**: Ative **Anônimo** (permite aos clientes do salão abrir o PWA sem login, gerando o `uid` seguro que protege a comanda).
3. **Ativar o Firebase Storage**: para armazenar fotos dos pratos enviadas pelo painel administrativo.

---

### 4.2. Estrutura NoSQL das Coleções

```
restaurantes/
  └── {restauranteId}/             (ID do documento = uid do dono ou gerado)
        ├── ownerId: string        (uid do Firebase Auth do lojista)
        ├── slug: string           ("demo", "burger-do-marcus")
        ├── nome: string           ("MAYaBurger & Co.")
        ├── configuracoes: {
        │     corPrimaria: string  ("#E11D48")
        │     tema: string         ("light")
        │     capaUrl: string      ("/images/capa-padrao.webp")
        │   }
        │
        ├── cardapio/              (Subcoleção: Itens do Cardápio)
        │     └── {itemId}/
        │           ├── nome: string
        │           ├── descricao: string
        │           ├── precoBase: number
        │           ├── fotoUrl: string
        │           ├── ativo: boolean
        │           └── grupoModificadores: [
        │                 {
        │                   nome: "Ponto da Carne",
        │                   obrigatorio: true,
        │                   maxEscolhas: 1,
        │                   opcoes: [
        │                     { nome: "Ao Ponto", precoAdicional: 0 }
        │                   ]
        │                 }
        │               ]
        │
        └── mesas/                 (Subcoleção: Mesas Físicas)
              └── {numeroMesa}/    (ex: "12")
                    │
                    └── comandas_abertas/  (Subcoleção: Comanda por cliente na mesa)
                          └── {clienteId}/  (clienteId = uid do login anônimo do cliente)
                                ├── id: string
                                ├── nomeCliente: string ("Marcus")
                                ├── criadoEm: timestamp
                                ├── subtotal: number
                                ├── status: "pedindo" | "aguardando_pratos" | "conta_pedida" | "pago"
                                └── itens: [
                                      {
                                        menuItemId: string
                                        nome: string
                                        quantidade: number
                                        precoFinal: number
                                        modificadores: [{ grupo: "Ponto da Carne", opcao: "Ao Ponto" }]
                                        observacoes: "Sem cebola"
                                      }
                                    ]
```

---

### 4.3. Por que essa Estrutura é Superior?
1. **Anti-Race Condition**: Várias pessoas sentadas na Mesa 12 gravam seus pedidos em nós filhos distintos (`comandas_abertas/{clienteId}`). Nenhuma gravação sobrescreve a outra.
2. **Rateio Fracionado Imediato**: Na hora da conta, o garçom sabe exatamente o que o *Marcus* consumiu e o que a *Mayara* consumiu, sem necessidade de contas manuais.
3. **Blindagem de Segurança com `firestore.rules`**:
   - Clientes leem e atualizam **apenas o seu próprio nó filho**.
   - Clientes só podem transitar status para `aguardando_pratos` ou `conta_pedida`.
   - Apenas o lojista autenticado (`ownerId`) pode marcar a comanda como `pago` ou excluir o registro da comanda após o pagamento na maquininha.

---

### 4.4. Script de Inicialização (Seed) para o Firestore
Para popular o banco com os dados iniciais do cardápio demonstrativo via código:

```typescript
// scripts/seed.ts (ou via console administrativo)
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { RESTAURANTE_DEMO, CARDAPIO_DEMO } from "@/lib/mock-data";

export async function popularBanco(ownerUid: string) {
  const restId = ownerUid;
  
  // 1. Cria o Restaurante
  await setDoc(doc(db, "restaurantes", restId), {
    ...RESTAURANTE_DEMO,
    id: restId,
    ownerId: ownerUid,
  });

  // 2. Cria os Itens do Cardápio
  for (const item of CARDAPIO_DEMO) {
    await setDoc(doc(db, "restaurantes", restId, "cardapio", item.id), item);
  }

  console.log("Banco populado com sucesso para o restaurante:", restId);
}
```

---

## 5. Próximos Passos Recomendados

1. **Ativação das Credenciais Reais**:
   - Copiar `.env.example` para `.env.local` e preencher com as credenciais do seu projeto Firebase Console.
2. **Impressão dos QR Codes de Mesa**:
   - Gerar os adesivos das mesas com as URLs diretas geradas no painel: `https://seu-dominio.web.app/r/seu-slug?mesa=1` a `12`.
3. **Testes de Campo**:
   - Realizar teste de simulação com interrupção de sinal de internet para validar o fluxo do Ticket Digital físico pelo leitor de câmera do garçom.
