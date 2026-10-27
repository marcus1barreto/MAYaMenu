/**
 * Módulo de Geração de Pix Dinâmico e Estático (BR Code / Copia e Cola)
 * Padrão oficial BACEN / EMVCo QRCPS-MPM (Merchant-Presented Mode).
 * 
 * Permite que clientes de restaurantes realizem pagamentos instantâneos via
 * Copia-e-Cola ou QR Code diretamente para a chave do estabelecimento com valor
 * exato calculado em centavos, sem cobrança de taxas de intermediação adicionais.
 */

import type { TipoChavePix } from "@/types";

export interface DadosPix {
  chave: string;
  tipoChave?: TipoChavePix;
  beneficiario: string; // Nome do titular / Razão Social (BACEN max: 25)
  cidade: string; // Cidade do estabelecimento (BACEN max: 15)
  valor: number; // Valor exato em Reais (ex: 45.90)
  identificador?: string; // txId / Identificador da comanda (alfanumérico max 25, ou '***')
  descricao?: string; // Descrição opcional (ex: "Mesa 12 - MAYaMenu")
}

/**
 * Remove acentos, cedilhas e caracteres especiais que violam a norma EMV do BACEN.
 */
export function normalizarTextoBacen(texto: string, maxLen?: number): string {
  if (!texto) return "";
  const limpo = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .toUpperCase();
  return maxLen && maxLen > 0 ? limpo.slice(0, maxLen) : limpo;
}

/**
 * Formata a chave Pix para conformidade estrita com as regras do BACEN.
 */
export function formatarChavePixParaBacen(chave: string, tipo?: TipoChavePix): string {
  const chaveLimpa = chave.trim();
  if (!tipo) return chaveLimpa;

  switch (tipo) {
    case "cpf":
    case "cnpj":
      // Somente números
      return chaveLimpa.replace(/\D/g, "");
    case "telefone": {
      // Formato internacional +55DDD9XXXXXXXX
      const digitos = chaveLimpa.replace(/\D/g, "");
      if (digitos.startsWith("55") && digitos.length >= 12) {
        return `+${digitos}`;
      }
      return `+55${digitos}`;
    }
    case "email":
      return chaveLimpa.toLowerCase();
    case "aleatoria":
    default:
      return chaveLimpa;
  }
}

/**
 * Monta um elemento TLV (Tag-Length-Value) do padrão EMV.
 */
function tlv(id: string, valor: string): string {
  const length = valor.length.toString().padStart(2, "0");
  return `${id}${length}${valor}`;
}

/**
 * Calcula o Checksum CRC16-CCITT (Polinômio 0x1021, valor inicial 0xFFFF)
 * exigido pelo BACEN no final do payload Pix.
 */
export function calcularCRC16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Gera o payload oficial do Pix Copia-e-Cola (BR Code padrão BACEN).
 */
export function gerarPayloadPix({
  chave,
  tipoChave,
  beneficiario,
  cidade,
  valor,
  identificador,
  descricao,
}: DadosPix): string {
  const chaveFormatada = formatarChavePixParaBacen(chave, tipoChave);
  const nomeBeneficiario = normalizarTextoBacen(beneficiario || "RECEBEDOR", 25) || "RECEBEDOR";
  const cidadeBeneficiario = normalizarTextoBacen(cidade || "BRASIL", 15) || "BRASIL";

  // Identificador da transação (txId): max 25 caracteres alfanuméricos ou '***'
  let txId = "***";
  if (identificador && identificador.trim()) {
    const limpo = identificador.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25);
    if (limpo.length > 0) txId = limpo;
  }

  // 1. Tag 00: Payload Format Indicator (versão 01)
  let payload = tlv("00", "01");

  // 2. Tag 01: Point of Initiation Method ('12' = Dinâmico/Uso único com valor definido; '11' = Estático)
  payload += tlv("01", valor > 0 ? "12" : "11");

  // 3. Tag 26: Merchant Account Information (GUI + Chave + Descrição opcional)
  let merchantAccount = tlv("00", "BR.GOV.BCB.PIX");
  merchantAccount += tlv("01", chaveFormatada);
  if (descricao && descricao.trim()) {
    const descNormalizada = normalizarTextoBacen(descricao, 40);
    if (descNormalizada) {
      merchantAccount += tlv("02", descNormalizada);
    }
  }
  payload += tlv("26", merchantAccount);

  // 4. Tag 52: Merchant Category Code (0000 = Padrão)
  payload += tlv("52", "0000");

  // 5. Tag 53: Transaction Currency (986 = Real BRL ISO 4217)
  payload += tlv("53", "986");

  // 6. Tag 54: Transaction Amount (formatado com 2 casas decimais)
  if (valor > 0) {
    const valorFormatado = valor.toFixed(2);
    payload += tlv("54", valorFormatado);
  }

  // 7. Tag 58: Country Code (BR)
  payload += tlv("58", "BR");

  // 8. Tag 59: Merchant Name (Nome do recebedor)
  payload += tlv("59", nomeBeneficiario);

  // 9. Tag 60: Merchant City (Cidade do recebedor)
  payload += tlv("60", cidadeBeneficiario);

  // 10. Tag 62: Additional Data Field Template (txId)
  const additionalData = tlv("05", txId);
  payload += tlv("62", additionalData);

  // 11. Tag 63: CRC16 Checksum
  // Concatena a tag "63" com o tamanho "04" e calcula o checksum de todo o bloco prévio
  const payloadComTagCRC = `${payload}6304`;
  const crc16 = calcularCRC16(payloadComTagCRC);

  return `${payloadComTagCRC}${crc16}`;
}
