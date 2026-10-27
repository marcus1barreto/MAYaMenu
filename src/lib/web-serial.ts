/**
 * Gerenciador de Comunicação Web Serial API (MAYaMenu)
 * 
 * Implementa auto-reconexão persistente com `navigator.serial.getPorts()`.
 * Elimina a fadiga do operador do caixa ao dispensar a abertura repetida
 * do modal nativo de seleção do Chrome a cada emissão de cupom térmico.
 */

export interface InfoImpressoraUSB {
  usbVendorId?: number;
  usbProductId?: number;
  salvoEm: number;
}

export const STORAGE_KEY_IMPRESSORA = "mayamenu_printer_usb_v1";

/**
 * Recupera metadados da última impressora térmica USB pareada.
 */
export function obterImpressoraSalva(): InfoImpressoraUSB | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_IMPRESSORA);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Registra os identificadores de hardware da impressora pareada.
 */
export function salvarImpressoraUSB(info?: { usbVendorId?: number; usbProductId?: number }): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY_IMPRESSORA,
      JSON.stringify({
        usbVendorId: info?.usbVendorId,
        usbProductId: info?.usbProductId,
        salvoEm: Date.now(),
      })
    );
  } catch {
    // Quota ou acesso negado em storage
  }
}

/**
 * Limpa o pareamento para forçar nova seleção de hardware no próximo acionamento.
 */
export function esquecerImpressoraUSB(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY_IMPRESSORA);
  } catch {
    // No-op
  }
}

/**
 * Obtém a porta serial autorizada (auto-reconexão sem modal) ou abre o modal se necessário.
 * @param forcarSelecao Se true, abre obrigatoriamente o modal nativo `requestPort()`.
 */
export async function obterPortaImpressora(forcarSelecao: boolean = false): Promise<any> {
  if (typeof window === "undefined" || !("serial" in navigator)) {
    throw new Error(
      "A Web Serial API não está disponível neste navegador. Utilize o Google Chrome, Edge ou Opera em HTTPS ou localhost."
    );
  }

  const serial = (navigator as unknown as { serial: any }).serial;

  // 1. Tenta auto-reconexão com portas já autorizadas previamente nesta origem
  if (!forcarSelecao) {
    try {
      const portasAutorizadas: any[] = await serial.getPorts();
      if (portasAutorizadas && portasAutorizadas.length > 0) {
        const salva = obterImpressoraSalva();
        if (salva?.usbVendorId) {
          const correspondente = portasAutorizadas.find((p) => {
            const info = p.getInfo?.() || {};
            return (
              info.usbVendorId === salva.usbVendorId &&
              (!salva.usbProductId || info.usbProductId === salva.usbProductId)
            );
          });
          if (correspondente) return correspondente;
        }
        // Retorna a primeira porta autorizada disponível
        return portasAutorizadas[0];
      }
    } catch (err) {
      console.warn("Falha ao consultar navigator.serial.getPorts():", err);
    }
  }

  // 2. Primeira vez ou seleção forçada: abre o modal nativo do navegador
  const port = await serial.requestPort();
  if (port?.getInfo) {
    salvarImpressoraUSB(port.getInfo());
  }
  return port;
}

/**
 * Envia o bytecode ESC/POS compilado para a porta serial (com abertura, escrita e fechamento seguro).
 */
export async function despacharParaImpressoraSerial(
  payload: Uint8Array,
  opcoes: { baudRate?: number; forcarSelecao?: boolean } = {}
): Promise<{ sucesso: boolean; reconectadoAutomaticamente: boolean }> {
  const { baudRate = 9600, forcarSelecao = false } = opcoes;

  let reconectadoAutomaticamente = false;
  let port: any;

  if (!forcarSelecao && typeof navigator !== "undefined" && "serial" in navigator) {
    try {
      const portas = await (navigator as any).serial.getPorts();
      if (portas && portas.length > 0) {
        reconectadoAutomaticamente = true;
      }
    } catch {
      // No-op
    }
  }

  port = await obterPortaImpressora(forcarSelecao);

  // Abre a porta serial se ainda não estiver aberta
  if (!port.readable || !port.writable) {
    await port.open({ baudRate });
  }

  const writer = port.writable.getWriter();
  try {
    await writer.write(payload);
  } finally {
    try {
      writer.releaseLock();
    } catch {
      // Ignora se o lock já tiver sido liberado
    }
    try {
      await port.close();
    } catch {
      // Ignora se a porta já tiver sido fechada
    }
  }

  return { sucesso: true, reconectadoAutomaticamente };
}
