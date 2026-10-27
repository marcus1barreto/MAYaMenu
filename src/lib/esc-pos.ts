/**
 * Motor ESC/POS (Gerador de Bytes para Impressão Térmica Direta via Web Serial / USB / TCP)
 * 
 * Implementa comandos padrão Epson ESC/POS com normalização ASCII automática
 * para evitar "mojibake" (caracteres corrompidos por tabelas de página ausentes)
 * em impressoras térmicas de 58mm e 80mm (Bematech, Elgin, Epson, Daruma, etc.).
 */

export type EscPosAlignment = "left" | "center" | "right";
export type EscPosFontSize = "normal" | "double" | "double-height" | "double-width";

export class EscPosBuilder {
  private buffer: number[] = [];

  /**
   * ESC @ : Inicializa a impressora e limpa o buffer interno de formatação
   */
  init(): this {
    this.buffer.push(0x1B, 0x40);
    return this;
  }

  /**
   * ESC a n : Alinhamento de parágrafo (0: Esquerda, 1: Centro, 2: Direita)
   */
  align(position: EscPosAlignment): this {
    const val = position === "center" ? 1 : position === "right" ? 2 : 0;
    this.buffer.push(0x1B, 0x61, val);
    return this;
  }

  /**
   * ESC E n : Modo Negrito (1: Ativado, 0: Desativado)
   */
  bold(on: boolean = true): this {
    this.buffer.push(0x1B, 0x45, on ? 1 : 0);
    return this;
  }

  /**
   * GS ! n : Tamanho do caractere (Normal, Altura Dupla, Largura Dupla, Quadruplo)
   */
  size(fontSize: EscPosFontSize = "normal"): this {
    let n = 0x00;
    if (fontSize === "double-height") n = 0x01;
    else if (fontSize === "double-width") n = 0x10;
    else if (fontSize === "double") n = 0x11;
    this.buffer.push(0x1D, 0x21, n);
    return this;
  }

  /**
   * Adiciona texto sanitizado, com normalização NFD para eliminar diacríticos e acentos.
   * Garante compatibilidade universal sem dependência de tabelas CP850/CP860 externas.
   */
  text(str: string): this {
    const cleanStr = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const encoder = new TextEncoder();
    this.buffer.push(...Array.from(encoder.encode(cleanStr)));
    return this;
  }

  /**
   * Adiciona texto seguido de quebra de linha (CR/LF)
   */
  textLine(str: string = ""): this {
    if (str) {
      this.text(str);
    }
    return this.feed(1);
  }

  /**
   * Cria uma linha justificada com texto à esquerda e à direita (ex: Item e Preço).
   * @param left Texto à esquerda
   * @param right Texto à direita
   * @param width Largura total da linha em colunas (32 para 58mm, 42 ou 48 para 80mm)
   */
  line(left: string, right: string, width: number = 32): this {
    const cleanLeft = left.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cleanRight = right.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const spacesNeeded = width - cleanLeft.length - cleanRight.length;
    if (spacesNeeded > 0) {
      this.text(cleanLeft + " ".repeat(spacesNeeded) + cleanRight);
    } else {
      this.text(cleanLeft + " " + cleanRight);
    }
    return this.feed(1);
  }

  /**
   * Linha divisória horizontal (ex: "--------------------------------")
   */
  divider(char: string = "-", width: number = 32): this {
    return this.textLine(char.repeat(width));
  }

  /**
   * LF (0x0A) : Alimentação de papel (quebra de linha)
   */
  feed(lines: number = 1): this {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0A);
    }
    return this;
  }

  /**
   * GS V m : Corte de papel (0x41 com feed = corte parcial padronizado)
   */
  cut(fullCut: boolean = false): this {
    // 0x00 para corte total, 0x41 + 0x03 para avanço de 3 linhas e corte parcial
    if (fullCut) {
      this.buffer.push(0x1D, 0x56, 0x00);
    } else {
      this.buffer.push(0x1D, 0x56, 0x41, 0x03);
    }
    return this;
  }

  /**
   * Injeta bytes brutos diretamente no buffer
   */
  raw(bytes: number[] | Uint8Array): this {
    this.buffer.push(...Array.from(bytes));
    return this;
  }

  /**
   * GS ( k : Desenha QR Code Nativo via comandos ESC/POS (Function 165 a 181).
   * Modelo 2, com correção de erro nível L (0x30) para manter o quadro enxuto
   * e rápida leitura pelas câmeras dos apps de bancos.
   * 
   * @param payloadPix String de dados do QR Code (ex: payload Pix BR Code EMVCo)
   * @param size Tamanho do módulo em pontos (padrão 6, excelente leitura em 58mm e 80mm)
   */
  qrCode(payloadPix: string, size: number = 6): this {
    const encoder = new TextEncoder();
    const bytes = Array.from(encoder.encode(payloadPix));

    // O comprimento dos dados precisa incluir 3 bytes do cabeçalho de envio (0x31, 0x50, 0x30)
    const dataLen = bytes.length + 3;
    const pL = dataLen % 256; // Byte de baixa ordem
    const pH = Math.floor(dataLen / 256); // Byte de alta ordem

    this.buffer.push(
      // 1. Define o Modelo do QR Code (Modelo 2 é o padrão moderno)
      0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,

      // 2. Define o Tamanho do Módulo (Pixel) - 6 costuma ter excelente leitura
      0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, size,

      // 3. Define a Correção de Erro (0x30 = L (7%), 0x31 = M (15%))
      // O Pix costuma ser grande, então L (0x30) mantém o quadro menor e fácil de ler
      0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30,

      // 4. Armazena o Payload de Dados na Memória da Impressora
      0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30, ...bytes,

      // 5. Imprime fisicamente o QR Code
      0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30
    );

    return this;
  }

  /**
   * Exporta o payload final consolidado como Uint8Array pronto para Web Serial / Bluetooth / TCP
   */
  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}
