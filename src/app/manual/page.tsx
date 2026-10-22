"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  ShieldCheck,
  Zap,
  Smartphone,
  ChefHat,
  QrCode,
  ArrowRight,
  ExternalLink,
  Lock,
  Layers,
  Sparkles,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface FaqItem {
  pergunta: string;
  resposta: string;
  categoria: "operacao" | "financeiro" | "tecnico";
}

const FAQS: FaqItem[] = [
  {
    categoria: "operacao",
    pergunta: "O cliente precisa baixar algum aplicativo na Apple Store ou Google Play?",
    resposta:
      "Não! O MAYaMenu opera como Progressive Web App (PWA) de ultra-velocidade. O cliente simplesmente aponta a câmera do celular para o QR Code da mesa ou do balcão e o cardápio interativo abre instantaneamente no navegador em menos de 1 segundo, sem consumir espaço no telefone e sem exigir downloads ou logins chatos.",
  },
  {
    categoria: "operacao",
    pergunta: "Como funciona a divisão de contas na mesma mesa?",
    resposta:
      "De forma totalmente automática. Quando vários clientes sentam à mesma mesa e escaneiam o QR Code, cada um pode comandar pelo seu próprio nome ou visualizar a comanda coletiva. Na hora de fechar, o sistema discrimina exatamente o que cada comanda consumiu, permitindo pagamentos parciais via Pix instantâneo ou no cartão com o garçom.",
  },
  {
    categoria: "operacao",
    pergunta: "Como configurar ou desativar a taxa de serviço (10%)?",
    resposta:
      "No painel do administrador, clique no botão 'Configurações' no topo da tela. Você pode ajustar a porcentagem da taxa de serviço (por exemplo, 0%, 10% ou 12%) ou desativá-la totalmente. O valor é calculado de forma transparente no rodapé da comanda do cliente.",
  },
  {
    categoria: "tecnico",
    pergunta: "O que acontece se a internet do restaurante oscilar ou cair temporariamente?",
    resposta:
      "O sistema possui arquitetura de tolerância a falhas. Os dados das comandas ativas e o cardápio são cacheados localmente no navegador dos dispositivos (mesas, garçom e cozinha). Assim que a conexão de rede for restabelecida, a sincronização em nuvem é completada automaticamente sem duplicação de pedidos.",
  },
  {
    categoria: "tecnico",
    pergunta: "Qual impressora térmica é recomendada para comandas e cupons?",
    resposta:
      "O MAYaMenu foi projetado para operar 100% sem papel com o monitor de cozinha KDS. Porém, se o seu restaurante utiliza impressora térmica física, qualquer equipamento padrão ESC/POS de 80mm ou 58mm (conectado via USB, Rede ou Spooler do Windows/Linux) pode ser disparado diretamente do navegador com um clique.",
  },
  {
    categoria: "financeiro",
    pergunta: "A Concessão Free tem data de expiração ou pegadinha com cobrança automática?",
    resposta:
      "Não. A concessão Free do MAYaMenu é vitalícia e não requer cartão de crédito para ativação. Você pode utilizar o sistema com até 15 pratos e 5 mesas de forma perene. Upgrades para planos Pro ou Enterprise com capacidade ilimitada são estritamente opcionais por decisão do próprio estabelecimento.",
  },
  {
    categoria: "financeiro",
    pergunta: "As vendas via Pix têm taxa retida pelo MAYaMenu?",
    resposta:
      "Zero taxa de intermediação do MAYaMenu. Quando o cliente paga via Pix Copia-e-Cola ou QR Code Pix configurado na sua chave, o valor entra 100% direto na sua conta bancária sem intermediários e sem porcentagens descontadas da nossa parte.",
  },
];

export default function ManualPage() {
  const [faqAberta, setFaqAberta] = useState<number | null>(0);
  const [buscaFaq, setBuscaFaq] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<"todas" | "operacao" | "tecnico" | "financeiro">("todas");

  const faqsFiltradas = FAQS.filter((faq) => {
    const matchCategoria = filtroCategoria === "todas" || faq.categoria === filtroCategoria;
    const matchBusca =
      faq.pergunta.toLowerCase().includes(buscaFaq.toLowerCase()) ||
      faq.resposta.toLowerCase().includes(buscaFaq.toLowerCase());
    return matchCategoria && matchBusca;
  });

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-rose-500 selection:text-white">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-600 flex items-center justify-center font-black text-white text-base shadow-sm">
              M
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black tracking-tight text-neutral-950 leading-none">
                MAYaMenu
              </span>
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mt-0.5">
                Central de Ajuda & Manual
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-xs font-bold text-neutral-600">
            <a href="#guia-rapido" className="hover:text-rose-600 transition-colors">
              Guia Rápido
            </a>
            <a href="#modos-salao" className="hover:text-rose-600 transition-colors">
              Modos do Salão
            </a>
            <a href="#faq" className="hover:text-rose-600 transition-colors">
              FAQ Operacional
            </a>
            <a href="#politicas" className="hover:text-rose-600 transition-colors">
              Políticas & Garantias
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button
                variant="outline"
                className="h-9 px-3.5 rounded-xl border-neutral-300 hover:bg-neutral-100 text-xs font-bold"
              >
                Painel Admin
              </Button>
            </Link>
            <Link href="/admin">
              <Button className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-sm">
                Cadastrar Grátis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 bg-gradient-to-b from-white via-neutral-50 to-neutral-100 border-b border-neutral-200">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-xs font-black uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5" />
            Manual Oficial do Operador
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-neutral-950 leading-tight">
            Tudo o que você precisa para dominar o seu salão.
          </h1>
          <p className="text-sm sm:text-base text-neutral-600 max-w-2xl mx-auto leading-relaxed">
            Instruções passo a passo, boas práticas para a equipe de garçons e cozinha, respostas para dúvidas operacionais e garantias de conformidade com a LGPD.
          </p>

          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <a href="#guia-rapido">
              <Button className="h-11 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20">
                Começar pelo Guia Rápido de 3 Minutos
              </Button>
            </a>
            <a href="#faq">
              <Button
                variant="outline"
                className="h-11 px-5 rounded-xl border-neutral-300 hover:bg-white text-neutral-700 font-bold text-xs"
              >
                Ver Perguntas Frequentes
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* SEÇÃO 1: GUIA RÁPIDO DE 3 MINUTOS */}
      <section id="guia-rapido" className="py-16 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="text-center space-y-2 mb-12">
          <span className="text-xs font-black uppercase tracking-widest text-rose-600">
            Passo a Passo Instantâneo
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight">
            Guia Rápido de 3 Minutos: Do Cadastro ao Primeiro Pedido
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 max-w-xl mx-auto">
            Configuração simplificada para colocar seu restaurante funcionando no mesmo turno de serviço.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* PASSO 1 */}
          <div className="bg-white p-6 rounded-3xl border border-neutral-200/90 shadow-sm relative flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center font-black text-rose-600 text-lg mb-4">
                1
              </div>
              <h3 className="text-base font-black text-neutral-900 mb-2">Cadastre Categorias e Pratos</h3>
              <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                No Painel Admin, acesse a aba <strong>Cardápio</strong>. Cadastre suas categorias (Bebidas, Pratos Principais, Sobremesas) e adicione pratos com foto, valor e opcionais como ponto da carne ou adicionais.
              </p>
            </div>
            <div className="pt-4 border-t border-neutral-100 text-[11px] font-bold text-rose-600 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Dica: Adicione fotos reais para elevar as vendas.
            </div>
          </div>

          {/* PASSO 2 */}
          <div className="bg-white p-6 rounded-3xl border border-neutral-200/90 shadow-sm relative flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center font-black text-rose-600 text-lg mb-4">
                2
              </div>
              <h3 className="text-base font-black text-neutral-900 mb-2">Imprima os QR Codes das Mesas</h3>
              <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                Na aba <strong>Salão & Mesas</strong>, selecione qualquer mesa e clique em <strong>Ver QR Code</strong>. Imprima os adesivos ou displays acrílicos para que os clientes acessem o cardápio sem garçom.
              </p>
            </div>
            <div className="pt-4 border-t border-neutral-100 text-[11px] font-bold text-neutral-700 flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5 text-rose-600" />
              Cada mesa possui QR individual pré-configurado.
            </div>
          </div>

          {/* PASSO 3 */}
          <div className="bg-white p-6 rounded-3xl border border-neutral-200/90 shadow-sm relative flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center font-black text-rose-600 text-lg mb-4">
                3
              </div>
              <h3 className="text-base font-black text-neutral-900 mb-2">Abra o KDS na Cozinha e Atenda</h3>
              <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                Abra a rota <code>/cozinha</code> em um tablet, TV ou computador na bancada. Os pedidos dos clientes chegam em tempo real, organizados por tempo de espera e mesa, sem papéis perdidos.
              </p>
            </div>
            <div className="pt-4 border-t border-neutral-100 text-[11px] font-bold text-neutral-700 flex items-center gap-1">
              <ChefHat className="w-3.5 h-3.5 text-amber-500" />
              A cozinha avisa com 1 clique quando o prato estiver pronto.
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 2: MODOS DO SALÃO */}
      <section id="modos-salao" className="py-16 px-4 sm:px-6 bg-white border-y border-neutral-200">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-rose-600">
              Flexibilidade Operacional
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight">
              Os 3 Modos de Operação do MAYaMenu
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 max-w-xl mx-auto">
              Alterne o modelo operacional a qualquer momento de acordo com o perfil do seu salão ou horário de pico.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-200/80 space-y-3">
              <div className="inline-flex p-2.5 rounded-xl bg-rose-100 text-rose-700 font-bold text-xs">
                🍽️ Modo Híbrido (Recomendado)
              </div>
              <h3 className="text-base font-black text-neutral-900">Garçom + QR Code na Mesa</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                O cliente pode pedir autonomamente direto pelo celular, mas o garçom também pode lançar itens adicionais na mesa a qualquer instante. Agiliza o atendimento em horários lotados.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-200/80 space-y-3">
              <div className="inline-flex p-2.5 rounded-xl bg-amber-100 text-amber-800 font-bold text-xs">
                🤵 Modo Com Garçom
              </div>
              <h3 className="text-base font-black text-neutral-900">Atendimento Exclusivo da Brigada</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                O cliente apenas visualiza o cardápio no celular, e todos os lançamentos são feitos pelos garçons através do App Mobile da equipe. Ideal para gastronomia de alto padrão e bistrôs.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-200/80 space-y-3">
              <div className="inline-flex p-2.5 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs">
                🛎️ Modo Balcão & Retirada
              </div>
              <h3 className="text-base font-black text-neutral-900">Fast Food & Cafeterias</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Sem necessidade de mesas fixas. Os clientes realizam os pedidos no balcão ou via QR de totem, efetuam o pagamento antecipado e retiram o pedido pelo número da senha gerada.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 3: FAQ OPERACIONAL */}
      <section id="faq" className="py-16 px-4 sm:px-6 max-w-4xl mx-auto">
        <div className="text-center space-y-2 mb-10">
          <span className="text-xs font-black uppercase tracking-widest text-rose-600">
            Tire Suas Dúvidas
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight">
            Perguntas Frequentes (FAQ Operacional)
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 max-w-lg mx-auto">
            Soluções para os cenários reais do dia a dia de atendimento e gestão financeira.
          </p>
        </div>

        {/* BARRA DE FILTRO E PESQUISA */}
        <div className="space-y-3 mb-8">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-400" />
            <input
              type="text"
              value={buscaFaq}
              onChange={(e) => setBuscaFaq(e.target.value)}
              placeholder="Pesquisar dúvida (ex: offline, taxa de 10%, pix, impressora)..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 rounded-2xl text-xs text-neutral-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: "todas", rotulo: "Todas as Dúvidas" },
              { id: "operacao", rotulo: "Operação do Salão" },
              { id: "tecnico", rotulo: "Conexão & Impressoras" },
              { id: "financeiro", rotulo: "Financeiro & Pix" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFiltroCategoria(cat.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filtroCategoria === cat.id
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {cat.rotulo}
              </button>
            ))}
          </div>
        </div>

        {/* LISTAGEM ACCORDION */}
        <div className="space-y-3">
          {faqsFiltradas.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500 bg-white rounded-2xl border border-neutral-200">
              Nenhuma pergunta encontrada para sua busca. Tente outras palavras-chave.
            </div>
          ) : (
            faqsFiltradas.map((faq, index) => {
              const aberta = faqAberta === index;
              return (
                <div
                  key={faq.pergunta}
                  className="bg-white border border-neutral-200/90 rounded-2xl overflow-hidden transition-all shadow-xs"
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
      </section>

      {/* SEÇÃO 4: POLÍTICAS DE USO, PRIVACIDADE E GARANTIAS */}
      <section id="politicas" className="py-16 px-4 sm:px-6 bg-white border-t border-neutral-200">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600">
              Transparência & Segurança Jurídica
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight">
              Políticas de Uso, Privacidade (LGPD) e Garantias
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 max-w-xl mx-auto">
              Compromisso institucional com a integridade dos dados e continuidade das operações do seu restaurante.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* GARANTIA DE CONTINUIDADE E SLA */}
            <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-200/90 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-neutral-900">Garantia de Disponibilidade (SLA Cloud 99.9%)</h3>
                  <span className="text-[10px] text-neutral-500">Infraestrutura Google Firebase Serverless</span>
                </div>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                O MAYaMenu roda sobre a nuvem de alta confiabilidade da Google Cloud, com auto-escalabilidade automática durante picos de movimentação e redundância em múltiplas zonas.
              </p>
            </div>

            {/* PRIVACIDADE E LGPD */}
            <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-200/90 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-100 text-rose-800 rounded-xl">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-neutral-900">Privacidade & Conformidade com a LGPD</h3>
                  <span className="text-[10px] text-neutral-500">Seus dados pertencem exclusivamente a você</span>
                </div>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Não vendemos nem compartilhamos listas de clientes, cardápios ou números de faturamento com terceiros. Todas as informações trafegam criptografadas com certificado TLS de ponta a ponta.
              </p>
            </div>

            {/* TRANSPARÊNCIA DA CONCESSÃO FREE */}
            <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-200/90 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-neutral-900">Termos da Concessão Free</h3>
                  <span className="text-[10px] text-neutral-500">Sem renovação automática, sem pegadinhas</span>
                </div>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                A concessão gratuita não bloqueia funcionalidades essenciais de salão nem insere anúncios no cardápio de seus clientes. Planos superiores são contratados exclusivamente por demanda direta.
              </p>
            </div>

            {/* SUPORTE E CONTINGÊNCIA */}
            <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-200/90 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-800 rounded-xl">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-neutral-900">Contingência e Backups</h3>
                  <span className="text-[10px] text-neutral-500">Segurança de histórico</span>
                </div>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Todas as sessões de mesas, comandas fechadas e produtos possuem logs de auditoria e podem ser exportados a qualquer momento pelo SuperAdmin ou no Painel Financeiro.
              </p>
            </div>
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
            <span className="font-bold text-white">MAYaMenu Sistema de Salão & KDS</span>
            <span>• © 2026 Todos os direitos reservados</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-white transition-colors">
              Página Inicial
            </Link>
            <Link href="/admin" className="hover:text-white transition-colors">
              Painel Administrativo
            </Link>
            <a href="#guia-rapido" className="hover:text-white transition-colors">
              Voltar ao Topo
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
