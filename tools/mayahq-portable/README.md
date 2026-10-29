# MAYaMenu HQ Portable — Console de Operador Air-Gapped (Modo Pendrive Multiplataforma)

Este pacote é um **console físico, multiplataforma e 100% portátil** para administração geral do MAYaMenu. Ele permite que o operador gerencie estabelecimentos, emita lotes de licenças, altere planos e suspenda contas em qualquer computador (**Windows, Linux ou macOS**), **sem expor nenhuma rota administrativa na internet pública**.

---

## 💾 Dica de Formatação do Pendrive: Use **exFAT**
Para que o pendrive funcione de forma transparente com leitura e escrita nativa em **Windows, Linux e macOS** (sem necessidade de instalar drivers ou ter problemas de permissão), formate o pendrive no formato **exFAT**.

---

## 📁 Estrutura Multiplataforma do Pacote

```text
📁 MEU_PENDRIVE/
├── 📄 iniciar.bat               # Windows: 2 cliques
├── 📄 iniciar.sh                # Linux: 2 cliques ou ./iniciar.sh
├── 📄 iniciar.command           # macOS: 2 cliques no Finder
├── 📄 server.mjs                # Servidor nativo ultra-leve (zero dependências npm)
├── 📁 chaves/
│   ├── 📄 service-account.example.json
│   └── 🔐 service-account.json  # Chave mestra privada (fica APENAS no pendrive)
├── 📁 public/
│   └── 📄 index.html            # Interface visual completa (Tema Claro iFood)
└── 📁 bin/                      # (Opcional) Binários portáteis embutidos
    ├── 📄 LEIAME.txt
    ├── 📁 win/node.exe          # Opcional para Windows sem Node instalado
    ├── 📁 linux/node            # Opcional para Linux sem Node instalado
    └── 📁 mac/node              # Opcional para Mac sem Node instalado
```

---

## 🚀 Como Usar no Dia a Dia

1. **No Windows:**
   Dê dois cliques no arquivo `iniciar.bat`.
2. **No Linux:**
   Dê dois cliques em `iniciar.sh` (ou execute `./iniciar.sh` no terminal).
3. **No macOS:**
   Dê dois cliques no arquivo `iniciar.command` diretamente pelo Finder.

O script:
- Detecta automaticamente se existe um executável portátil do Node dentro de `bin/` ou se usa o Node do sistema.
- Abre o navegador padrão na porta segura `http://localhost:3333`.
- Conecta-se diretamente ao Firestore de produção (`mayamenu-bd`).

---

## 🔐 Como Obter a Chave de Acesso (Apenas 1 vez)

1. Acesse o [Firebase Console](https://console.firebase.google.com/project/mayaranas-8ad9f/settings/serviceaccounts/adminsdk).
2. Vá em **Configurações do Projeto** > **Contas de Serviço** > **SDK Admin do Firebase**.
3. Clique em **"Gerar nova chave privada"** e baixe o arquivo `.json`.
4. Salve esse arquivo na pasta `chaves/` com o nome exato:
   👉 `chaves/service-account.json`.

> ⚠️ **Aviso de Segurança Máxima:** Nunca suba esse arquivo `.json` para o GitHub nem envie por mensageiros. Ele deve residir **exclusivamente dentro do seu pendrive físico**.

---

## 🛡️ Vantagens do Modo Air-Gapped / Pendrive

1. **Zero Superfície de Ataque Web:** Não existe rota `/superadmin` vulnerável a scans ou brute force na nuvem.
2. **Desplugou, Trancou:** Quando você remove o pendrive da porta USB, nenhuma credencial nem sessão permanece no computador hospedeiro.
3. **Multiplataforma:** O mesmo pendrive funciona perfeitamente seja você usando notebook Windows, Mac ou desktop Linux.
