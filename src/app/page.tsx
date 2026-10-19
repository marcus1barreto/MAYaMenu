import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowRight,
  Sparkles,
  Smartphone,
  ChefHat,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  LogIn,
  Zap,
  Store,
} from "lucide-react";

export const metadata: Metadata = {
  title: "MAYaMenu | Menus Inteligentes para Quiosques, Pizzarias e Lanchonetes",
  description:
    "Tecnologia de grandes restaurantes acessível para o seu negócio. Cardápio digital PWA e gestão de pedidos que custa menos que um guardanapo extra por mesa.",
  openGraph: {
    title: "MAYaMenu | Menus Inteligentes para Quiosques, Pizzarias e Lanchonetes",
    description:
      "Tecnologia de grandes restaurantes acessível para o seu negócio. Cardápio digital PWA e gestão de pedidos que custa menos que um guardanapo extra por mesa.",
    type: "website",
    locale: "pt_BR",
    siteName: "MAYaMenu",
  },
  twitter: {
    card: "summary_large_image",
    title: "MAYaMenu | Menus Inteligentes para Quiosques, Pizzarias e Lanchonetes",
    description:
      "Tecnologia de grandes restaurantes acessível para o seu negócio. Cardápio digital PWA e gestão de pedidos por R$ 0,26 ao dia por mesa.",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-rose-500 selection:text-white antialiased font-sans">
      {/* HEADER / NAVBAR ELEGANTE */}
      <header className="sticky top-0 z-50 w-full border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-600/20 group-hover:scale-105 transition-transform duration-300">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1.5">
                MAYaMenu
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  B2B
                </span>
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
            <a href="#pilares" className="hover:text-neutral-100 transition-colors">
              Como Funciona
            </a>
            <a href="#precos" className="hover:text-neutral-100 transition-colors">
              Tarifa Flexível
            </a>
            <a href="#perguntas" className="hover:text-neutral-100 transition-colors">
              Dúvidas
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-neutral-300 hover:text-white rounded-lg hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-all"
            >
              <LogIn className="w-4 h-4 text-neutral-400" />
              <span>Acesso Restrito / Login</span>
            </Link>
            <Link
              href="#precos"
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 rounded-lg shadow-md shadow-rose-950/50 hover:shadow-rose-600/25 active:scale-[0.98] transition-all"
            >
              Garanta a Solução
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* SEÇÃO A: HERO SECTION (A PRIMEIRA IMPRESSÃO) */}
        <section className="relative overflow-hidden pt-12 md:pt-20 pb-20 md:pb-28 border-b border-neutral-850">
          {/* Iluminação Radial Elegante */}
          <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-600/10 rounded-full blur-[140px] pointer-events-none" />
          <div className="absolute top-1/3 right-10 w-[450px] h-[450px] bg-amber-500/10 rounded-full blur-[130px] pointer-events-none" />

          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Texto à Esquerda (7 cols) */}
            <div className="lg:col-span-7 flex flex-col items-start text-left z-10">
              {/* Badge Superior */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900/90 border border-amber-500/30 text-xs font-semibold text-amber-400 mb-6 backdrop-blur-md shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>✨ Vagas Abertas para Membros Fundadores (Kits limitados)</span>
              </div>

              {/* Título H1 Impactante */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.12]">
                Quanto custa um guardanapo extra?{" "}
                <span className="bg-gradient-to-r from-amber-400 via-rose-400 to-rose-500 bg-clip-text text-transparent">
                  O MAYaMenu custa menos.
                </span>
              </h1>

              {/* Subtítulo Oficial Aprovado */}
              <p className="mt-6 text-base sm:text-lg lg:text-xl text-neutral-400 max-w-2xl font-normal leading-relaxed">
                Por apenas <strong className="text-neutral-100 font-semibold">R$ 0,26 diários por mesa</strong>,
                organize a sua cozinha, acabe com a confusão nos pedidos e aumente as suas vendas. O sistema feito para
                quem vive a realidade do balcão e do salão.
              </p>

              {/* CTAs de Conversão */}
              <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                <a
                  href="#precos"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-base font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/25 active:scale-[0.98] transition-all group"
                >
                  <span>Garanta a Solução para o seu Negócio</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>

                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-medium text-neutral-300 hover:text-white bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800 rounded-xl transition-all"
                >
                  <LogIn className="w-4 h-4 text-neutral-400" />
                  <span>Acesso Restrito / Login</span>
                </Link>
              </div>

              {/* Micro-aviso de confiança */}
              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-500" />
                  Sem fidelidade ou multas
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-500" />
                  Funciona no celular de qualquer cliente
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-500" />
                  Tarifa flexível em meses fracos
                </span>
              </div>
            </div>

            {/* Imagem / Mascote à Direita (5 cols) com direcionamento visual para o CTA */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              <div className="relative w-full max-w-[460px] aspect-[16/10] sm:aspect-[16/9] lg:aspect-[4/3] rounded-3xl overflow-hidden border border-neutral-800/80 bg-gradient-to-b from-neutral-900/80 to-neutral-950 p-2.5 sm:p-3 shadow-2xl shadow-black/80 group">
                <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-rose-500/10 pointer-events-none" />
                
                {/* O mascote segura a bandeja apontando/apresentando naturalmente para a esquerda em direção aos CTAs */}
                <div className="relative w-full h-full rounded-2xl overflow-hidden bg-neutral-900/90 flex items-center justify-center">
                  <Image
                    src="/chef-mayamenu.png"
                    alt="Chef MAYaMenu 2D - Apresentando a Solução para o seu Restaurante"
                    width={900}
                    height={506}
                    priority
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500 ease-out"
                  />
                </div>

                {/* Card Flutuante de Custo Diário */}
                <div className="absolute -bottom-3 -left-3 sm:bottom-4 sm:-left-4 bg-neutral-900/95 border border-neutral-750 p-3.5 rounded-2xl backdrop-blur-md shadow-xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-neutral-400 font-medium">Custo diário</div>
                    <div className="text-sm font-bold text-white flex items-baseline gap-1">
                      <span>R$ 0,26</span>
                      <span className="text-[11px] text-neutral-400 font-normal">/ mesa</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SEÇÃO B: PILARES (TECNOLOGIA DE GIGANTE, PREÇO DE BAIRRO) */}
        <section id="pilares" className="py-20 md:py-28 max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs sm:text-sm uppercase tracking-widest font-bold text-amber-500 mb-3">
              Tecnologia de Gigante, Preço de Bairro
            </h2>
            <p className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Tudo o que seu salão precisa para rodar sem atrito e com zero complicação
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {/* Card 1: Zero fricção na entrada do cliente */}
            <article className="p-8 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 hover:border-neutral-700/80 hover:bg-neutral-900/60 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Acesso Imediato (PWA)</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Nenhum app para baixar. O cliente senta, aponta a câmera e pede. Simples assim.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-neutral-850 flex items-center gap-2 text-xs text-neutral-400 font-medium">
                <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Zero fricção na entrada do cliente</span>
              </div>
            </article>

            {/* Card 2: Organização instantânea por rodadas */}
            <article className="p-8 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 hover:border-neutral-700/80 hover:bg-neutral-900/60 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <ChefHat className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Cozinha em Paz (KDS)</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Fim dos papéis perdidos. O pedido vai direto da mesa para a tela do cozinheiro, sem gritaria.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-neutral-850 flex items-center gap-2 text-xs text-neutral-400 font-medium">
                <CheckCircle2 className="w-4 h-4 text-rose-500 shrink-0" />
                <span>Organização instantânea por rodadas</span>
              </div>
            </article>

            {/* Card 3: Radar pró-ativo de mesas inativas */}
            <article className="p-8 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 hover:border-neutral-700/80 hover:bg-neutral-900/60 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Aumento de Vendas</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  O sistema avisa o garçom a hora exata de oferecer uma sobremesa ou refil. A tecnologia trabalhando no
                  seu faturamento.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-neutral-850 flex items-center gap-2 text-xs text-neutral-400 font-medium">
                <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Radar pró-ativo de mesas inativas</span>
              </div>
            </article>
          </div>
        </section>

        {/* SEÇÃO C: PREÇOS (TRANSPARÊNCIA RADICAL) */}
        <section id="precos" className="py-20 md:py-28 border-t border-neutral-850 bg-neutral-900/20">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400 mb-4">
                Transparência Radical
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                Uma parceria para os dias bons e de chuva.
              </h2>
              <p className="mt-4 text-neutral-400 text-base sm:text-lg max-w-xl mx-auto">
                Sem surpresas no fim do mês. Um modelo de precificação justo feito para apoiar quem empreende na
                gastronomia.
              </p>
            </div>

            {/* Card Principal de Preço */}
            <div className="relative rounded-3xl border border-neutral-800 bg-neutral-900/60 p-8 sm:p-12 shadow-2xl overflow-hidden backdrop-blur-sm">
              <div className="absolute top-0 right-0 w-80 h-80 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                <div className="md:col-span-7 flex flex-col items-start">
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">
                    A Tarifa Flexível
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-6xl font-black text-white tracking-tight">R$ 8,00</span>
                    <span className="text-neutral-400 text-sm sm:text-base font-normal">ao mês por mesa</span>
                  </div>
                  <div className="text-xs text-amber-400/90 font-medium mt-1">
                    (Equivale a R$ 0,26 por dia por mesa)
                  </div>

                  <p className="mt-5 text-sm sm:text-base text-neutral-300 leading-relaxed">
                    Sem taxas escondidas. Você paga apenas pelas mesas que tem. E o melhor:{" "}
                    <strong className="text-white font-medium">
                      nossa matemática detecta se o movimento do mês foi fraco, e a sua mensalidade diminui
                      automaticamente
                    </strong>
                    . Um sistema que é seu verdadeiro parceiro.
                  </p>

                  <div className="mt-6 space-y-2.5 text-xs sm:text-sm text-neutral-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Comandas e pedidos ilimitados</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Telas do Garçom e Cozinha (KDS) inclusas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Sem fidelidade ou multas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Funciona no celular de qualquer cliente</span>
                    </div>
                  </div>
                </div>

                {/* Card Secundário: Programa Fundadores */}
                <div className="md:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl bg-neutral-950/70 border border-neutral-800/90 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-3">
                    <Zap className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-white text-base">Programa Fundadores</h4>
                  <p className="text-xs text-neutral-400 mt-1 mb-5 leading-relaxed">
                    Instalação guiada pelo time da MAYaRAnas e placas de QR Code de brinde.
                  </p>

                  <a
                    href="https://wa.me/?text=Olá!%20Gostaria%20de%20garantir%20minha%20vaga%20como%20Membro%20Fundador%20do%20MAYaMenu."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md shadow-rose-600/30 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Quero ser Membro Fundador</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>

                  <Link
                    href="/demo"
                    className="mt-3.5 text-xs text-neutral-400 hover:text-white transition-colors underline-offset-4 hover:underline"
                  >
                    Ou teste uma mesa na Sandbox Demo
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SEÇÃO D: PERGUNTAS FREQUENTES (FAQ) */}
        <section id="perguntas" className="py-20 max-w-4xl mx-auto px-6 border-t border-neutral-850">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Dúvidas Frequentes</h2>
            <p className="text-neutral-400 text-sm mt-2">
              Respostas diretas e sem enrolação para o seu dia a dia.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-neutral-900/30 border border-neutral-800">
              <h3 className="font-semibold text-white text-base flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                Preciso comprar máquinas ou tablets especiais?
              </h3>
              <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
                Não. O MAYaMenu é 100% web e PWA. Funciona em qualquer celular com câmera (Android e iPhone) dos seus
                clientes, e no celular ou tablet que você e sua equipe já utilizam.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/30 border border-neutral-800">
              <h3 className="font-semibold text-white text-base flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                E se a internet do meu estabelecimento cair?
              </h3>
              <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
                Nossa tecnologia é desenhada para contingência com suporte a PWA e comprovantes por Ticket Digital com
                validação local. Se o 4G do cliente estiver ruim, o garçom pode lançar o pedido em 3 toques pelo tablet
                do salão usando a mesma conta da mesa. Seu cliente nunca fica na mão.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/30 border border-neutral-800">
              <h3 className="font-semibold text-white text-base flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                O que acontece se meu movimento cair muito no mês?
              </h3>
              <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
                Nós aplicamos a Tarifa Flexível: nossa tecnologia calcula o ritmo de utilização das mesas e reduz a
                cobrança automaticamente. Você só investe na proporção em que o sistema de fato está gerando valor.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER MINIMALISTA */}
      <footer className="border-t border-neutral-850 bg-neutral-950 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-neutral-400">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-bold text-white tracking-tight">MAYaMenu</span>
            <span className="text-neutral-500 text-xs">por MAYaRAnas Sistemas</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-400">
            <Link href="/demo" className="hover:text-white transition-colors">
              Sandbox Demo
            </Link>
            <Link href="/historico" className="hover:text-white transition-colors">
              Meus Recibos
            </Link>
            <Link href="/admin" className="hover:text-white transition-colors">
              Acesso Restaurante
            </Link>
            <a href="#pilares" className="hover:text-white transition-colors">
              PWA e KDS
            </a>
            <a href="#precos" className="hover:text-white transition-colors">
              Tarifa Flexível
            </a>
          </div>

          <div className="text-xs text-neutral-400 text-center md:text-right">
            © 2026 MAYaMenu. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
