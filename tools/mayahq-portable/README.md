# MAYaMenu HQ Portable — Console de Operador Air-Gapped (Modo Pendrive)

Este pacote é um **console físico e portátil** para administração geral do MAYaMenu. Ele permite que o operador gerencie estabelecimentos, emita licenças, altere planos e suspenda contas diretamente do seu computador ou pendrive, **sem expor nenhuma rota administrativa na internet pública**.

---

## 📁 Estrutura do Pacote no Pendrive

```text
📁 MAYaHQ-Console/
├── 📄 iniciar.bat               # Clique duplo no Windows
├── 📄 iniciar.sh                # Clique duplo no Linux / macOS
├── 📄 server.mjs                # Servidor nativo ultra-leve (zero dependências)
├── 📁 chaves/
│   ├── 📄 service-account.example.json
│   └── 🔐 service-account.json  # Sua chave mestra privada (fica APENAS no pendrive)
└── 📁 public/
    └── 📄 index.html            # Interface visual do SuperAdmin (Tema Claro iFood)
```

---

## 🚀 Como Preparar o seu Pendrive em 3 Passos

### Passo 1: Copie esta pasta para a raiz do seu Pendrive
Copie a pasta `mayahq-portable` para o seu pendrive USB e, se desejar, renomeie para `MAYaHQ-Console`.

### Passo 2: Baixe a Chave Privada da sua Conta Firebase
1. Acesse o [Firebase Console](https://console.firebase.google.com/project/mayaranas-8ad9f/settings/serviceaccounts/adminsdk).
2. Vá em **Configurações do Projeto** > **Contas de Serviço** > **SDK Admin do Firebase**.
3. Clique em **"Gerar nova chave privada"** e baixe o arquivo `.json`.
4. Salve esse arquivo na pasta `chaves/` com o nome exato:
   👉 `chaves/service-account.json`.

> ⚠️ **Aviso de Segurança Máxima:** Nunca suba esse arquivo `.json` para o GitHub nem envie por e-mail. Ele deve residir **exclusivamente dentro do seu pendrive físico**.

### Passo 3: Executar

- **No Windows:** Dê dois cliques em `iniciar.bat`.
- **No Linux / macOS:** Dê dois cliques em `iniciar.sh` (ou execute `./iniciar.sh` no terminal).

Uma janela do seu navegador abrirá imediatamente em `http://localhost:3333` com o painel conectado com superpoderes ao banco de dados `mayamenu-bd` de produção!

---

## 🔐 Como Funciona a Segurança Air-Gapped

1. **Sem URL pública na nuvem:** Ninguém na internet consegue adivinhar ou invadir a área de SuperAdmin.
2. **Desplugou o pendrive, o cofre fecha:** Nenhuma credencial de administração fica salva no computador do operador.
3. **Comunicação Direta:** As requisições são feitas diretamente do seu IP local para as APIs seguras do Google Cloud via OAuth2 criptografado (RS256).
