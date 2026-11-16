"use client";

import React, { useState } from "react";
import { httpsCallable } from "firebase/functions";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquareText,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { functions } from "@/lib/firebase";

interface FaqItem {
  id: string;
  pergunta: string;
  resposta: string;
  dicaExtra?: string;
  assuntoRelacionado:
    | "duvida_planos"
    | "duvida_operacao"
    | "suporte_tecnico"
    | "comercial_pro"
    | "sugestao_lancamento";
}

const FAQ_ASSISTENTE: FaqItem[] = [
  {
    id: "planos",
    pergunta: "Como funciona o plano Free e as mesas extras (R$ 8/mês)?",
    resposta:
      "O plano Free inclui até 5 mesas grátis, cardápio digital ilimitado, Módulo Chef (KDS da cozinha + receitas + QR com PIN) e pagamentos Pix sem taxa extra. Na versão PRO são até 20 mesas, e mesas adicionais em qualquer plano custam R$ 8,00/mês (equivalente a R$ 0,27 por dia por mesa).",
    dicaExtra: "Você pode começar hoje no Free sem cartão e crescer no seu ritmo.",
    assuntoRelacionado: "duvida_planos",
  },
  {
    id: "qr_chef",
    pergunta: "Como meus cozinheiros acessam a Cozinha com QR e PIN?",
    resposta:
      "Em /admin/setup na aba Equipe & Chef, gere o QR Cozinha (KDS) e cadastre cada cozinheiro com nome e PIN de 4 a 6 dígitos. Ao apontar o telemóvel para o QR da cozinha, o funcionário escolhe o próprio nome e digita o PIN pessoal para entrar no KDS e no Espaço do Chef (/cozinha/receitas).",
    dicaExtra: "Se precisar trocar acessos, clique em Regenerar no QR do setor para invalidar o antigo na hora.",
    assuntoRelacionado: "duvida_operacao",
  },
  {
    id: "chef_receitas",
    pergunta: "O cliente vê as receitas e fichas técnicas da cozinha?",
    resposta:
      "Não. As fichas técnicas ficam protegidas em subcoleção privada da equipe e nunca aparecem no cardápio público. Os cozinheiros consultam porcionamento, preparo e pausam itens esgotados no Espaço do Chef (/cozinha/receitas), enquanto você controla os preços no Gerencial.",
    assuntoRelacionado: "duvida_operacao",
  },
  {
    id: "impressora",
    pergunta: "Quais impressoras térmicas funcionam no KDS e no caixa?",
    resposta:
      "Impressoras térmicas de bobina 58mm ou 80mm com USB (Epson, Elgin, Daruma, Bematech e compatíveis ESC/POS) conectando direto pelo botão Parear Impressora USB no KDS ou no detalhe da mesa — além da simulação PDF em Teste 80mm.",
    assuntoRelacionado: "suporte_tecnico",
  },
  {
    id: "pro_voucher",
    pergunta: "Como ativar um Voucher de parceiro ou migrar para o PRO?",
    resposta:
      "Você pode ativar códigos promocionais direto em /ativar ou clicando em Voucher / Loja & Pix em /admin/setup. Para contratação comercial ou dúvidas sobre a versão PRO, fale com nossa equipe abaixo.",
    assuntoRelacionado: "comercial_pro",
  },
];

interface EspecialistaAssistenteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nomeInicial?: string;
  emailInicial?: string;
  restauranteId?: string;
  restauranteNome?: string;
  origem?: string;
  abrirDiretoFormulario?: boolean;
}

export function EspecialistaAssistenteModal(props: EspecialistaAssistenteModalProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto bg-card border-border text-foreground rounded-3xl p-5 sm:p-6 shadow-2xl">
        {props.open ? (
          <EspecialistaAssistenteConteudo
            key={`${props.origem || "modal"}-${props.abrirDiretoFormulario ? "form" : "bot"}`}
            {...props}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EspecialistaAssistenteConteudo({
  onOpenChange,
  nomeInicial = "",
  emailInicial = "",
  restauranteId = "",
  restauranteNome = "",
  origem = "",
  abrirDiretoFormulario = false,
}: EspecialistaAssistenteModalProps) {
  const [etapa, setEtapa] = useState<"bot" | "form" | "sucesso">(
    abrirDiretoFormulario ? "form" : "bot"
  );
  const [faqSelecionada, setFaqSelecionada] = useState<FaqItem | null>(null);

  const [nome, setNome] = useState(nomeInicial);
  const [email, setEmail] = useState(emailInicial);
  const [assunto, setAssunto] = useState<FaqItem["assuntoRelacionado"]>("duvida_planos");
  const [mensagem, setMensagem] = useState("");
  const [website, setWebsite] = useState(""); // Honeypot invisível anti-bot
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [protocolo, setProtocolo] = useState<string | null>(null);

  const handleAbrirFormulario = (assuntoSugerido?: FaqItem["assuntoRelacionado"]) => {
    if (assuntoSugerido) setAssunto(assuntoSugerido);
    setErro(null);
    setEtapa("form");
  };

  const handleEnviarChamado = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (nome.trim().length < 2) {
      setErro("Informe seu nome para podermos retornar.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErro("Informe um e-mail válido.");
      return;
    }
    if (mensagem.trim().length < 10) {
      setErro("Conte em poucas palavras sua dúvida (mínimo 10 caracteres).");
      return;
    }

    setEnviando(true);
    try {
      const enviarFn = httpsCallable(functions, "enviarContatoEspecialista");
      const res = await enviarFn({
        nome: nome.trim(),
        email: email.trim(),
        assunto,
        mensagem: mensagem.trim(),
        restauranteId: restauranteId || "",
        restauranteNome: restauranteNome || "",
        origem:
          origem || (typeof window !== "undefined" ? window.location.pathname : ""),
        website,
      });

      const data = (res.data || {}) as { chamadoId?: string };
      setProtocolo(data.chamadoId || "REGISTRADO");
      setMensagem("");
      setEtapa("sucesso");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível enviar agora. Tente pelo e-mail contato@mayamenu.com.br.";
      setErro(msg);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-sm shrink-0">
              {etapa === "bot" ? (
                <Bot className="w-5 h-5" />
              ) : (
                <MessageSquareText className="w-5 h-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black">
                {etapa === "bot"
                  ? "Assistente MAYaMenu"
                  : etapa === "form"
                    ? "Falar com Especialista"
                    : "Contato Registrado"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {etapa === "bot"
                  ? "Respostas imediatas 24h ou envie sua mensagem para retorno por e-mail (sem WhatsApp)."
                  : etapa === "form"
                    ? "Nossa equipe recebe sua mensagem direto e responde no seu e-mail."
                    : "Recebemos sua solicitação com segurança."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {etapa === "bot" && (
          <div className="space-y-4 pt-2">
            {!faqSelecionada ? (
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block">
                  Escolha um tópico para resposta na hora:
                </span>
                {FAQ_ASSISTENTE.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFaqSelecionada(item)}
                    className="w-full text-left p-3 rounded-2xl border border-border bg-muted/30 hover:bg-muted/60 hover:border-rose-500/40 transition-all text-xs sm:text-sm font-bold text-foreground flex items-center justify-between gap-2"
                  >
                    <span>{item.pergunta}</span>
                    <Sparkles className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3 p-4 rounded-2xl bg-muted/35 border border-border">
                <button
                  type="button"
                  onClick={() => setFaqSelecionada(null)}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Ver outros tópicos</span>
                </button>

                <h3 className="text-sm font-black text-foreground">
                  {faqSelecionada.pergunta}
                </h3>
                <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                  {faqSelecionada.resposta}
                </p>
                {faqSelecionada.dicaExtra && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                    {faqSelecionada.dicaExtra}
                  </div>
                )}

                <div className="pt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleAbrirFormulario(faqSelecionada.assuntoRelacionado)}
                    className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                  >
                    Ainda preciso falar com um especialista
                  </Button>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                Prefere atendimento direto?
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAbrirFormulario()}
                className="h-9 px-4 rounded-xl text-xs font-black flex items-center gap-1.5"
              >
                <MessageSquareText className="w-3.5 h-3.5 text-rose-500" />
                <span>Enviar Mensagem para Especialista</span>
              </Button>
            </div>
          </div>
        )}

        {etapa === "form" && (
          <form onSubmit={handleEnviarChamado} className="space-y-3.5 pt-2">
            <button
              type="button"
              onClick={() => setEtapa("bot")}
              className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar às respostas rápidas</span>
            </button>

            {erro && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 text-xs font-semibold">
                {erro}
              </div>
            )}

            {/* Honeypot anti-spam oculto */}
            <div className="hidden" aria-hidden="true">
              <label>
                Site
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
            </div>

            {restauranteNome && (
              <Badge variant="outline" className="text-[11px] font-bold">
                Estabelecimento: {restauranteNome}
              </Badge>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
                  Seu Nome *
                </label>
                <Input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="ex: Maria Silva"
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
                  Seu E-mail *
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@restaurante.com"
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
                Assunto
              </label>
              <select
                value={assunto}
                onChange={(e) =>
                  setAssunto(e.target.value as FaqItem["assuntoRelacionado"])
                }
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="duvida_planos">Dúvidas sobre Planos Free / PRO</option>
                <option value="duvida_operacao">Operação do Salão, QR ou Cozinha</option>
                <option value="suporte_tecnico">Suporte Técnico / Impressora</option>
                <option value="comercial_pro">Falar sobre Contratação PRO / B2B</option>
                <option value="sugestao_lancamento">Feedback do Teste de Lançamento</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
                Como podemos ajudar? *
              </label>
              <textarea
                rows={4}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Descreva sua dúvida, cenário do restaurante ou feedback..."
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
              <a
                href="mailto:contato@mayamenu.com.br?subject=Contato%20MAYaMenu"
                className="text-[11px] text-muted-foreground hover:text-foreground underline flex items-center gap-1"
              >
                <Mail className="w-3 h-3" />
                <span>contato@mayamenu.com.br</span>
              </a>

              <Button
                type="submit"
                disabled={enviando}
                className="h-10 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5"
              >
                {enviando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{enviando ? "Enviando..." : "Enviar para Especialista"}</span>
              </Button>
            </div>
          </form>
        )}

        {etapa === "sucesso" && (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-foreground">
                Solicitação enviada com sucesso!
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Registramos sua mensagem{protocolo ? ` (protocolo ${protocolo})` : ""}. Retornaremos diretamente para o e-mail <strong>{email}</strong>.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-10 px-6 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
            >
              Fechar
            </Button>
          </div>
        )}
    </>
  );
}
