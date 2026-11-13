const SESSAO_MESA_TIMEOUT_MS = 4 * 60 * 60 * 1000;

function getCartStorageKey(restSlug, numMesa) {
  return `mayamenu_cart_${restSlug}_mesa_${String(numMesa)}`;
}

function isCarrinhoExpirado(atualizadoEm, agora = Date.now()) {
  if (typeof atualizadoEm !== "number" || !Number.isFinite(atualizadoEm)) return true;
  return agora - atualizadoEm > SESSAO_MESA_TIMEOUT_MS;
}

function fingerprintQrCredencial(valor) {
  if (!valor) return "sem-credencial";
  let hash = 2166136261;
  for (let i = 0; i < valor.length; i++) {
    hash ^= valor.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function isMesaTokenCacheValido(cache, qrCredencial, agora = Date.now()) {
  return Boolean(
    cache
    && typeof cache.token === "string"
    && cache.token.length > 0
    && cache.qrFingerprint === fingerprintQrCredencial(qrCredencial)
    && Number(cache.expiraEm) > agora + 60_000
  );
}

module.exports = {
  SESSAO_MESA_TIMEOUT_MS,
  getCartStorageKey,
  isCarrinhoExpirado,
  fingerprintQrCredencial,
  isMesaTokenCacheValido,
};
