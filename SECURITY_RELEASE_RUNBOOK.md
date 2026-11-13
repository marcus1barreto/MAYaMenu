# MAYaMenu — Runbook de publicação do hardening

## Estado

Esta branch contém mudanças incompatíveis com o cliente anterior: concessões e documentos de patrocinadores deixam de ser públicos, a criação de restaurantes passa a ocorrer por callable backend e o cardápio público passa a ler `restaurantes_publicos`.

**Não publicar somente as Rules nem somente o frontend.** A liberação exige Functions, Rules, migração dos perfis e App Hosting coordenados.

## Pré-requisitos

1. Fazer backup/export do Firestore antes da janela de mudança.
2. Confirmar que o banco nomeado `mayamenu-bd` existe no projeto `mayaranas-8ad9f`.
3. Confirmar APIs Cloud Functions 2nd gen, Cloud Run e Eventarc habilitadas.
4. Identificar a conta de serviço de execução de `autenticarPatrocinadorBackend` e conceder a ela `roles/iam.serviceAccountTokenCreator` sobre si mesma. Não conceder a permissão no projeto inteiro.
5. Reemitir credenciais de patrocinadores legadas: o portal aceita somente chaves no formato `SPN-` + 26 caracteres CSPRNG. Não reutilizar chaves curtas anteriores.
6. Confirmar que o Secret Manager contém `MESA_SESSION_SECRET` com pelo menos 32 caracteres aleatórios. Se estiver ausente, gerar e configurar o segredo antes do deploy; nunca inserir seu valor no repositório ou em logs.
7. Garantir credencial administrativa segura para executar a migração. Não versionar chave JSON.

## Mercado Pago — configuração obrigatória

O checkout antigo por rotas Next.js foi desativado (HTTP 410). Antes de reativar cobranças:

1. Configurar o Access Token das Cloud Functions sem versioná-lo:
   - `firebase functions:secrets:set MERCADO_PAGO_ACCESS_TOKEN --project mayaranas-8ad9f`
2. No painel do Mercado Pago, cadastrar o webhook de pagamentos para:
   `https://us-central1-mayaranas-8ad9f.cloudfunctions.net/mercadoPagoWebhook`
   Salvar a configuração, habilitar o evento Pagamentos e revelar/copiar a assinatura secreta gerada pelo próprio Mercado Pago no painel da aplicação.
3. Configurar essa chave no Secret Manager:
   - `firebase functions:secrets:set MERCADO_PAGO_WEBHOOK_SECRET --project mayaranas-8ad9f`
4. Configurar as variáveis de ambiente do Functions no arquivo local não versionado `functions/.env.mayaranas-8ad9f` (ou no mecanismo equivalente do runtime):
   - `MERCADO_PAGO_LIVE_MODE=true` para produção; usar `false` somente com credenciais e checkout sandbox.
   - `MAYAMENU_APP_URL=https://<dominio-oficial>` (obrigatório; usar o domínio HTTPS efetivamente publicado no Firebase App Hosting ou domínio próprio).
   - Não commitar o arquivo `.env` nem incluir tokens nele; os tokens ficam exclusivamente no Secret Manager.
5. Validar primeiro com credenciais sandbox e `MERCADO_PAGO_LIVE_MODE=false`. Não usar pagamentos reais para testar. O simulador de Webhooks do Mercado Pago deve confirmar o recebimento HTTP 200 e a validação de assinatura.
6. Confirmar que o retorno do checkout contém `attempt` e que a assinatura só é ativada depois de o backend consultar a API oficial, validar valor, moeda, referência e ambiente, validar a assinatura HMAC e a tolerância temporal de 5 minutos do webhook, e registrar o pagamento de forma idempotente. Manter o relógio do runtime sincronizado.

**Não reativar checkout nem publicar cobrança real enquanto os dois segredos e o webhook assinado não estiverem configurados.** Sem essas configurações, as Cloud Functions falham de forma fechada e não ativam o PRO.

## Migração dos gatilhos

A função `setRestaurantOwnerClaims` existente em produção é de 1ª geração. O código desta branch a substitui por um gatilho de 2ª geração no banco nomeado `mayamenu-bd`. A geração não pode ser alterada in-place.

Durante a janela de publicação, remover o gatilho antigo e implantar a versão nova:

```bash
firebase functions:delete setRestaurantOwnerClaims --region us-central1 --project mayaranas-8ad9f
firebase deploy --only functions,firestore,storage --project mayaranas-8ad9f
```

A implantação cria os gatilhos de 2ª geração `setRestaurantOwnerClaims`, `sincronizarPerfilPublicoRestaurante` e `processarSelloutOutbox`, todos vinculados explicitamente ao banco `mayamenu-bd`.

## Migração dos perfis públicos

Após implantar as Functions e antes de liberar o frontend novo:

```bash
gcloud auth application-default login
npm run migrate:public-profiles
```

Alternativamente, defina `GOOGLE_APPLICATION_CREDENTIALS` para uma credencial administrativa protegida. O script pagina a coleção raiz e grava somente campos públicos permitidos em `restaurantes_publicos`.

Conferir a contagem de documentos e amostrar restaurantes com e sem Pix ativo. Não executar a migração antes de confirmar que o banco alvo é `mayamenu-bd`.

## Frontend e Rules

O frontend novo deve ser publicado junto da política de Rules desta branch. Em produção pré-comercial, fazer a mudança em janela controlada: o cliente antigo deixa de conseguir ativar licenças ou criar tenants diretamente quando as Rules novas entram em vigor.

Após a publicação do frontend, validar imediatamente:

- Abertura de cardápio público por slug e por URL direta.
- Upload e leitura pública de imagens do cardápio/equipe, com rejeição de MIME e tamanho fora da política.
- Pix ativo e inativo no perfil público.
- Login de proprietário e sessão/claims.
- Ativação de licença convencional e voucher B2B.
- Login do portal B2B, catálogo, lotes e métricas.
- Pedido cliente, pedido de garçom, fechamento e liberação de mesa.
- Processamento do outbox de sell-out e ausência de dupla contabilização.
- Desativação de mesa com tickets KDS em ambos os formatos de número.

## Critérios para concluir a publicação

- GitHub Actions verde no commit exato a ser publicado.
- `npm test`, `npx tsc --noEmit` e `npm run build` aprovados.
- Gatilhos de 2ª geração visíveis e associados ao banco `mayamenu-bd`.
- Migração pública concluída sem erros.
- Smoke tests acima aprovados.
- Nenhuma alteração manual de Rules ou Functions divergente do commit publicado.

**Não executar merge ou deploy sem autorização final do responsável pelo projeto.**
