"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { db, functions } from "@/lib/firebase";
import { collection, onSnapshot, query, doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  UserPlus,
  Trash2,
  ChefHat,
  UtensilsCrossed,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Camera,
  Printer,
  Upload,
  User,
  Sparkles,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Dices,
  ExternalLink,
  Edit3,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { uploadFotoEquipe } from "@/lib/storage-service";

function gerarPinOperacionalSeguro(): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Gerador criptográfico indisponível para gerar PIN.");
  }
  const limite = Math.floor(0x100000000 / 9000) * 9000;
  const valor = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(valor);
  } while (valor[0] >= limite);
  return String(1000 + (valor[0] % 9000));
}

export interface MembroEquipe {
  id: string;
  uid: string;
  email: string;
  nome: string;
  role: "garcom" | "cozinha";
  pin?: string;
  pinHash?: string;
  fotoUrl?: string;
  crachaToken?: string;
  atualizadoEm?: any;
}

interface GestaoEquipeProps {
  restauranteId: string;
  nomeRestaurante?: string;
}

export function GestaoEquipe({ restauranteId, nomeRestaurante = "MAYaMenu" }: GestaoEquipeProps) {
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Campos do formulário
  const [nomeNovo, setNomeNovo] = useState("");
  const [pinNovo, setPinNovo] = useState("");
  const [emailNovo, setEmailNovo] = useState("");
  const [roleNovo, setRoleNovo] = useState<"garcom" | "cozinha">("garcom");
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);

  const [processando, setProcessando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  // Controle de visibilidade de PINs
  const [mostrarPinsGlobais, setMostrarPinsGlobais] = useState(false);
  const [pinsVisiveisIndividuais, setPinsVisiveisIndividuais] = useState<Record<string, boolean>>({});

  // Modal do Crachá
  const [membroSelecionadoCracha, setMembroSelecionadoCracha] = useState<MembroEquipe | null>(null);

  // Modal de Alteração Rápida de PIN
  const [membroEditandoPin, setMembroEditandoPin] = useState<MembroEquipe | null>(null);
  const [novoPinValor, setNovoPinValor] = useState("");
  const [salvandoPin, setSalvandoPin] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Escuta lista de colaboradores em tempo real no Firestore
  useEffect(() => {
    if (!restauranteId) return;

    const colRef = collection(db, "restaurantes", restauranteId, "equipe");
    const q = query(colRef);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const membros: MembroEquipe[] = [];
        snap.forEach((docSnap) => {
          membros.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<MembroEquipe, "id">),
          });
        });
        setEquipe(membros);
        setCarregando(false);
      },
      (err) => {
        console.warn("Aviso ao carregar equipe:", err);
        setCarregando(false);
      }
    );

    return () => unsub();
  }, [restauranteId]);

  const handleSelecionarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setArquivoFoto(file);
      setPreviewFoto(URL.createObjectURL(file));
    }
  };

  const handleGerarPinAleatorio = () => {
    try {
      setPinNovo(gerarPinOperacionalSeguro());
    } catch (err) {
      setMensagemErro(err instanceof Error ? err.message : "Não foi possível gerar um PIN seguro.");
    }
  };

  const togglePinVisivel = (id: string) => {
    setPinsVisiveisIndividuais((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleAdicionarMembro = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagemSucesso(null);
    setMensagemErro(null);

    const nomeLimpo = nomeNovo.trim();
    if (!nomeLimpo) {
      setMensagemErro("Informe o nome ou apelido do colaborador.");
      return;
    }

    // Validação do PIN numérico (4 a 6 dígitos)
    let pinLimpo = pinNovo.trim();
    if (!pinLimpo) {
      // Se não informou PIN, gera automaticamente um PIN de 4 dígitos
      try {
        pinLimpo = gerarPinOperacionalSeguro();
      } catch (err) {
        setMensagemErro(err instanceof Error ? err.message : "Não foi possível gerar um PIN seguro.");
        return;
      }
    } else if (!/^\d{4,6}$/.test(pinLimpo)) {
      setMensagemErro("O PIN deve conter de 4 a 6 dígitos numéricos (apenas números).");
      return;
    }

    // Se não forneceu e-mail, gera um login operacional com base no apelido
    const usuarioSlug = nomeLimpo.toLowerCase().replace(/[^a-z0-9]/g, "");
    const emailLimpo =
      emailNovo.trim().toLowerCase() ||
      `${usuarioSlug || "staff"}@${restauranteId.slice(0, 10)}.mayamenu.local`;

    setProcessando(true);
    try {
      let fotoUrlUpload: string | undefined = undefined;

      // 1. Upload de foto se fornecida
      if (arquivoFoto) {
        try {
          fotoUrlUpload = await uploadFotoEquipe(restauranteId, arquivoFoto);
        } catch (uploadErr) {
          console.warn("Falha no upload da foto, cadastrando sem foto:", uploadErr);
        }
      }

      // 2. Chama a Cloud Function com criação automática de usuário no Firebase Auth
      const setStaffRoleFn = httpsCallable(functions, "setStaffRole");
      const resp: any = await setStaffRoleFn({
        restauranteId,
        nome: nomeLimpo,
        email: emailLimpo,
        pin: pinLimpo, // PIN operacional; nunca é reutilizado como senha Firebase
        role: roleNovo,
        fotoUrl: fotoUrlUpload,
      });

      if (resp.data?.sucesso) {
        setMensagemSucesso(
          `Colaborador ${nomeLimpo} (${roleNovo === "garcom" ? "Garçom" : "Cozinha"}) cadastrado com sucesso! PIN de acesso configurado.`
        );
        setNomeNovo("");
        setPinNovo("");
        setEmailNovo("");
        setArquivoFoto(null);
        setPreviewFoto(null);
      } else {
        setMensagemErro("Não foi possível concluir o cadastro.");
      }
    } catch (err: any) {
      console.error("Erro ao adicionar membro:", err);
      setMensagemErro(err?.message || "Erro ao conectar com o serviço de equipe.");
    } finally {
      setProcessando(false);
    }
  };

  const handleRemoverMembro = async (uid: string, nome: string) => {
    if (!confirm(`Deseja revogar o acesso de ${nome}?`)) return;

    setMensagemSucesso(null);
    setMensagemErro(null);

    try {
      const removeStaffFn = httpsCallable(functions, "removeStaffMember");
      await removeStaffFn({
        restauranteId,
        uid,
      });
      setMensagemSucesso(`Acesso de ${nome} revogado.`);
    } catch (err: any) {
      console.error("Erro ao remover membro:", err);
      setMensagemErro(err?.message || "Falha ao revogar acesso do colaborador.");
    }
  };

  const handleAbrirAlterarPin = (membro: MembroEquipe) => {
    setMembroEditandoPin(membro);
    setNovoPinValor("");
  };

  const handleSalvarNovoPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membroEditandoPin) return;

    const pinLimpo = novoPinValor.trim();
    if (!/^\d{4,6}$/.test(pinLimpo)) {
      alert("O PIN deve conter de 4 a 6 dígitos numéricos.");
      return;
    }

    setSalvandoPin(true);
    try {
      // Chama a Cloud Function para hash com salt seguro e sincronização
      const atualizarPinFn = httpsCallable(functions, "atualizarPinColaborador");
      await atualizarPinFn({
        restauranteId,
        membroUid: membroEditandoPin.uid || membroEditandoPin.id,
        novoPin: pinLimpo,
      });

      setMensagemSucesso(`PIN de ${membroEditandoPin.nome} atualizado com sucesso!`);
      setMembroEditandoPin(null);
      setNovoPinValor("");
    } catch (err: any) {
      console.error("Erro ao atualizar PIN:", err);
      const codigo = typeof err?.code === "string" && err.code ? `[${err.code}] ` : "";
      const detalhe = err?.message || "Erro ao atualizar PIN do colaborador.";
      alert(`${codigo}${detalhe}`);
    } finally {
      setSalvandoPin(false);
    }
  };

  const handleImprimirCracha = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DA SEÇÃO */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-rose-600" />
              <h2 className="text-base font-black tracking-tight">Equipe, Garçons & Acessos por PIN</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Cadastre garçons e cozinheiros com nome e <strong>PIN numérico de 4 a 6 dígitos</strong>. O sistema gera automaticamente o login rápido e o <strong>Crachá Digital com QR Code</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* BOTÃO ATALHO PARA O APP DO GARÇOM */}
            <Link href={restauranteId ? `/garcom?r=${encodeURIComponent(restauranteId)}` : "/garcom"} target="_blank">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 text-xs font-bold h-9 px-3 rounded-xl flex items-center gap-1.5 shadow-2xs"
                title="Abrir o Terminal do Garçom em nova aba"
              >
                <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-600" />
                <span>Abrir Terminal Garçom</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </Button>
            </Link>

            {/* BOTÃO ATALHO PARA A COZINHA */}
            <Link href={restauranteId ? `/cozinha?r=${encodeURIComponent(restauranteId)}` : "/cozinha"} target="_blank">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-800 text-xs font-bold h-9 px-3 rounded-xl flex items-center gap-1.5 shadow-2xs"
                title="Abrir o KDS da Cozinha em nova aba"
              >
                <ChefHat className="w-3.5 h-3.5 text-amber-600" />
                <span>Abrir KDS Cozinha</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </Button>
            </Link>
          </div>
        </div>

        {/* FEEDBACKS */}
        {mensagemSucesso && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{mensagemSucesso}</span>
          </div>
        )}

        {mensagemErro && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{mensagemErro}</span>
          </div>
        )}

        {/* FORMULÁRIO DE ADIÇÃO COM FOCO EM NOME + PIN NUMÉRICO */}
        <form onSubmit={handleAdicionarMembro} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
            {/* FOTO / AVATAR */}
            <div className="sm:col-span-3 flex flex-col items-center sm:items-start gap-2">
              <label className="text-[11px] font-black uppercase text-muted-foreground block text-center sm:text-left">
                Foto do Crachá
              </label>

              <div className="relative group w-24 h-24 rounded-2xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                {previewFoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewFoto} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-muted-foreground/40" />
                )}
              </div>

              <div className="flex items-center gap-1.5 w-full">
                {/* Botão Câmera (Tirar Foto) */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                  className="h-8 px-2 text-[10px] font-bold rounded-lg flex-1 flex items-center justify-center gap-1"
                  title="Tirar foto com a câmera"
                >
                  <Camera className="w-3.5 h-3.5 text-rose-600" />
                  <span>Câmera</span>
                </Button>

                {/* Botão Upload (Galeria) */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 px-2 text-[10px] font-bold rounded-lg flex-1 flex items-center justify-center gap-1"
                  title="Fazer upload de arquivo"
                >
                  <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Arquivo</span>
                </Button>

                {/* Inputs ocultos */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleSelecionarArquivo}
                  className="hidden"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSelecionarArquivo}
                  className="hidden"
                />
              </div>
            </div>

            {/* CAMPOS DE TEXTO */}
            <div className="sm:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
                  Nome / Apelido do Colaborador *
                </label>
                <Input
                  type="text"
                  value={nomeNovo}
                  onChange={(e) => setNomeNovo(e.target.value)}
                  placeholder="ex: Carlos Garçom, Marcos, Ana"
                  className="h-10 text-xs rounded-xl font-bold"
                  disabled={processando}
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
                  Função / Cargo *
                </label>
                <select
                  value={roleNovo}
                  onChange={(e) => setRoleNovo(e.target.value as "garcom" | "cozinha")}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-ring"
                  disabled={processando}
                >
                  <option value="garcom">🍽️ Garçom (Salão, Mesas & Comandas)</option>
                  <option value="cozinha">👨‍🍳 Cozinha (KDS & Produção de Pratos)</option>
                </select>
              </div>

              {/* CAMPO DE PIN NUMÉRICO (4 A 6 DÍGITOS) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-black uppercase text-muted-foreground flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-rose-600" />
                    <span>PIN Numérico (4 a 6 dígitos) *</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGerarPinAleatorio}
                    className="text-[10px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 underline underline-offset-2"
                    title="Gerar 4 números aleatórios"
                  >
                    <Dices className="w-3 h-3" />
                    <span>Gerar PIN</span>
                  </button>
                </div>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pinNovo}
                  onChange={(e) => setPinNovo(e.target.value.replace(/\D/g, ""))}
                  placeholder="4 a 6 dígitos"
                  className="h-10 text-xs font-mono font-bold tracking-widest rounded-xl"
                  disabled={processando}
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Usado para o garçom desbloquear a tela no salão em segundos.
                </span>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
                  E-mail (Opcional - gerado automaticamente)
                </label>
                <Input
                  type="email"
                  value={emailNovo}
                  onChange={(e) => setEmailNovo(e.target.value)}
                  placeholder="ex: carlos@restaurante.com (ou deixe em branco)"
                  className="h-10 text-xs rounded-xl"
                  disabled={processando}
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Se vazio, o sistema cria o login técnico automaticamente.
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-border">
            <Button
              type="submit"
              disabled={processando}
              className="h-10 px-6 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
            >
              {processando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cadastrando & Gerando Crachá...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Cadastrar Colaborador & Salvar PIN</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* LISTA DE MEMBROS E EMISSÃO DE CRACHÁS */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black uppercase text-muted-foreground tracking-wider">
            Colaboradores Ativos ({equipe.length})
          </h3>

          {equipe.length > 0 && (
            <button
              type="button"
              onClick={() => setMostrarPinsGlobais(!mostrarPinsGlobais)}
              className="text-xs text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1.5 transition-colors"
            >
              {mostrarPinsGlobais ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Ocultar Todos os PINs</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Ver Todos os PINs</span>
                </>
              )}
            </button>
          )}
        </div>

        {carregando ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
            <p className="text-xs font-bold text-muted-foreground">Carregando colaboradores...</p>
          </div>
        ) : equipe.length === 0 ? (
          <div className="py-10 text-center border-2 border-dashed border-border rounded-xl">
            <Users className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs font-bold text-muted-foreground">Nenhum colaborador cadastrado ainda.</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">
              Cadastre seus garçons e cozinheiros com nome e PIN para liberar o terminal do salão.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {equipe.map((membro) => {
              const isGarcom = membro.role === "garcom";
              const pinConfigurado = Boolean(membro.pinHash || membro.pin);
              const pinVisivel = Boolean(membro.pin) && (mostrarPinsGlobais || pinsVisiveisIndividuais[membro.id]);

              return (
                <div
                  key={membro.id}
                  className="p-3.5 rounded-xl border border-border bg-muted/30 flex items-center justify-between gap-3 hover:border-border/80 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-border bg-card flex items-center justify-center shadow-xs">
                      {membro.fotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={membro.fotoUrl} alt={membro.nome} className="w-full h-full object-cover" />
                      ) : isGarcom ? (
                        <UtensilsCrossed className="w-5 h-5 text-amber-500" />
                      ) : (
                        <ChefHat className="w-5 h-5 text-rose-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-black truncate">{membro.nome || membro.email}</p>
                        <Badge
                          className={`text-[9px] font-black uppercase px-1.5 py-0 ${
                            isGarcom
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                              : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {isGarcom ? "Garçom" : "Cozinha"}
                        </Badge>
                      </div>

                      {/* EXIBIÇÃO DO ESTADO DO PIN COM BOTÃO DE ALTERAR */}
                      <div className="flex items-center gap-2 mt-1">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-background border border-border text-[11px] font-mono font-bold text-foreground">
                          <KeyRound className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>PIN:</span>
                          <span className="tracking-wide">
                            {pinVisivel
                              ? membro.pin
                              : pinConfigurado
                              ? "Configurado (hash)"
                              : "Não configurado"}
                          </span>
                        </div>

                        {membro.pin && (
                          <button
                            type="button"
                            onClick={() => togglePinVisivel(membro.id)}
                            className="text-muted-foreground hover:text-foreground text-xs p-0.5"
                            title={pinVisivel ? "Ocultar PIN" : "Ver PIN"}
                          >
                            {pinVisivel ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleAbrirAlterarPin(membro)}
                          className="text-rose-600 hover:text-rose-700 text-[10px] font-bold underline underline-offset-2 flex items-center gap-0.5"
                          title="Alterar PIN deste colaborador"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Trocar</span>
                        </button>
                      </div>

                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{membro.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* BOTÃO VER CRACHÁ */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMembroSelecionadoCracha(membro)}
                      className="h-8 px-2.5 rounded-lg text-xs font-bold border-border bg-card hover:bg-muted text-foreground flex items-center gap-1"
                      title="Ver e Imprimir Crachá com QR Code"
                    >
                      <QrCode className="w-3.5 h-3.5 text-primary" />
                      <span className="hidden sm:inline">Crachá</span>
                    </Button>

                    {/* BOTÃO REMOVER */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoverMembro(membro.uid, membro.nome)}
                      className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg"
                      title="Revogar acesso"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE ALTERAÇÃO RÁPIDA DE PIN */}
      <Dialog
        open={Boolean(membroEditandoPin)}
        onOpenChange={(open) => !open && setMembroEditandoPin(null)}
      >
        <DialogContent className="max-w-xs bg-card border-border text-foreground rounded-3xl p-5 shadow-2xl">
          <DialogHeader className="text-center sm:text-center pb-2">
            <DialogTitle className="text-sm font-black text-foreground flex items-center justify-center gap-2">
              <KeyRound className="w-4 h-4 text-rose-600" />
              <span>Alterar PIN de Acesso</span>
            </DialogTitle>
          </DialogHeader>

          {membroEditandoPin && (
            <form onSubmit={handleSalvarNovoPin} className="space-y-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  Defina um novo PIN numérico (4 a 6 dígitos) para:
                </p>
                <p className="text-sm font-black text-foreground mt-0.5">
                  {membroEditandoPin.nome}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-muted-foreground">Novo PIN:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const p = Math.floor(1000 + Math.random() * 9000).toString();
                      setNovoPinValor(p);
                    }}
                    className="text-[10px] text-rose-600 font-bold underline"
                  >
                    Gerar 4 Dígitos
                  </button>
                </div>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={novoPinValor}
                  onChange={(e) => setNovoPinValor(e.target.value.replace(/\D/g, ""))}
                  placeholder="Ex: 5678"
                  className="h-10 text-center font-mono font-black text-base tracking-widest rounded-xl"
                  autoFocus
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMembroEditandoPin(null)}
                  className="flex-1 h-10 text-xs font-bold rounded-xl"
                  disabled={salvandoPin}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvandoPin || !/^\d{4,6}$/.test(novoPinValor.trim())}
                  className="flex-1 h-10 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  {salvandoPin ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    "Salvar PIN"
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE VISUALIZAÇÃO E IMPRESSÃO DO CRACHÁ */}
      <Dialog
        open={Boolean(membroSelecionadoCracha)}
        onOpenChange={(open) => !open && setMembroSelecionadoCracha(null)}
      >
        <DialogContent className="max-w-sm bg-card border-border text-foreground rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="text-center sm:text-center pb-2">
            <DialogTitle className="text-base font-black text-foreground">
              Crachá Operacional MAYaMenu
            </DialogTitle>
          </DialogHeader>

          {membroSelecionadoCracha && (
            <div className="space-y-4">
              {/* CARTÃO FÍSICO DO CRACHÁ (FORMATO ESTILIZADO) */}
              <div
                id="cracha-imprimivel"
                className="bg-white text-neutral-900 border-2 border-neutral-300 rounded-3xl p-5 shadow-lg flex flex-col items-center text-center space-y-3 relative overflow-hidden"
              >
                {/* Faixa decorativa superior */}
                <div
                  className={`w-full h-3 -mt-5 mb-2 ${
                    membroSelecionadoCracha.role === "garcom" ? "bg-amber-500" : "bg-rose-600"
                  }`}
                />

                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                  {nomeRestaurante}
                </span>

                {/* Foto do colaborador */}
                <div className="w-20 h-20 rounded-2xl border-2 border-neutral-300 overflow-hidden shadow-sm bg-neutral-100 flex items-center justify-center">
                  {membroSelecionadoCracha.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={membroSelecionadoCracha.fotoUrl}
                      alt={membroSelecionadoCracha.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-neutral-400" />
                  )}
                </div>

                <div>
                  <h4 className="text-base font-black text-neutral-950">
                    {membroSelecionadoCracha.nome}
                  </h4>
                  <Badge
                    className={`text-[10px] font-black uppercase px-2.5 py-0.5 mt-1 ${
                      membroSelecionadoCracha.role === "garcom"
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : "bg-rose-100 text-rose-800 border-rose-300"
                    }`}
                  >
                    {membroSelecionadoCracha.role === "garcom" ? "Garçom (Salão)" : "Cozinha (KDS)"}
                  </Badge>

                  {/* Estado do PIN no Crachá (sem expor nem inventar credencial) */}
                  <div className="mt-2 text-xs font-mono font-bold text-neutral-700 bg-neutral-100 px-3 py-1 rounded-xl border border-neutral-200">
                    PIN Individual:{" "}
                    <strong className="text-neutral-950">
                      {membroSelecionadoCracha.pinHash || membroSelecionadoCracha.pin
                        ? "Configurado (pessoal)"
                        : "Não configurado"}
                    </strong>
                  </div>
                </div>

                {/* QR Code de Login Direto */}
                <div className="p-2.5 bg-white border-2 border-neutral-200 rounded-2xl shadow-xs">
                  <QRCodeSVG
                    value={JSON.stringify({
                      tipo: "cracha_mayamenu",
                      restauranteId,
                      uid: membroSelecionadoCracha.uid,
                      token: membroSelecionadoCracha.crachaToken || membroSelecionadoCracha.uid,
                      role: membroSelecionadoCracha.role,
                    })}
                    size={130}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                <p className="text-[10px] font-bold text-neutral-500">
                  Aponte para a câmera do tablet para login instantâneo
                </p>
              </div>

              {/* AÇÕES: IMPRIMIR OU FECHAR */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  onClick={handleImprimirCracha}
                  className="flex-1 h-11 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Crachá</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMembroSelecionadoCracha(null)}
                  className="h-11 px-4 text-xs font-bold rounded-xl border-border text-foreground"
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
