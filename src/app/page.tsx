import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowRight,
  Sparkles,
  Smartphone,
  ChefHat,
  TrendingUp,
  CheckCircle2,
  HelpCircle,
  LogIn,
  Zap,
  Store,
} from "lucide-react";

export const metadata: Metadata = {
  title: "MAYaMenu | Menus Inteligentes para Restaurantes, Bares e Lanchonetes",
  description:
    "Tecnologia de grandes restaurantes acessível para o seu negócio. Cardápio digital PWA e gestão de pedidos ágil, limpo e direto.",
  openGraph: {
    title: "MAYaMenu | Menus Inteligentes para Restaurantes, Bares e Lanchonetes",
    description:
      "Tecnologia de grandes restaurantes acessível para o seu negócio. Cardápio digital PWA e gestão de pedidos ágil, limpo e direto.",
    type: "website",
    locale: "pt_BR",
    siteName: "MAYaMenu",
  },
  twitter: {
    card: "summary_large_image",
    title: "MAYaMenu | Menus Inteligentes para Restaurantes, Bares e Lanchonetes",
    description:
      "Tecnologia de grandes restaurantes acessível para o seu negócio. Cardápio digital PWA e gestão de pedidos por R$ 0,26 ao dia por mesa.",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col selection:bg-rose-600 selection:text-white antialiased font-sans overflow-x-hidden">
      {/* 1. NAVBAR CLARA & PROFISSIONAL (IFOOD STYLE) */}
      <header className="sticky top-0 z-50 w-full border-b border-neutral-200/80 bg-white/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 h-16 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 shrink-0 group">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-rose-600 to-red-600 flex items-center justify-center shadow-md shadow-rose-600/20 group-hover:scale-105 transition-transform duration-300">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-base sm:text-lg tracking-tight text-neutral-950 flex items-center gap-1.5">
                MAYaMenu
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  B2B
                </span>
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-neutral-600">
            <a href="#pilares" className="hover:text-rose-600 transition-colors">
              Como Funciona
            </a>
            <a href="#precos" className="hover:text-rose-600 transition-colors">
              Tarifa Flexível
            </a>
            <a href="#perguntas" className="hover:text-rose-600 transition-colors">
              Dúvidas
            </a>
            <Link href="/manual" className="hover:text-rose-600 transition-colors">
              Manual & FAQ
            </Link>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-neutral-800 hover:text-neutral-950 rounded-xl hover:bg-neutral-100 border border-neutral-200/90 transition-all shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-500" />
              <span>Acessar Painel</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden">
        {/* 2. HERO SECTION (M3 DISPLAY & HEADLINE ESCANEÁVEL EM SMARTPHONES) */}
        <section className="relative overflow-hidden pt-8 sm:pt-16 md:pt-20 pb-14 md:pb-24 border-b border-neutral-200/70 bg-gradient-to-b from-rose-50/30 via-white to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            {/* Texto à Esquerda (7 cols) */}
            <div className="lg:col-span-7 flex flex-col items-start text-left z-10">
              {/* Badge Superior */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 mb-4 sm:mb-5 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>✨ Experimente a versão free</span>
              </div>

              {/* Título H1 M3 Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-neutral-950 leading-[1.15]">
                Quanto custa um guardanapo extra?{" "}
                <span className="text-rose-600 block sm:inline">
                  O MAYaMenu custa menos.
                </span>
              </h1>

              {/* Subtítulo M3 Body Large */}
              <p className="mt-4 sm:mt-5 text-base sm:text-lg lg:text-xl text-neutral-600 max-w-2xl font-normal leading-relaxed">
                Por apenas <strong className="text-neutral-950 font-bold">R$ 0,26 diários por mesa</strong>,
                organize a sua cozinha, acabe com a confusão nos pedidos e aumente o faturamento. Tecnologia limpa feita para quem vive a realidade do salão.
              </p>

              {/* CTAs de Conversão (Áreas de toque mínimas de 44px) */}
              <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 text-sm sm:text-base font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-lg shadow-rose-600/25 active:scale-95 transition-all group text-center"
                >
                  <span>Experimente a versão free</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform shrink-0" />
                </Link>

                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3.5 text-sm sm:text-base font-semibold text-neutral-800 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200/80 border border-neutral-200 rounded-xl transition-all text-center"
                >
                  <LogIn className="w-4 h-4 text-neutral-600 shrink-0" />
                  <span>Painel do Restaurante</span>
                </Link>
              </div>

              {/* Micro-aviso de confiança (M3 Label) */}
              <div className="mt-6 flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-medium text-neutral-600">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Sem fidelidade ou multas
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Funciona no celular do cliente
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Tarifa flexível em meses fracos
                </span>
              </div>
            </div>

            {/* Imagem / Mascote à Direita (5 cols) */}
            <div className="lg:col-span-5 relative flex items-center justify-center w-full">
              <div className="relative w-full max-w-[460px] aspect-[16/10] sm:aspect-[16/9] lg:aspect-[4/3] rounded-3xl overflow-hidden border border-neutral-200 bg-neutral-100 p-2 sm:p-3 shadow-xl shadow-neutral-200/60 group">
                <div className="relative w-full h-full rounded-2xl overflow-hidden bg-white flex items-center justify-center">
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
                <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 bg-white/95 border border-neutral-200 p-2.5 sm:p-3.5 rounded-2xl backdrop-blur-md shadow-lg flex items-center gap-2.5 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                    <Store className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] sm:text-xs text-neutral-500 font-semibold leading-tight">Custo diário</div>
                    <div className="text-xs sm:text-sm font-black text-neutral-950 flex items-baseline gap-1">
                      <span>R$ 0,26</span>
                      <span className="text-[10px] sm:text-xs text-neutral-500 font-normal">/ mesa</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. SEÇÃO PILARES (TECNOLOGIA DE GIGANTE, PREÇO DE BAIRRO) */}
        <section id="pilares" className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <h2 className="text-xs sm:text-sm uppercase tracking-widest font-black text-rose-600 mb-2.5">
              Tecnologia de Gigante, Preço de Bairro
            </h2>
            <p className="text-2xl sm:text-4xl font-black text-neutral-950 tracking-tight">
              Tudo o que seu salão precisa para rodar sem atrito e com zero complicação
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: PWA */}
            <article className="p-7 sm:p-8 rounded-3xl bg-white border border-neutral-200 shadow-xs hover:shadow-lg hover:border-neutral-300 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-neutral-950 mb-2.5">Acesso Imediato (PWA)</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Nenhum app pesado para baixar. O cliente senta à mesa, aponta a câmera do celular e pede na hora.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center gap-2 text-xs text-neutral-600 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero atrito na entrada do cliente</span>
              </div>
            </article>

            {/* Card 2: KDS */}
            <article className="p-7 sm:p-8 rounded-3xl bg-white border border-neutral-200 shadow-xs hover:shadow-lg hover:border-neutral-300 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <ChefHat className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-neutral-950 mb-2.5">Cozinha em Paz (KDS)</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Fim dos papéis perdidos ou ilegíveis. O pedido sai da mesa diretamente para a tela da cozinha em ordem cronológica.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center gap-2 text-xs text-neutral-600 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Organização instantânea por rodadas</span>
              </div>
            </article>

            {/* Card 3: Vendas */}
            <article className="p-7 sm:p-8 rounded-3xl bg-white border border-neutral-200 shadow-xs hover:shadow-lg hover:border-neutral-300 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-neutral-950 mb-2.5">Aumento de Vendas</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  O sistema sinaliza o salão sobre o ritmo de consumo de cada mesa. A tecnologia trabalhando para elevar o ticket médio.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center gap-2 text-xs text-neutral-600 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Radar proativo de salão e mesas</span>
              </div>
            </article>
          </div>
        </section>

        {/* 4. SEÇÃO PREÇOS (TRANSPARÊNCIA RADICAL) */}
        <section id="precos" className="py-16 md:py-24 border-t border-neutral-200 bg-neutral-50/60">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10 sm:mb-12">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 mb-3.5">
                Transparência Radical
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-neutral-950 tracking-tight">
                Uma parceria para os dias bons e de chuva.
              </h2>
              <p className="mt-4 text-neutral-600 text-base sm:text-lg max-w-xl mx-auto">
                Sem surpresas no fim do mês. Modelo de precificação justo feito para apoiar quem empreende na gastronomia.
              </p>
            </div>

            {/* Card Principal de Preço */}
            <div className="relative rounded-3xl border border-neutral-200 bg-white p-6 sm:p-12 shadow-xl overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                <div className="md:col-span-7 flex flex-col items-start">
                  <div className="text-xs font-bold uppercase tracking-wider text-rose-600 mb-2">
                    A Tarifa Flexível
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-6xl font-black text-neutral-950 tracking-tight">R$ 8,00</span>
                    <span className="text-neutral-500 text-sm sm:text-base font-medium">ao mês por mesa</span>
                  </div>
                  <div className="text-xs text-rose-600 font-bold mt-1">
                    (Equivale a R$ 0,26 por dia por mesa)
                  </div>

                  <p className="mt-5 text-sm sm:text-base text-neutral-600 leading-relaxed">
                    Sem taxas escondidas. Você paga apenas pelas mesas que tem. E o melhor:{" "}
                    <strong className="text-neutral-950 font-bold">
                      nossa inteligência detecta se o movimento do mês foi atípico e a cobrança se ajusta
                    </strong>
                    . Um sistema que é seu verdadeiro parceiro.
                  </p>

                  <div className="mt-6 space-y-2.5 text-xs sm:text-sm text-neutral-700 font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Comandas e pedidos ilimitados</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Telas do Garçom e Cozinha (KDS) inclusas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Sem fidelidade ou multas rescisórias</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Funciona no celular de qualquer cliente</span>
                    </div>
                  </div>
                </div>

                {/* Card Secundário: Versão Free */}
                <div className="md:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl bg-neutral-50 border border-neutral-200 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-3">
                    <Zap className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-neutral-950 text-base">Versão Free</h4>
                  <p className="text-xs text-neutral-600 mt-1 mb-5 leading-relaxed">
                    Comece sem custos, cadastre seus pratos e experimente o cardápio digital PWA na prática.
                  </p>

                  <Link
                    href="/admin"
                    className="w-full py-3 px-5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Experimente a versão free</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    href="/demo"
                    className="mt-3.5 text-xs text-neutral-600 hover:text-neutral-950 transition-colors font-medium underline-offset-4 hover:underline"
                  >
                    Ou teste uma mesa na Sandbox Demo
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. SEÇÃO PERGUNTAS FREQUENTES (FAQ) */}
        <section id="perguntas" className="py-16 md:py-24 max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-black text-neutral-950">Dúvidas Frequentes</h2>
            <p className="text-neutral-600 text-sm mt-2">
              Respostas diretas e sem enrolação para o seu dia a dia.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-xs">
              <h3 className="font-bold text-neutral-950 text-base flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-rose-600 shrink-0" />
                Preciso comprar máquinas ou tablets especiais?
              </h3>
              <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
                Não. O MAYaMenu é 100% web e PWA. Funciona em qualquer celular com câmera (Android e iPhone) dos seus clientes, e nos aparelhos que você e sua equipe já utilizam.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-xs">
              <h3 className="font-bold text-neutral-950 text-base flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-rose-600 shrink-0" />
                E se a internet do meu estabelecimento oscilar?
              </h3>
              <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
                Nossa tecnologia conta com o protocolo MAYa Sync-QR de contingência. Se o sinal oscilar, o garçom e o cliente continuam operando e conferindo pedidos via comanda-espelho criptografada sem depender de conexão contínua.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-xs">
              <h3 className="font-bold text-neutral-950 text-base flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-rose-600 shrink-0" />
                O que acontece se meu movimento cair muito no mês?
              </h3>
              <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
                Nós aplicamos a Tarifa Flexível: calculamos o volume real de mesas ativas no período e adaptamos a cobrança. Você só investe na proporção em que o sistema de fato está gerando valor.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* 6. FOOTER CLARO & MINIMALISTA */}
      <footer className="border-t border-neutral-200 bg-neutral-50 py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-neutral-600">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-rose-600 flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-black text-neutral-950 tracking-tight">MAYaMenu</span>
            <span className="text-neutral-500 text-xs">por MAYaRAnas Sistemas</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-neutral-600">
            <Link href="/demo" className="hover:text-rose-600 transition-colors">
              Sandbox Demo
            </Link>
            <Link href="/historico" className="hover:text-rose-600 transition-colors">
              Meus Recibos
            </Link>
            <Link href="/admin" className="hover:text-rose-600 transition-colors">
              Acesso Restaurante
            </Link>
            <a href="#pilares" className="hover:text-rose-600 transition-colors">
              PWA e KDS
            </a>
            <Link href="/manual" className="hover:text-rose-600 transition-colors">
              Manual & FAQ
            </Link>
            <a href="#precos" className="hover:text-rose-600 transition-colors">
              Tarifa Flexível
            </a>
          </div>

          <div className="text-xs text-neutral-500 text-center md:text-right">
            © 2026 MAYaMenu. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
