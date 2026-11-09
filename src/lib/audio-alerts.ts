/**
 * Gerador de Alertas Sonoros Operacionais via Web Audio API Nativa
 * 
 * Permite emitir sinais sonoros (beeps e sinos) em tablets de Garçom e KDS da Cozinha
 * sem precisar carregar arquivos .mp3/.wav externos, funcionando 100% offline
 * e instantaneamente em qualquer navegador moderno.
 */

class AudioAlertService {
  private ctx: AudioContext | null = null;
  private habilitado: boolean = true;

  constructor() {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mayamenu_audio_enabled");
      if (saved !== null) {
        this.habilitado = saved === "true";
      }
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isHabilitado(): boolean {
    return this.habilitado;
  }

  public setHabilitado(valor: boolean): void {
    this.habilitado = valor;
    if (typeof window !== "undefined") {
      localStorage.setItem("mayamenu_audio_enabled", String(valor));
    }
  }

  /**
   * Alerta de Chamado do Garçom: Sino duplo harmonioso (Ding-Dong / E5 -> C5)
   */
  public tocarChamadoGarcom(): void {
    if (!this.habilitado) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const agora = ctx.currentTime;

    // 1ª nota: Mi (659.25 Hz)
    this.tocarTom(ctx, 659.25, agora, 0.35, "sine");
    // 2ª nota: Dó (523.25 Hz)
    this.tocarTom(ctx, 523.25, agora + 0.22, 0.6, "sine");
  }

  /**
   * Alerta de Novo Pedido no KDS: Bipe duplo enérgico de cozinha (880 Hz -> 1174 Hz)
   */
  public tocarNovoPedidoKds(): void {
    if (!this.habilitado) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const agora = ctx.currentTime;

    // Beep 1: Lá (880 Hz)
    this.tocarTom(ctx, 880, agora, 0.15, "triangle");
    // Beep 2: Ré (1174.66 Hz)
    this.tocarTom(ctx, 1174.66, agora + 0.18, 0.25, "triangle");
  }

  /**
   * Alerta de Pedido Pronto: Tom ascendente de sucesso (Dó -> Mi -> Sol)
   */
  public tocarPedidoPronto(): void {
    if (!this.habilitado) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const agora = ctx.currentTime;

    this.tocarTom(ctx, 523.25, agora, 0.12, "sine"); // C5
    this.tocarTom(ctx, 659.25, agora + 0.12, 0.12, "sine"); // E5
    this.tocarTom(ctx, 783.99, agora + 0.24, 0.35, "sine"); // G5
  }

  private tocarTom(
    ctx: AudioContext,
    frequencia: number,
    tempoInicio: number,
    duracao: number,
    tipo: OscillatorType = "sine"
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = tipo;
    osc.frequency.setValueAtTime(frequencia, tempoInicio);

    // Envelope suave para evitar estalo no início e fim
    gain.gain.setValueAtTime(0.001, tempoInicio);
    gain.gain.exponentialRampToValueAtTime(0.3, tempoInicio + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, tempoInicio + duracao);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(tempoInicio);
    osc.stop(tempoInicio + duracao);
  }
}

export const audioAlertService = new AudioAlertService();

