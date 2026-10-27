"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Boxes,
  Layers2,
  KeyRound,
  FileSpreadsheet,
  Download,
  Lock,
  Archive,
  FileCode2,
  CheckCircle2,
  HelpCircle,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Sparkles,
  Store,
  ClockAlert,
  RotateCcw,
  BookOpen,
  MessageCircle,
  ExternalLink,
  Cpu,
  Printer,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SuperAdminFaq {
  pergunta: string;
  resposta: string;
  categoria: "licencas" | "planos" | "auditoria" | "seguranca" | "hardware";
}

const FAQS_SUPERADMIN: SuperAdminFaq[] = [
  {
    categoria: "licencas",
    pergunta: "Por que a emissão em lote limita pacotes em até 100 concessões por disparo?",
    resposta:
      "O Google Cloud Firestore impõe um limite estrito de 500 operações por transação atômica (writeBatch). O serviço de lote do MAYaMenu divide as operações em blocos seguros de 400 escritas para garantir que nenhuma transação seja abortada por 'InvalidArgumentError' e que todas as concessões recebam carimbos temporais idênticos.",
  },
  {
    categoria: "licencas",
    pergunta: "O que acontece se o lojista perder o link de ativação da concessão?",
    resposta:
      "A qualquer momento, o operador pode localizar a concessão na aba 'Concessões Ativas' ou 'Disponíveis', clicar em 'Copiar Link' ou 'WhatsApp' e reenviar o link `/ativar/MAYA-XXXX-XXXX`. Se a licença ainda não foi vinculada, o token permanece intacto e disponível.",
  },
  {
    categoria: "hardware",
    pergunta: "Como as novas impressoras USB interagem com a Web Serial API?",
    resposta:
      "O operador autoriza a porta USB uma única vez através do modal nativo do navegador (Chrome ou Edge). O sistema grava os metadados da impressora no localStorage e tenta reconectar silenciosamente a cada novo cupom, disparando bytecode ESC/POS direto com corte automático de papel.",
  },
  {
    categoria: "planos",
    pergunta: "O que ocorre quando um restaurante no plano Free ultrapassa 15 pratos ou 5 mesas?",
    resposta:
      "A interface administrativa do restaurante avisa o lojista com um alerta de cota atingida e bloqueia a adição de novos pratos ou mesas até que itens sejam removidos ou um upgrade para o plano Pro/VIP seja concedido pelo SuperAdmin. Os itens já existentes continuam funcionando normalmente no salão.",
  },
  {
    categoria: "planos",
    pergunta: "A alteração de plano de um restaurante exige reinicialização do sistema?",
    resposta:
      "Não! A migração de plano é atômica no Firestore e sincronizada instantaneamente via WebSockets (onSnapshot). Ao selecionar um novo plano no Grid de Estabelecimentos do SuperAdmin, as novas cotas passam a valer no mesmo segundo para os garçons, caixas e painel do lojista.",
  },
  {
    categoria: "auditoria",
    pergunta: "O Arquivo Morto remove permanentemente os dados do Firestore?",
    resposta:
      "Não. O Arquivo Morto sela a concessão em uma coleção de histórico imutável contendo um snapshot JSON completo do documento original com data de expiração e motivo do arquivamento. Além disso, permite baixar o arquivo `.json` individual para auditoria contábil e conta com botão de 'Restaurar' em caso de arquivamento acidental.",
  },
  {
    categoria: "seguranca",
    pergunta: "Como a rota /hq é protegida contra acessos não autorizados?",
    resposta:
      "O Next.js 16 intercepta todas as requisições em `src/proxy.ts`. O proxy inspeciona o cookie seguro `__session`, decodifica o JWT do Firebase Auth e verifica a claim booleana `superadmin === true`. Qualquer requisição sem o token ou sem essa claim recebe imediatamente uma resposta 404 (Not Found), ocultando até mesmo a existência do painel.",
  },
];

export function SuperAdminHelpView() {
  const [faqAberta, setFaqAberta] = useState<number | null>(0);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<"todas" | "licencas" | "planos" | "auditoria" | "seguranca" | "hardware">("todas");

  const faqsFiltradas = FAQS_SUPERADMIN.filter((item) => {
    const matchCat = categoria === "todas" || item.categoria === categoria;
    const matchBusca =
      item.pergunta.toLowerCase().includes(busca.toLowerCase()) ||
      item.resposta.toLowerCase().includes(busca.toLowerCase());
    return matchCat && matchBusca;
  });

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-rose-500 selection:text-white">
      {/* HEADER SUPERADMIN HELP - TEMA OFICIAL MAYAMENU (IFOOD STYLE) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/superadmin"
              className="p-2 rounded-xl bg-neutral-100 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 transition-colors"
              title="Voltar ao Painel SuperAdmin"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-600 flex items-center justify-center font-black text-white text-base shadow-sm">
                M
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm tracking-tight text-neutral-950">
                    MAYaRAnas HQ
                  </span>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-4 border-rose-200 bg-rose-50 text-rose-700">
                    Manual Executivo
                  </Badge>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Guia Oficial de Governança, Licenças & Operações
                </p>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-5 text-xs font-bold text-neutral-600">
            <a href="#fabrica-lote" className="hover:text-rose-600 transition-colors flex items-center gap-1">
              <span>Fábrica de Licenças</span>
              <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                NOVO
              </span>
            </a>
            <a href="#hardware-pix" className="hover:text-rose-600 transition-colors flex items-center gap-1">
              <span>Web Serial & Pix</span>
              <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                NOVO
              </span>
            </a>
            <a href="#governanca-planos" className="hover:text-rose-600 transition-colors">
              Matriz de Planos
            </a>
            <a href="#arquivo-morto" className="hover:text-rose-600 transition-colors">
              Arquivo Morto
            </a>
            <a href="#seguranca-acesso" className="hover:text-rose-600 transition-colors">
              Segurança & Proxy
            </a>
            <a href="#faq-superadmin" className="hover:text-rose-600 transition-colors">
              FAQ
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/manual" target="_blank">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 rounded-xl border-neutral-300 hover:bg-neutral-100 text-neutral-700 text-xs font-bold"
              >
                <BookOpen className="w-3.5 h-3.5 mr-1 text-rose-600" />
                Manual do Salão
              </Button>
            </Link>
            <Link href="/superadmin">
              <Button
                size="sm"
                className="h-8 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-sm"
              >
                Painel SuperAdmin
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="py-14 sm:py-18 px-4 sm:px-6 bg-gradient-to-b from-white via-neutral-50 to-neutral-100 border-b border-neutral-200">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black uppercase tracking-wider shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-rose-600" />
            Central de Operações & Governança Executiva
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-neutral-950 leading-tight">
            Governança de Licenças, Quotas e Infraestrutura MAYaMenu
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 max-w-2xl mx-auto leading-relaxed">
            Instruções técnicas para emissão em lote de concessões comerciais, gerenciamento de quotas de lojistas, auditoria de expirações e controles de segurança.
          </p>
        </div>
      </section>

      {/* SEÇÃO 1: FÁBRICA DE LICENÇAS EM LOTE */}
      <section id="fabrica-lote" className="py-16 px-4 sm:px-6 max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-black uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Recurso Recente • Emissão Comercial
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight flex items-center justify-center gap-2">
            <Boxes className="w-7 h-7 text-amber-600" />
            Fábrica de Concessões em Lote
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600 max-w-xl mx-auto">
            Emita de 5 a 100 concessões com um único clique com persistência atômica no banco de dados e exportação pronta para divulgação comercial.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-white border border-neutral-200/90 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
              <Layers2 className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-neutral-900">Seleção de Pacotes</h3>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                5 a 50 un
              </span>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              No painel de emissão, selecione <strong>Fábrica em Lote</strong> e utilize as opções de <strong>5, 10, 25 ou 50 unidades</strong>. O sistema gera identificadores únicos com máscara <code className="text-rose-600 font-bold">MAYA-XXXX-XXXX</code>.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-neutral-200/90 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-neutral-900">Exportação Planilha (.csv)</h3>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                UTF-8 BOM
              </span>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              O botão <strong>Baixar Planilha</strong> exporta um arquivo CSV com codificação UTF-8 com BOM, contendo código, status, link de ativação direta, plano e prazos de validade prontos para Excel e Google Sheets.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-neutral-200/90 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-neutral-900">Disparo WhatsApp / Slack</h3>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-800">
                1 Clique
              </span>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              O botão <strong>Copiar Lista</strong> formata os links de ativação com emojis e instruções completas para que os representantes comerciais possam enviar listas diretamente aos lojistas.
            </p>
          </div>
        </div>
      </section>

      {/* SEÇÃO NOVA: HARDWARE, WEB SERIAL & PIX ESC/POS */}
      <section id="hardware-pix" className="py-16 px-4 sm:px-6 bg-white border-y border-neutral-200">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-black uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              Arquitetura de Hardware • Web Serial
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight flex items-center justify-center gap-2">
              <Printer className="w-7 h-7 text-emerald-600" />
              Impressão Térmica ESC/POS USB & QR Code Pix
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 max-w-xl mx-auto">
              Como orientar lojistas e configurar impressoras térmicas conectadas ao caixa sem instalação de drivers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-200/80 space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-neutral-900">Padrão Web Serial (Chrome/Edge)</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                A tecnologia permite ao operador conectar qualquer impressora térmica USB de 58mm ou 80mm. Uma janela nativa do navegador solicita pareamento apenas uma vez, e o sistema memoriza o dispositivo.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-200/80 space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center font-black">
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-neutral-900">QR Code Pix Vetorial Nativo</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                O motor ESC/POS grava comandos de baixo nível na bobina (Function 165 a 181), imprimindo o QR Code do Banco Central com checksum CRC16-CCITT calculado no navegador em milissegundos.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-200/80 space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center font-black">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-neutral-900">Normalização Anti-Mojibake</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Caracteres especiais em português (cedilhas, acentos circunflexos e agudos) são automaticamente normalizados via NFD antes do envio à porta USB, evitando impressão de símbolos quebrados.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 2: MATRIZ DE GOVERNANÇA DE PLANOS */}
      <section id="governanca-planos" className="py-16 px-4 sm:px-6 max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-black uppercase tracking-widest text-rose-600">
            Controle de Cotas & Capacidade
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight flex items-center justify-center gap-2">
            <Store className="w-7 h-7 text-rose-600" />
            Matriz de Planos & Limites Operacionais
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600 max-w-xl mx-auto">
            Cada plano impõe regras de governança para assegurar estabilidade de infraestrutura e viabilidade comercial.
          </p>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs text-neutral-700">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-[11px] uppercase tracking-wider text-neutral-500 font-bold">
              <tr>
                <th className="p-4">Plano</th>
                <th className="p-4">Limite de Pratos</th>
                <th className="p-4">Limite de Mesas</th>
                <th className="p-4">Impressão Web Serial</th>
                <th className="p-4">QR Code Pix</th>
                <th className="p-4">Finalidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              <tr className="hover:bg-neutral-50/60">
                <td className="p-4 font-bold text-neutral-900 flex items-center gap-2">
                  <Badge variant="outline" className="border-neutral-300 bg-neutral-100 text-neutral-800 font-bold">
                    FREE
                  </Badge>
                </td>
                <td className="p-4 font-mono font-semibold">15 pratos</td>
                <td className="p-4 font-mono font-semibold">5 mesas</td>
                <td className="p-4 text-emerald-600 font-bold">Sim</td>
                <td className="p-4 text-emerald-600 font-bold">Sim</td>
                <td className="p-4 text-neutral-500">Degustação, cafeterias pequenas, food trucks</td>
              </tr>
              <tr className="hover:bg-neutral-50/60">
                <td className="p-4 font-bold text-neutral-900 flex items-center gap-2">
                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 font-bold">
                    PRO
                  </Badge>
                </td>
                <td className="p-4 font-mono font-semibold">150 pratos</td>
                <td className="p-4 font-mono font-semibold">30 mesas</td>
                <td className="p-4 text-emerald-600 font-bold">Sim</td>
                <td className="p-4 text-emerald-600 font-bold">Sim</td>
                <td className="p-4 text-neutral-500">Restaurantes de salão médio, pizzarias, bares</td>
              </tr>
              <tr className="hover:bg-neutral-50/60">
                <td className="p-4 font-bold text-neutral-900 flex items-center gap-2">
                  <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-800 font-bold">
                    VIP
                  </Badge>
                </td>
                <td className="p-4 font-mono text-purple-700 font-black">Ilimitado (9999)</td>
                <td className="p-4 font-mono text-purple-700 font-black">Ilimitado (9999)</td>
                <td className="p-4 text-emerald-600 font-bold">Sim</td>
                <td className="p-4 text-emerald-600 font-bold">Sim</td>
                <td className="p-4 text-neutral-500">Redes, franquias, churrascarias e complexos gastronômicos</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* SEÇÃO 3: ARQUIVO MORTO & AUDITORIA */}
      <section id="arquivo-morto" className="py-16 px-4 sm:px-6 bg-white border-t border-neutral-200">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-purple-600">
              Conformidade & Histórico
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight flex items-center justify-center gap-2">
              <Archive className="w-7 h-7 text-purple-600" />
              Arquivo Morto & Auditoria JSON
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 max-w-xl mx-auto">
              Preservação de registros com snapshots imutáveis para evitar perda de dados históricos e garantir restauração segura.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-200/90 shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <ClockAlert className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-neutral-900">Vencimento de Concessões</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Concessões temporárias recebem carimbo de expiração. Na aba <strong>Vencidas</strong>, o operador pode prorrogar a validade por +48h com 1 clique ou arquivar definitivamente.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-200/90 shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <FileCode2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-neutral-900">Snapshot de Auditoria</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                No Arquivo Morto, o botão <strong>Inspecionar JSON</strong> abre o documento completo com metadados originais de criação, dados do lojista e permite download em formato <code>.json</code>.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-200/90 shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-neutral-900">Restauração Reversível</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Caso uma concessão tenha sido arquivada por equívoco, o operador pode clicar em <strong>Restaurar</strong> para reativá-la imediatamente na coleção principal sem alterar seu token original.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 4: SEGURANÇA & PROXY */}
      <section id="seguranca-acesso" className="py-16 px-4 sm:px-6 max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-600">
            Arquitetura de Segurança
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight flex items-center justify-center gap-2">
            <Lock className="w-7 h-7 text-emerald-600" />
            Proteção de Rota (Next.js 16 Proxy) & Custom Claims
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600 max-w-xl mx-auto">
            Camada de defesa em profundidade: ninguém fora do grupo executivo tem acesso aos painéis de comando.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-white border border-neutral-200/90 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-neutral-900">Proxy em Next.js 16 (`src/proxy.ts`)</h3>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Todas as rotas <code>/hq/*</code> são inspecionadas na camada de rede pelo proxy. O servidor valida o cookie seguro <code>__session</code> antes de iniciar qualquer renderização de página.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-neutral-200/90 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 text-rose-800 rounded-xl">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-neutral-900">Custom Claims no Firebase Auth</h3>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              O token JWT do operador contém a claim <code>superadmin: true</code> emitida por chave mestra. Operadores autenticados têm permissão de gravação em concessões e planos no Firestore.
            </p>
          </div>
        </div>
      </section>

      {/* SEÇÃO 5: FAQ EXECUTIVO */}
      <section id="faq-superadmin" className="py-16 px-4 sm:px-6 bg-white border-t border-neutral-200">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2 mb-6">
            <span className="text-xs font-black uppercase tracking-widest text-rose-600">
              Dúvidas Frequentes do Administrador
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight">
              FAQ de Operações do SuperAdmin
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 max-w-lg mx-auto">
              Orientações técnicas para resolução rápida de cenários críticos.
            </p>
          </div>

          {/* BARRA DE PESQUISA E FILTROS */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar por lote, claim, cotas, proxy, arquivamento, web serial..."
                className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-2xs"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { id: "todas", label: "Todas" },
                { id: "licencas", label: "Fábrica de Licenças" },
                { id: "hardware", label: "Web Serial & Pix" },
                { id: "planos", label: "Planos & Cotas" },
                { id: "auditoria", label: "Auditoria & Arquivo" },
                { id: "seguranca", label: "Segurança & Proxy" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoria(cat.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    categoria === cat.id
                      ? "bg-rose-600 text-white shadow-xs font-black"
                      : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* ACCORDION */}
          <div className="space-y-3 pt-2">
            {faqsFiltradas.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-neutral-50 rounded-2xl border border-neutral-200">
                Nenhuma dúvida correspondente à sua busca.
              </div>
            ) : (
              faqsFiltradas.map((faq, index) => {
                const aberta = faqAberta === index;
                return (
                  <div
                    key={faq.pergunta}
                    className="bg-white border border-neutral-200/90 rounded-2xl overflow-hidden transition-all shadow-2xs"
                  >
                    <button
                      type="button"
                      onClick={() => setFaqAberta(aberta ? null : index)}
                      className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-neutral-900 hover:text-rose-600"
                    >
                      <span className="flex items-center gap-2.5">
                        <HelpCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                        {faq.pergunta}
                      </span>
                      {aberta ? (
                        <ChevronUp className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                      )}
                    </button>

                    {aberta && (
                      <div className="px-5 pb-5 pt-1 text-xs text-neutral-600 leading-relaxed border-t border-neutral-100 bg-neutral-50/50">
                        {faq.resposta}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 px-4 sm:px-6 bg-neutral-900 text-neutral-400 text-xs border-t border-neutral-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-rose-600 flex items-center justify-center font-black text-white text-xs">
              M
            </div>
            <span className="font-bold text-white">MAYaRAnas SuperAdmin HQ</span>
            <span>• Painel de Governança Geral</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/superadmin" className="hover:text-white transition-colors">
              Painel SuperAdmin
            </Link>
            <Link href="/manual" className="hover:text-white transition-colors">
              Manual do Salão
            </Link>
            <a href="#fabrica-lote" className="hover:text-white transition-colors">
              Voltar ao Topo
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
