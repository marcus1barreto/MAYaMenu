import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3333;
const PROJECT_ID = "mayaranas-8ad9f";
const DATABASE_ID = "mayamenu-bd";
const CHAVE_PATH = path.join(__dirname, "chaves", "service-account.json");

// Cache em memória do Google OAuth2 Token
let googleTokenCache = {
  token: null,
  expiresAt: 0,
};

/**
 * Gera um token de acesso OAuth2 usando a Service Account privada do pendrive (RS256 nativo)
 */
async function obterGoogleAccessToken() {
  const agoraSegundos = Math.floor(Date.now() / 1000);

  if (googleTokenCache.token && googleTokenCache.expiresAt > agoraSegundos + 60) {
    return googleTokenCache.token;
  }

  if (!fs.existsSync(CHAVE_PATH)) {
    throw new Error("Chave privada não encontrada em 'chaves/service-account.json'.");
  }

  const chaveJson = JSON.parse(fs.readFileSync(CHAVE_PATH, "utf8"));
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: chaveJson.client_email,
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: agoraSegundos + 3600,
    iat: agoraSegundos,
  };

  const base64Url = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const headerB64 = base64Url(header);
  const payloadB64 = base64Url(payload);
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  const signature = signer
    .sign(chaveJson.private_key, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const assertion = `${unsignedToken}.${signature}`;

  // Requisita o token de acesso à API do Google
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const erroTxt = await response.text();
    throw new Error(`Falha ao obter Google Token: ${erroTxt}`);
  }

  const data = await response.json();
  googleTokenCache = {
    token: data.access_token,
    expiresAt: agoraSegundos + data.expires_in,
  };

  return googleTokenCache.token;
}

/**
 * Converte documento Firestore REST para objeto JS limpo
 */
function converterDocumentoFirestore(doc) {
  if (!doc || !doc.fields) return {};
  const id = doc.name ? doc.name.split("/").pop() : "";
  const resultado = { id };

  for (const [chave, valorObj] of Object.entries(doc.fields)) {
    if ("stringValue" in valorObj) resultado[chave] = valorObj.stringValue;
    else if ("integerValue" in valorObj) resultado[chave] = Number(valorObj.integerValue);
    else if ("doubleValue" in valorObj) resultado[chave] = Number(valorObj.doubleValue);
    else if ("booleanValue" in valorObj) resultado[chave] = valorObj.booleanValue;
    else if ("timestampValue" in valorObj) resultado[chave] = valorObj.timestampValue;
    else if ("mapValue" in valorObj) resultado[chave] = converterCamposMap(valorObj.mapValue.fields);
    else resultado[chave] = valorObj;
  }

  return resultado;
}

function converterCamposMap(fields) {
  if (!fields) return {};
  const obj = {};
  for (const [k, v] of Object.entries(fields)) {
    if ("stringValue" in v) obj[k] = v.stringValue;
    else if ("integerValue" in v) obj[k] = Number(v.integerValue);
    else if ("doubleValue" in v) obj[k] = Number(v.doubleValue);
    else if ("booleanValue" in v) obj[k] = v.booleanValue;
    else if ("mapValue" in v) obj[k] = converterCamposMap(v.mapValue.fields);
    else obj[k] = v;
  }
  return obj;
}

/**
 * Executa chamada direta à REST API do Firestore com permissão total de Admin
 */
async function chamarFirestore(metodo, rotaRelativa, body = null) {
  const token = await obterGoogleAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${rotaRelativa}`;

  const opcoes = {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    opcoes.body = JSON.stringify(body);
  }

  const res = await fetch(url, opcoes);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro Firestore (${res.status}): ${errText}`);
  }

  return res.json();
}

/**
 * Servidor HTTP Portátil
 */
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;

  // Headers CORS para requisições locais
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Helper para resposta JSON
  const responderJson = (statusCode, dados) => {
    res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(dados));
  };

  try {
    // API 1: Status do Pendrive
    if (pathname === "/api/status" && req.method === "GET") {
      const temChave = fs.existsSync(CHAVE_PATH);
      responderJson(200, {
        status: "online",
        modo: "air-gapped-portable",
        projeto: PROJECT_ID,
        database: DATABASE_ID,
        chavePrivadaPresente: temChave,
      });
      return;
    }

    // API 2: Listar Restaurantes
    if (pathname === "/api/restaurantes" && req.method === "GET") {
      const resposta = await chamarFirestore("GET", "restaurantes?pageSize=100");
      const lista = (resposta.documents || []).map(converterDocumentoFirestore);
      responderJson(200, { restaurantes: lista });
      return;
    }

    // API 3: Listar Licenças (Coleção 'concessoes')
    if (pathname === "/api/licencas" && req.method === "GET") {
      const resposta = await chamarFirestore("GET", "concessoes?pageSize=100");
      const lista = (resposta.documents || []).map(converterDocumentoFirestore);
      responderJson(200, { licencas: lista });
      return;
    }

    // API 4: Listar Arquivo Morto (Coleção 'arquivo_morto_licencas')
    if (pathname === "/api/arquivo-morto" && req.method === "GET") {
      const resposta = await chamarFirestore("GET", "arquivo_morto_licencas?pageSize=100");
      const lista = (resposta.documents || []).map(converterDocumentoFirestore);
      responderJson(200, { arquivoMorto: lista });
      return;
    }

    // API 5: Alterar Plano de Estabelecimento
    if (pathname === "/api/restaurantes/alterar-plano" && req.method === "POST") {
      let bodyRaw = "";
      for await (const chunk of req) bodyRaw += chunk;
      const { restauranteId, novoPlano } = JSON.parse(bodyRaw);

      if (!restauranteId || !novoPlano) {
        responderJson(400, { erro: "Parâmetros inválidos." });
        return;
      }

      await chamarFirestore("PATCH", `restaurantes/${restauranteId}?updateMask.fieldPaths=plano`, {
        fields: {
          plano: { stringValue: novoPlano },
        },
      });

      responderJson(200, { sucesso: true, mensagem: `Plano alterado para ${novoPlano}` });
      return;
    }

    // API 6: Suspender / Reativar Estabelecimento
    if (pathname === "/api/restaurantes/suspensao" && req.method === "POST") {
      let bodyRaw = "";
      for await (const chunk of req) bodyRaw += chunk;
      const { restauranteId, suspenso } = JSON.parse(bodyRaw);

      if (!restauranteId || typeof suspenso !== "boolean") {
        responderJson(400, { erro: "Parâmetros inválidos." });
        return;
      }

      await chamarFirestore("PATCH", `restaurantes/${restauranteId}?updateMask.fieldPaths=suspenso`, {
        fields: {
          suspenso: { booleanValue: suspenso },
        },
      });

      responderJson(200, { sucesso: true, suspenso });
      return;
    }

    // API 7: Criar Lote de Licenças (Direto no Firestore 'concessoes')
    if (pathname === "/api/licencas/criar-lote" && req.method === "POST") {
      let bodyRaw = "";
      for await (const chunk of req) bodyRaw += chunk;
      const { quantidade = 1, plano = "pro", responsavel = "", notas = "", horasValidade = 0 } = JSON.parse(bodyRaw);

      const qtd = Math.min(Math.max(1, Number(quantidade) || 1), 50);
      const limites = plano === "enterprise"
        ? { maxPratos: 999, maxMesas: 999 }
        : plano === "pro"
        ? { maxPratos: 60, maxMesas: 30 }
        : { maxPratos: 15, maxMesas: 5 };

      const agora = new Date();
      const agoraIso = agora.toISOString();
      const expiracaoIso = horasValidade > 0
        ? new Date(agora.getTime() + horasValidade * 3600 * 1000).toISOString()
        : null;

      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const gerarCodigo = () => {
        let p1 = "";
        let p2 = "";
        for (let i = 0; i < 4; i++) {
          p1 += chars.charAt(Math.floor(Math.random() * chars.length));
          p2 += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `MAYA-${p1}-${p2}`;
      };

      const novasLicencas = [];

      for (let i = 1; i <= qtd; i++) {
        const codigo = gerarCodigo();
        const respFormatado = responsavel ? (qtd > 1 ? `${responsavel} #${String(i).padStart(2, "0")}` : responsavel) : "";

        const fields = {
          id: { stringValue: codigo },
          status: { stringValue: "disponivel" },
          plano: { stringValue: plano },
          responsavel: { stringValue: respFormatado },
          notas: { stringValue: notas || "" },
          criadaEm: { timestampValue: agoraIso },
          limites: {
            mapValue: {
              fields: {
                maxPratos: { integerValue: String(limites.maxPratos) },
                maxMesas: { integerValue: String(limites.maxMesas) },
              },
            },
          },
        };

        if (expiracaoIso) {
          fields.expiracaoEm = { timestampValue: expiracaoIso };
        }

        await chamarFirestore("PATCH", `concessoes/${codigo}`, { fields });

        novasLicencas.push({
          id: codigo,
          status: "disponivel",
          plano,
          responsavel: respFormatado,
          notas,
          criadaEm: agoraIso,
          expiracaoEm: expiracaoIso,
          limites,
        });
      }

      responderJson(200, { sucesso: true, criadas: novasLicencas });
      return;
    }

    // API 8: Revogar ou Alterar Status de Licença
    if (pathname === "/api/licencas/alterar-status" && req.method === "POST") {
      let bodyRaw = "";
      for await (const chunk of req) bodyRaw += chunk;
      const { licencaId, novoStatus } = JSON.parse(bodyRaw);

      if (!licencaId || !novoStatus) {
        responderJson(400, { erro: "Parâmetros inválidos." });
        return;
      }

      await chamarFirestore("PATCH", `concessoes/${licencaId}?updateMask.fieldPaths=status`, {
        fields: {
          status: { stringValue: novoStatus },
        },
      });

      responderJson(200, { sucesso: true, licencaId, novoStatus });
      return;
    }

    // API 9: Arquivar Licença Expirada (Move para 'arquivo_morto_licencas')
    if (pathname === "/api/licencas/arquivar" && req.method === "POST") {
      let bodyRaw = "";
      for await (const chunk of req) bodyRaw += chunk;
      const { licenca } = JSON.parse(bodyRaw);

      if (!licenca || !licenca.id) {
        responderJson(400, { erro: "Licença inválida para arquivamento." });
        return;
      }

      const agoraIso = new Date().toISOString();
      const fields = {
        id: { stringValue: licenca.id },
        planoOriginal: { stringValue: licenca.plano || "free" },
        arquivadoEm: { timestampValue: agoraIso },
        motivo: { stringValue: "Arquivamento manual via Console Portátil" },
        dadosSnapshot: {
          stringValue: JSON.stringify(licenca),
        },
      };

      // 1. Salva no arquivo morto
      await chamarFirestore("PATCH", `arquivo_morto_licencas/${licenca.id}`, { fields });

      // 2. Remove da coleção concessoes
      await chamarFirestore("DELETE", `concessoes/${licenca.id}`);

      responderJson(200, { sucesso: true, arquivadoId: licenca.id });
      return;
    }

    // Rota Raiz: Serve a Interface Visual do SuperAdmin Portátil
    if (pathname === "/" || pathname === "/index.html") {
      const htmlPath = path.join(__dirname, "public", "index.html");
      if (fs.existsSync(htmlPath)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        fs.createReadStream(htmlPath).pipe(res);
        return;
      }
    }

    // Arquivos estáticos em public/
    const assetPath = path.join(__dirname, "public", pathname);
    if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
      const ext = path.extname(assetPath).toLowerCase();
      const contentTypes = {
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".ico": "image/x-icon",
      };
      res.writeHead(200, { "Content-Type": contentTypes[ext] || "text/plain" });
      fs.createReadStream(assetPath).pipe(res);
      return;
    }

    // 404 local
    responderJson(404, { erro: "Rota local não encontrada." });
  } catch (err) {
    console.error("❌ Erro no Console Portátil:", err.message);
    responderJson(500, { erro: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`🛡️  MAYaHQ Portable escutando em http://localhost:${PORT}`);
});
