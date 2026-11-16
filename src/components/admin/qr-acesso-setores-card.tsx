"use client";

import React, { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Copy,
  KeyRound,
  Loader2,
  Lock,
  Printer,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { functions } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { moduloAtivo } from "@/lib/modules";
import {
  lerTokenQrSetorCache,
  limparTokenQrSetorCache,
  montarUrlQrAcessoSetor,
  salvarTokenQrSetorCache,
} from "@/lib/qr-acesso-setor";
import type { SetorQrAcesso } from "@/types";

interface QrAcessoSetoresCardProps {
  restauranteId: string;
  nomeRestaurante: string;
}

interface ModalQrSetorState {
  setor: SetorQrAcesso;
  token: string;
  versao: number;
}

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const META_SETORES: Array<{
  setor: SetorQrAcesso;
  titulo: string;
  subtitulo: string;
  observacao: string;
}> = [
  {
    setor: "cozinha",
    titulo: "QR Cozinha (KDS)",
    subtitulo: "Módulo Chef • Liberado no Free",
    observacao:
      "Cole na parede da cozinha ou abra no tablet da expedição para login direto no KDS sem usar a senha do dono.",
  },
  {
    setor: "garcom",
    titulo: "QR Salão / Garçom",
    subtitulo: "Disponível na versão Pro",
    observacao:
      "Acesso rápido do salão para lançar pedidos e acompanhar mesas diretamente pelo celular.",
  },
  {
    setor: "admin",
    titulo: "QR Administração (Opcional)",
    subtitulo: "Acesso rápido para caixa • Desativado por padrão",
    observacao:
      "Alternativa prática ao login com e-mail/senha no caixa ou balcão. Nunca exponha no salão; regenere ou desative quando quiser.",
  },
];

export function QrAcessoSetoresCard({
  restauranteId,
  nomeRestaurante,
}: QrAcessoSetoresCardProps) {
  const { restaurante } = useAuth();
  const [tokensSessao, setTokensSessao] = useState<Partial<Record<SetorQrAcesso, string>>>({});
  const [setorProcessando, setSetorProcessando] = useState<SetorQrAcesso | null>(null);
  const [modalQr, setModalQr] = useState<ModalQrSetorState | null>(null);
  const [linkCopiadoSetor, setLinkCopiadoSetor] = useState<SetorQrAcesso | null>(null);
  const [mensagemStatus, setMensagemStatus] = useState<string | null>(null);
  const [erroStatus, setErroStatus] = useState<string | null>(null);

  const acessosSetores = restaurante?.acessosSetores || {};
  const salaoProLiberado = moduloAtivo("mod.garcom_salao");
  const originAtual = typeof window !== "undefined" ? window.location.origin : "https://mayamenu.app";

  // Sincroniza tokens armazenados apenas na sessão atual quando a versão coincide com a do servidor.
  useEffect(() => {
    if (!restauranteId) return;
    const setores: SetorQrAcesso[] = ["cozinha", "garcom", "admin"];
    const restaurados: Partial<Record<SetorQrAcesso, string>> = {};

    for (const setor of setores) {
      const info = acessosSetores[setor];
      if (info?.ativo === true && typeof info.versao === "number") {
        const cached = lerTokenQrSetorCache(restauranteId, setor, info.versao);
        if (cached) {
          restaurados[setor] = cached;
        }
      } else {
        limparTokenQrSetorCache(restauranteId, setor);
      }
    }

    setTokensSessao(restaurados);
  }, [
    restauranteId,
    acessosSetores.cozinha?.ativo,
    acessosSetores.cozinha?.versao,
    acessosSetores.garcom?.ativo,
    acessosSetores.garcom?.versao,
    acessosSetores.admin?.ativo,
    acessosSetores.admin?.versao,
  ]);

  const handleAcaoSetor = async (
    setor: SetorQrAcesso,
    acao: "emitir" | "rotacionar" | "revogar"
  ) => {
    if (setor === "garcom" && !salaoProLiberado) {
      setErroStatus("O QR de Acesso do Salão / Garçom está disponível na versão Pro.");
      return;
    }

    setSetorProcessando(setor);
    setErroStatus(null);
    setMensagemStatus(null);

    try {
      const gerenciarFn = httpsCallable(functions, "gerenciarQrAcessoSetor");
      const res = await gerenciarFn({ restauranteId, setor, acao });
      const data = (res.data || {}) as {
        sucesso?: boolean;
        ativo?: boolean;
        versao?: number;
        token?: string;
      };

      if (acao === "revogar") {
        limparTokenQrSetorCache(restauranteId, setor);
        setTokensSessao((prev) => {
          const next = { ...prev };
          delete next[setor];
          return next;
        });
        if (modalQr?.setor === setor) setModalQr(null);
        setMensagemStatus(
          `QR do setor ${setor === "cozinha" ? "Cozinha" : setor === "garcom" ? "Salão / Garçom" : "Administração"} desativado com sucesso.`
        );
      } else if (data.token) {
        const versaoNova = typeof data.versao === "number" ? data.versao : 1;
        salvarTokenQrSetorCache(restauranteId, setor, data.token, versaoNova);
        setTokensSessao((prev) => ({ ...prev, [setor]: data.token! }));
        setModalQr({ setor, token: data.token, versao: versaoNova });
        setMensagemStatus(
          acao === "rotacionar"
            ? "Novo QR gerado! O QR anterior foi invalidado imediatamente."
            : "QR de acesso do setor gerado e pronto para uso."
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar QR Code do setor.";
      setErroStatus(msg);
    } finally {
      setSetorProcessando(null);
    }
  };

  const handleCopiarLink = async (setor: SetorQrAcesso, token: string) => {
    try {
      const url = montarUrlQrAcessoSetor(originAtual, setor, restauranteId, token);
      await navigator.clipboard.writeText(url);
      setLinkCopiadoSetor(setor);
      setTimeout(() => setLinkCopiadoSetor(null), 2500);
    } catch {
      setErroStatus("Não foi possível copiar o link automaticamente.");
    }
  };

  const handleImprimirCartazQr = (setor: SetorQrAcesso, versao: number) => {
    const svgEl = document.querySelector("#qr-setor-imprimivel svg");
    if (!svgEl) return;

    const tituloSetor =
      setor === "cozinha"
        ? "ACESSO RÁPIDO — COZINHA (KDS)"
        : setor === "garcom"
          ? "ACESSO RÁPIDO — SALÃO / GARÇOM"
          : "ACESSO RÁPIDO — ADMINISTRAÇÃO (USO INTERNO)";
    const avisoRodape =
      setor === "admin"
        ? "RESTRITO AO CAIXA / GERÊNCIA — Nunca deixe este QR visível ao público."
        : "Aponte a câmera do tablet ou celular para abrir direto o terminal deste setor.";

    const janela = window.open("", "_blank", "width=480,height=640");
    if (!janela) return;

    janela.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(tituloSetor)} - ${escapeHtml(nomeRestaurante)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fff; color: #111; }
    .card { border: 2px solid #222; border-radius: 20px; padding: 28px; text-align: center; max-width: 340px; width: 100%; }
    .rest { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-bottom: 6px; }
    .title { font-size: 17px; font-weight: 900; margin: 0 0 18px 0; }
    .qr-box { display: inline-block; padding: 14px; border: 1px solid #ddd; border-radius: 14px; background: #fff; }
    .meta { margin-top: 14px; font-size: 11px; color: #444; font-weight: 700; }
    .warn { margin-top: 10px; font-size: 11px; color: ${setor === "admin" ? "#b91c1c" : "#555"}; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="card">
    <div class="rest">${escapeHtml(nomeRestaurante)}</div>
    <h1 class="title">${escapeHtml(tituloSetor)}</h1>
    <div class="qr-box">${svgEl.outerHTML}</div>
    <div class="meta">Versão de segurança v${versao}</div>
    <p class="warn">${escapeHtml(avisoRodape)}</p>
  </div>
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`);
    janela.document.close();
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h3 className="text-xs font-black uppercase text-foreground tracking-wider flex items-center gap-2">
            <QrCode className="w-4 h-4 text-rose-500" />
            <span>QRs de Acesso Rápido por Setor</span>
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Gere QRs pré-criados para Cozinha, Salão ou Administração rápida — sem expor sua senha principal e com regeneração instantânea.
          </p>
        </div>
        <Badge
          variant="outline"
          className="text-[10px] font-bold px-2.5 py-0.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 w-fit"
        >
          Proteção SHA-256 + Rotação
        </Badge>
      </div>

      {mensagemStatus && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{mensagemStatus}</span>
        </div>
      )}

      {erroStatus && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{erroStatus}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {META_SETORES.map((cfg) => {
          const info = acessosSetores[cfg.setor];
          const ativo = info?.ativo === true;
          const versao = typeof info?.versao === "number" ? info.versao : 0;
          const tokenCache = tokensSessao[cfg.setor] || null;
          const bloqueadoPro = cfg.setor === "garcom" && !salaoProLiberado;
          const ocupando = setorProcessando === cfg.setor;

          return (
            <div
              key={cfg.setor}
              className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                bloqueadoPro
                  ? "border-border/70 bg-muted/20 opacity-85"
                  : ativo
                    ? "border-emerald-500/35 bg-emerald-500/[0.03]"
                    : "border-border bg-muted/20"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        cfg.setor === "cozinha"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : cfg.setor === "garcom"
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            : "bg-slate-500/15 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {cfg.setor === "cozinha" ? (
                        <ChefHat className="w-4 h-4" />
                      ) : cfg.setor === "garcom" ? (
                        <UtensilsCrossed className="w-4 h-4" />
                      ) : (
                        <KeyRound className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-foreground">{cfg.titulo}</h4>
                      <span
                        className={`text-[10px] font-bold block ${
                          bloqueadoPro
                            ? "text-amber-600 dark:text-amber-400"
                            : cfg.setor === "cozinha"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {cfg.subtitulo}
                      </span>
                    </div>
                  </div>

                  {bloqueadoPro ? (
                    <Badge
                      title="Disponível na versão Pro"
                      className="bg-amber-500 text-neutral-950 font-black text-[9px] uppercase px-2 py-0.5 shrink-0"
                    >
                      PRO
                    </Badge>
                  ) : ativo ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold text-[10px] px-2 py-0.5 shrink-0">
                      Ativo v{versao}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold text-muted-foreground px-2 py-0.5 shrink-0"
                    >
                      Desativado
                    </Badge>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {cfg.observacao}
                </p>

                {cfg.setor === "admin" && ativo && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-[10px] font-semibold flex items-start gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Mantenha restrito ao caixa/gerência. Regenerar invalida o QR antigo.</span>
                  </div>
                )}

                {ativo && !bloqueadoPro && !tokenCache && (
                  <p className="text-[10px] text-muted-foreground bg-card border border-border rounded-lg p-2">
                    QR ativo (v{versao}). Por segurança, o código secreto não fica salvo após sair da sessão — clique em <strong>Regenerar QR</strong> para emitir outro cartaz.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
                {bloqueadoPro ? (
                  <Button
                    type="button"
                    disabled
                    title="Disponível na versão Pro"
                    className="w-full h-9 text-[11px] font-bold rounded-xl bg-muted text-muted-foreground cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Disponível na versão Pro</span>
                  </Button>
                ) : !ativo ? (
                  <Button
                    type="button"
                    disabled={ocupando}
                    onClick={() => handleAcaoSetor(cfg.setor, "emitir")}
                    className={`w-full h-9 text-[11px] font-black rounded-xl flex items-center justify-center gap-1.5 ${
                      cfg.setor === "admin"
                        ? "bg-slate-800 hover:bg-slate-700 text-white"
                        : "bg-rose-600 hover:bg-rose-500 text-white"
                    }`}
                  >
                    {ocupando ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <QrCode className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {cfg.setor === "admin"
                        ? "Ativar e Gerar QR Admin"
                        : "Gerar QR do Setor"}
                    </span>
                  </Button>
                ) : (
                  <>
                    {tokenCache && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setModalQr({ setor: cfg.setor, token: tokenCache, versao })
                          }
                          className="flex-1 h-8 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5 text-rose-500" />
                          <span>Ver / Imprimir</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleCopiarLink(cfg.setor, tokenCache)}
                          className="h-8 px-2.5 text-[11px] font-bold rounded-xl flex items-center gap-1"
                          title="Copiar link completo do QR"
                        >
                          {linkCopiadoSetor === cfg.setor ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{linkCopiadoSetor === cfg.setor ? "Copiado" : "Link"}</span>
                        </Button>
                      </>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      disabled={ocupando}
                      onClick={() => handleAcaoSetor(cfg.setor, "rotacionar")}
                      className="flex-1 h-8 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                      title="Invalida o QR atual e cria um novo imediatamente"
                    >
                      {ocupando ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Regenerar</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={ocupando}
                      onClick={() => handleAcaoSetor(cfg.setor, "revogar")}
                      className="h-8 px-2.5 text-[11px] font-bold rounded-xl border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex items-center gap-1"
                      title="Desativa imediatamente o acesso por QR deste setor"
                    >
                      <ShieldOff className="w-3.5 h-3.5" />
                      <span>Desativar</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DO QR DO SETOR PARA IMPRESSÃO / COMPARTILHAMENTO */}
      <Dialog open={Boolean(modalQr)} onOpenChange={(open) => !open && setModalQr(null)}>
        <DialogContent className="max-w-sm bg-card border-border text-foreground rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="text-center sm:text-center pb-1">
            <DialogTitle className="text-base font-black text-foreground flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>
                {modalQr?.setor === "cozinha"
                  ? "QR de Acesso — Cozinha (KDS)"
                  : modalQr?.setor === "garcom"
                    ? "QR de Acesso — Salão / Garçom"
                    : "QR de Acesso — Administração"}
              </span>
            </DialogTitle>
          </DialogHeader>

          {modalQr && (
            <div className="space-y-4">
              <div
                id="qr-setor-imprimivel"
                className="bg-white text-neutral-900 border-2 border-neutral-300 rounded-3xl p-5 flex flex-col items-center text-center space-y-3"
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                  {nomeRestaurante}
                </span>

                <div className="p-3 bg-white border-2 border-neutral-200 rounded-2xl">
                  <QRCodeSVG
                    value={montarUrlQrAcessoSetor(
                      originAtual,
                      modalQr.setor,
                      restauranteId,
                      modalQr.token
                    )}
                    size={180}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                <Badge className="bg-neutral-100 text-neutral-800 border-neutral-300 text-[10px] font-black">
                  Versão v{modalQr.versao}
                </Badge>

                <p className="text-[11px] font-semibold text-neutral-600 leading-relaxed">
                  {modalQr.setor === "admin"
                    ? "Uso exclusivo do caixa ou gerência. Caso alguém não autorizado fotografe este QR, clique em Regenerar ou Desativar."
                    : "Aponte a câmera do celular ou tablet do setor para entrar direto no sistema. Regenerar invalida este código imediatamente."}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => handleImprimirCartazQr(modalQr.setor, modalQr.versao)}
                  className="flex-1 h-10 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir QR</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCopiarLink(modalQr.setor, modalQr.token)}
                  className="h-10 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5"
                >
                  {linkCopiadoSetor === modalQr.setor ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>{linkCopiadoSetor === modalQr.setor ? "Copiado" : "Copiar Link"}</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
