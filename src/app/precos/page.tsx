"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  X,
  Sparkles,
  Zap,
  ShieldCheck,
  Lock,
  CreditCard,
  QrCode,
  Store,
  ChevronDown,
  HelpCircle,
  ArrowRight,
  Gift,
  Building2,
  Users,
  UtensilsCrossed,
  ChefHat,
  Smartphone,
  Award,
  Clock,
  BadgePercent,
  CheckCircle2,
} from "lucide-react";
import { BlackFreedayBar } from "@/components/marketing/black-freeday-bar";

export default function PrecosPage() {
  const [faqAberto, setFaqAberto] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setFaqAberto(faqAberto === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-neutral-900 flex flex-col font-sans selection:bg-rose-500 selection:text-white antialiased">
      {/* 1. TARJA PRETA BLACK FREEDAY */}
      <BlackFreedayBar />

      {/* 2. HEADER DE NAVEGAÇÃO LIMPO */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-500 flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-md shadow-rose-600/20 group-hover:scale-105 transition-transform">
              M
            </div>
            <div className="flex flex-col">
              <span className="font-black text-lg sm:text-xl tracking-tight text-neutral-950 flex items-center gap-1">
                MAYa<span className="text-rose-600">Menu</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-neutral-900 text-white">
                  PRO
                </span>
              </span>
              <span className="text-[10px] text-neutral-500 font-medium tracking-wide hidden sm:inline">
                Cardápios Digitais & Gestão Inteligente
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm font-semibold text-neutral-700">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg hover:text-rose-600 hover:bg-neutral-100 transition-colors hidden md:inline-flex"
            >
              Início
            </Link>
            <Link
              href="/demo"
              className="px-3 py-1.5 rounded-lg hover:text-rose-600 hover:bg-neutral-100 transition-colors flex items-center gap-1.5"
            >
              <Store className="w-4 h-4 text-rose-600" />
              <span>Restaurante Modelo</span>
            </Link>
            <Link
              href="/manual"
              className="px-3 py-1.5 rounded-lg hover:text-rose-600 hover:bg-neutral-100 transition-colors hidden sm:inline-flex"
            >
              Manual & Ajuda
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 active:scale-95 transition-all"
            >
              <span>Acessar Painel</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 pb-20">
        {/* 3. HERO / CABEÇALHO DA PÁGINA DE PREÇOS */}
        <section className="pt-12 sm:pt-16 pb-8 sm:pb-12 px-4 sm:px-6 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 mb-4 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>Tabela Oficial de Planos & Tarifas</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-neutral-950 tracking-tight leading-[1.15]">
            Planos claros e justos para o{" "}
            <span className="text-rose-600">tamanho do seu salão</span>
          </h1>

          <p className="mt-4 sm:mt-5 text-base sm:text-lg text-neutral-600 max-w-2xl mx-auto font-normal leading-relaxed">
            Comece <strong>100% gratuito</strong> e evolua quando seu restaurante precisar de mais velocidade.
            Sem pegadinhas, sem comissão sobre pedidos e com a garantia de manutenção do que foi acordado.
          </p>
        </section>

        {/* 4. GRID DE 4 CARDS NO FORMATO HOSTINGER (HORIZONTAL 4 COLUNAS COM CARD DESTAQUE DARK) */}
        <section id="cards-planos" className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {/* =========================================
                CARD 1: FREE (DEGUSTAÇÃO)
               ========================================= */}
            <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between p-6 sm:p-7 relative group">
              <div>
                {/* Badge Superior Direito */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200">
                    100% GRATUITO
                  </span>
                </div>

                {/* Título & Descrição */}
                <h3 className="text-2xl font-black text-neutral-950 tracking-tight">
                  Free
                </h3>
                <p className="text-xs text-neutral-600 mt-2 min-h-[48px] leading-relaxed">
                  Crie seu cardápio digital sem custos. Ideal para quem está começando ou quer testar a tecnologia.
                </p>

                {/* Preços (Âncora Cortada + Preço Destaque com /mês) */}
                <div className="mt-6 mb-6">
                  <div className="text-xs text-neutral-400 line-through font-semibold">
                    R$ 0,00
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl sm:text-4xl font-black text-neutral-950 tracking-tight">
                      R$ 0
                    </span>
                    <span className="text-neutral-500 text-sm font-medium">
                      /mês
                    </span>
                  </div>
                </div>

                {/* Botão CTA */}
                <Link
                  href="/admin"
                  className="w-full py-3 px-4 rounded-xl text-center text-sm font-bold border-2 border-neutral-300 text-neutral-800 hover:border-neutral-950 hover:bg-neutral-950 hover:text-white transition-all flex items-center justify-center gap-2 group-hover:border-neutral-900"
                >
                  <span>Começar Grátis</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                {/* Subtexto Transparente (Formato Hostinger) */}
                <p className="text-[11px] text-neutral-500 text-center mt-3 leading-relaxed">
                  Sem necessidade de cartão de crédito. Uso gratuito por tempo indeterminado nas regras acordadas.
                </p>

                {/* Divisor */}
                <div className="h-px bg-neutral-100 my-6" />

                {/* Recursos Chave */}
                <div className="space-y-3 text-xs text-neutral-700">
                  <div className="font-bold text-neutral-900 text-[11px] uppercase tracking-wider">
                    O que está incluído:
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Até 10 mesas</strong> simultâneas</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Até 20 itens de menu</strong> cadastrados</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Cardápio Digital PWA ultra rápido</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>QR Codes de mesa instantâneos</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Zero comissão sobre os pedidos</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-neutral-400">
                    <X className="w-4 h-4 text-neutral-300 shrink-0 mt-0.5" />
                    <span className="line-through">Tela da Cozinha KDS em tempo real</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-neutral-400">
                    <X className="w-4 h-4 text-neutral-300 shrink-0 mt-0.5" />
                    <span className="line-through">Módulo do Garçom com chamados</span>
                  </div>
                </div>
              </div>

              {/* Caixa Bônus / Rodapé do Card (Estilo Hostinger) */}
              <div className="mt-6 pt-4 border-t border-neutral-100">
                <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/70 flex items-center gap-2.5">
                  <Gift className="w-4 h-4 text-neutral-700 shrink-0" />
                  <span className="text-[11px] font-bold text-neutral-800 leading-tight">
                    🖤 Black FreeDay: 10 mesas e 20 itens de menu liberados sem custos.
                  </span>
                </div>
              </div>
            </div>

            {/* =========================================
                CARD 2: PRO MENSAL
               ========================================= */}
            <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between p-6 sm:p-7 relative group">
              <div>
                {/* Badge Superior Direito */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                    MAIS FLEXÍVEL
                  </span>
                </div>

                {/* Título & Descrição */}
                <h3 className="text-2xl font-black text-neutral-950 tracking-tight">
                  PRO Mensal
                </h3>
                <p className="text-xs text-neutral-600 mt-2 min-h-[48px] leading-relaxed">
                  Para salões com ritmo ativo que buscam agilidade na cozinha e equipe de garçons sincronizada.
                </p>

                {/* Preços */}
                <div className="mt-6 mb-6">
                  <div className="text-xs text-neutral-400 line-through font-semibold">
                    R$ 69,90
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl sm:text-4xl font-black text-neutral-950 tracking-tight">
                      R$ 49,90
                    </span>
                    <span className="text-neutral-500 text-sm font-medium">
                      /mês
                    </span>
                  </div>
                </div>

                {/* Botão CTA */}
                <Link
                  href="/admin"
                  className="w-full py-3 px-4 rounded-xl text-center text-sm font-bold border-2 border-rose-600 text-rose-700 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <span>Escolher plano</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                {/* Subtexto Transparente */}
                <p className="text-[11px] text-neutral-500 text-center mt-3 leading-relaxed">
                  Cobrança mensal no cartão ou Pix via Mercado Pago. Cancele quando quiser, sem multas.
                </p>

                {/* Divisor */}
                <div className="h-px bg-neutral-100 my-6" />

                {/* Recursos Chave */}
                <div className="space-y-3 text-xs text-neutral-700">
                  <div className="font-bold text-neutral-900 text-[11px] uppercase tracking-wider">
                    Tudo do Free, mais:
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Até 30 mesas</strong> com QR Code dinâmico</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Até 60 itens de menu</strong> com fotos em HD</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>KDS Cozinha</strong> para sincronização de pedidos</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Módulo Garçom</strong> com chamada e fechamento</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Relatórios de giro e fechamento de turno</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Emissão de NFS-e oficial pela operadora</span>
                  </div>
                </div>
              </div>

              {/* Caixa Bônus / Rodapé do Card */}
              <div className="mt-6 pt-4 border-t border-neutral-100">
                <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200/80 flex items-center gap-2.5">
                  <ChefHat className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="text-[11px] font-bold text-rose-900 leading-tight">
                    🚀 Bônus: KDS Cozinha + Garçom ilimitados já inclusos na assinatura.
                  </span>
                </div>
              </div>
            </div>

            {/* =========================================
                CARD 3: PRO SEMESTRAL (DESTAQUE / O MAIS POPULAR - TEMA ESCURO DARK LUXURY IDÊNTICO À HOSTINGER)
               ========================================= */}
            <div className="bg-neutral-950 text-white rounded-3xl border-2 border-rose-500/80 shadow-2xl flex flex-col justify-between p-6 sm:p-7 relative ring-4 ring-rose-500/15 group transform md:-translate-y-2 transition-all">
              {/* Badge de Oferta Especial no Topo Centralizado/Direito */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-md shadow-rose-500/30">
                    <Sparkles className="w-3 h-3" />
                    Oferta especial · 17% OFF
                  </span>
                  <span className="text-[10px] font-bold text-amber-300">
                    MAIS VENDIDO
                  </span>
                </div>

                {/* Título & Descrição */}
                <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>PRO Semestral</span>
                  <Award className="w-5 h-5 text-amber-400" />
                </h3>
                <p className="text-xs text-neutral-300 mt-2 min-h-[48px] leading-relaxed">
                  O plano mais vantajoso. Máxima economia, relatórios analíticos e suporte prioritário no WhatsApp.
                </p>

                {/* Preços */}
                <div className="mt-6 mb-6">
                  <div className="text-xs text-neutral-400 line-through font-semibold">
                    R$ 349,00
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                      R$ 41,50
                    </span>
                    <span className="text-neutral-400 text-sm font-medium">
                      /mês
                    </span>
                  </div>
                </div>

                {/* Botão CTA Vibrante */}
                <Link
                  href="/admin"
                  className="w-full py-3.5 px-4 rounded-xl text-center text-sm font-black bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white shadow-lg shadow-rose-600/40 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <span>Escolher plano</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                {/* Subtexto Transparente (Formato Hostinger Detalhado) */}
                <p className="text-[11px] text-neutral-400 text-center mt-3 leading-relaxed">
                  Pague R$ 249,00 por 6 meses à vista no Pix com liberação imediata ou parcele em até 12x no cartão via Mercado Pago.
                </p>

                {/* Divisor */}
                <div className="h-px bg-neutral-800 my-6" />

                {/* Recursos Chave */}
                <div className="space-y-3 text-xs text-neutral-200">
                  <div className="font-bold text-amber-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tudo do PRO Mensal com Super Vantagens:</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span><strong>17% de desconto</strong> garantido em relação ao mensal</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span><strong>Até 30 mesas</strong> e <strong>60 itens de menu</strong></span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span><strong>KDS Cozinha + Garçom</strong> com múltiplos aparelhos</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span><strong>Suporte Prioritário</strong> direto pelo WhatsApp</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>Isenção total de qualquer taxa de implantação</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>Todas as novidades e atualizações incluídas</span>
                  </div>
                </div>
              </div>

              {/* Caixa Bônus / Rodapé do Card (Estilo Hostinger) */}
              <div className="mt-6 pt-4 border-t border-neutral-800">
                <div className="p-3 rounded-2xl bg-gradient-to-r from-neutral-900 to-neutral-800 border border-neutral-700/80 flex items-center gap-2.5">
                  <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-[11px] font-bold text-neutral-200 leading-tight">
                    🖤 Black FreeDay: Economize R$ 100 no período + Liberação Instantânea via Pix.
                  </span>
                </div>
              </div>
            </div>

            {/* =========================================
                CARD 4: PATROCINADO B2B
               ========================================= */}
            <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between p-6 sm:p-7 relative group">
              <div>
                {/* Badge Superior Direito */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    PARCERIA B2B
                  </span>
                </div>

                {/* Título & Descrição */}
                <h3 className="text-2xl font-black text-neutral-950 tracking-tight">
                  Patrocinado
                </h3>
                <p className="text-xs text-neutral-600 mt-2 min-h-[48px] leading-relaxed">
                  Plano PRO com mensalidade 100% custeada por distribuidoras, marcas de bebidas ou parceiros.
                </p>

                {/* Preços */}
                <div className="mt-6 mb-6">
                  <div className="text-xs text-neutral-400 line-through font-semibold">
                    R$ 49,90/mês
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl sm:text-4xl font-black text-neutral-950 tracking-tight">
                      R$ 0
                    </span>
                    <span className="text-neutral-500 text-sm font-medium">
                      /mês
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-700 font-bold mt-1">
                    (Custeado por marca parceira)
                  </div>
                </div>

                {/* Botão CTA */}
                <Link
                  href="/admin"
                  className="w-full py-3 px-4 rounded-xl text-center text-sm font-bold border-2 border-amber-500 text-amber-800 hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <span>Resgatar Voucher</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                {/* Subtexto Transparente */}
                <p className="text-[11px] text-neutral-500 text-center mt-3 leading-relaxed">
                  Válido mediante inserção de voucher concedido por distribuidora parceira de 6 meses.
                </p>

                {/* Divisor */}
                <div className="h-px bg-neutral-100 my-6" />

                {/* Recursos Chave */}
                <div className="space-y-3 text-xs text-neutral-700">
                  <div className="font-bold text-neutral-900 text-[11px] uppercase tracking-wider">
                    Diferenciais do Patrocínio:
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Todos os recursos do PRO</strong> liberados</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Sem custos mensais para o restaurante</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Banners discretos da marca patrocinadora</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Relatórios de visualizações para o parceiro</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Possibilidade de renovação a cada semestre</span>
                  </div>
                </div>
              </div>

              {/* Caixa Bônus / Rodapé do Card */}
              <div className="mt-6 pt-4 border-t border-neutral-100">
                <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/90 flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-amber-700 shrink-0" />
                  <span className="text-[11px] font-bold text-amber-900 leading-tight">
                    🤝 Marcas: Forneça cardápios e tenha destaque nos restaurantes.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. FAIXA DE SEGURANÇA E BANDEIRAS DE PAGAMENTO */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 mt-14 sm:mt-16">
          <div className="bg-white rounded-2xl border border-neutral-200/90 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
              <div>
                <h4 className="text-sm font-bold text-neutral-950 flex items-center justify-center md:justify-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Ambiente Seguro & Pagamento Simplificado</span>
                </h4>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Transações criptografadas com liberação automática de licenças.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>PIX Instantâneo</span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800 font-bold">
                  <CreditCard className="w-3.5 h-3.5 text-sky-600" />
                  <span>Mercado Pago até 12x</span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 font-bold">
                  <Lock className="w-3.5 h-3.5 text-blue-600" />
                  <span>SSL 256-Bit</span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-700 font-semibold">
                  <span>Opção PayPal</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. TABELA COMPARATIVA COMPLETA DE RECURSOS (FEATURE MATRIX) */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-16 sm:mt-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight">
              Compare os recursos detalhadamente
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Todos os limites e módulos de cada plano lado a lado
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/70">
                    <th className="py-4 px-4 sm:px-6 font-bold text-neutral-950 w-2/5">
                      Recursos & Limites
                    </th>
                    <th className="py-4 px-3 sm:px-4 text-center font-bold text-neutral-700">
                      Free
                    </th>
                    <th className="py-4 px-3 sm:px-4 text-center font-bold text-neutral-700">
                      PRO Mensal
                    </th>
                    <th className="py-4 px-3 sm:px-4 text-center font-bold text-rose-600 bg-rose-50/50">
                      PRO Semestral
                    </th>
                    <th className="py-4 px-3 sm:px-4 text-center font-bold text-amber-700">
                      Patrocinado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  <tr>
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-neutral-900">
                      Preço
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center font-bold text-neutral-900">
                      R$ 0
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center font-bold text-neutral-900">
                      R$ 49,90/mês
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center font-black text-rose-600 bg-rose-50/30">
                      R$ 41,50/mês
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center font-bold text-neutral-900">
                      R$ 0 (parceiro)
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-neutral-900">
                      Capacidade de Mesas
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center font-bold text-neutral-800">
                      Até 10 mesas
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center font-bold text-neutral-800">
                      Até 30 mesas
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center font-bold text-rose-700 bg-rose-50/30">
                      Até 30 mesas
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center font-bold text-neutral-800">
                      Até 30 mesas
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-neutral-900">
                      Capacidade de Itens de Menu
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center font-bold text-neutral-800">
                      Até 20 itens
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center font-bold text-neutral-800">
                      Até 60 itens
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center font-bold text-rose-700 bg-rose-50/30">
                      Até 60 itens
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center font-bold text-neutral-800">
                      Até 60 itens
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-neutral-900">
                      Cardápio Digital PWA sem Instalação
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center bg-rose-50/30">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-neutral-900">
                      QR Codes Dinâmicos para Mesas
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center bg-rose-50/30">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-neutral-900">
                      KDS Cozinha em Tempo Real
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <X className="w-4 h-4 text-neutral-300 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center bg-rose-50/30">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-neutral-900">
                      Módulo Garçom (Chamadas & Fechamento)
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <X className="w-4 h-4 text-neutral-300 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center bg-rose-50/30">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-neutral-900">
                      Relatórios Analíticos & Histórico
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <X className="w-4 h-4 text-neutral-300 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center bg-rose-50/30">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-neutral-900">
                      Manutenção de Acordo (Grandfathering)
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <CheckCircle2 className="w-4 h-4 text-rose-600 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <CheckCircle2 className="w-4 h-4 text-rose-600 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center bg-rose-50/30">
                      <CheckCircle2 className="w-4 h-4 text-rose-600 mx-auto" />
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center">
                      <CheckCircle2 className="w-4 h-4 text-rose-600 mx-auto" />
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-neutral-900">
                      Suporte ao Cliente
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center text-neutral-600 text-xs">
                      Central & Comunidade
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center text-neutral-800 text-xs font-semibold">
                      E-mail e Ticket
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center text-rose-700 bg-rose-50/30 text-xs font-bold">
                      WhatsApp Prioritário
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center text-neutral-800 text-xs font-semibold">
                      Parceiro & Suporte
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 7. FAQ DE COBRANÇAS E DÚVIDAS FREQUENTES */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 mt-16 sm:mt-20">
          <div className="text-center mb-8 sm:mb-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 mb-2">
              <HelpCircle className="w-3.5 h-3.5" />
              Perguntas Frequentes
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight">
              Tudo o que você precisa saber sobre nossos planos
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                pergunta: "Preciso informar cartão de crédito para usar a versão Free?",
                resposta:
                  "Não! Você pode criar sua conta imediatamente em menos de 1 minuto sem precisar cadastrar cartão de crédito ou qualquer meio de pagamento. O plano Free é 100% gratuito e já inclui até 10 mesas e até 20 itens de menu cadastrados.",
              },
              {
                pergunta: "Como funciona a garantia de manutenção do acordo (Grandfathering)?",
                resposta:
                  "Respeitamos profundamente os acordos firmados com quem confia na MAYaMenu. Cada plano ativo possui uma ID única e características registradas. Se no futuro as regras gerais do plano Free mudarem para novos entrantes, o seu estabelecimento continuará desfrutando das regras vigentes no momento do seu cadastro.",
              },
              {
                pergunta: "Quais são as formas de pagamento disponíveis no PRO?",
                resposta:
                  "Processamos todos os pagamentos com a segurança do Mercado Pago. Você pode pagar via PIX com aprovação e liberação imediata da licença em segundos, ou no cartão de crédito com parcelamento em até 12 vezes. Para casos institucionais especiais, também temos suporte a PayPal.",
              },
              {
                pergunta: "Existe fidelidade ou multa por cancelamento?",
                resposta:
                  "Nenhuma fidelidade e zero multas rescisórias. No plano PRO Mensal você pode suspender ou cancelar a qualquer momento sem taxas. No plano Semestral, você garante a tarifa com 17% de desconto pelo período contratado.",
              },
              {
                pergunta: "Vocês emitem Nota Fiscal (NFS-e)?",
                resposta:
                  "Sim, com total conformidade fiscal. Todas as assinaturas do plano PRO recebem Nota Fiscal de Serviços Eletrônica emitida pela operadora MAYARANAS SISTEMAS INOVA SIMPLES (I.S.), CNPJ 70.099.118/0001-02.",
              },
              {
                pergunta: "Como funciona o plano Patrocinado B2B?",
                resposta:
                  "É um modelo inovador onde grandes indústrias, distribuidoras de bebidas ou parceiros comerciais financiam as licenças PRO dos restaurantes de sua região em troca de exibição discreta da sua marca no cardápio digital. Se você recebeu um voucher de uma distribuidora parceira, você tem acesso ao PRO com custo zero.",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-neutral-200 bg-white overflow-hidden transition-all shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full py-4 px-5 sm:px-6 text-left flex items-center justify-between gap-4 font-bold text-neutral-950 text-sm sm:text-base hover:text-rose-600 transition-colors"
                >
                  <span>{item.pergunta}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform duration-200 ${
                      faqAberto === idx ? "rotate-180 text-rose-600" : ""
                    }`}
                  />
                </button>
                {faqAberto === idx && (
                  <div className="px-5 sm:px-6 pb-5 pt-1 text-xs sm:text-sm text-neutral-600 leading-relaxed border-t border-neutral-100 bg-neutral-50/50">
                    {item.resposta}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 8. BANNER CTA FINAL */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 mt-16 sm:mt-24">
          <div className="rounded-3xl bg-neutral-950 text-white p-8 sm:p-12 text-center relative overflow-hidden shadow-xl border border-neutral-800">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold uppercase tracking-wider mb-4 border border-rose-500/30">
                🖤 Black FreeDay Ativa
              </span>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                Pronto para transformar a experiência do seu salão?
              </h2>
              <p className="mt-3 sm:mt-4 text-xs sm:text-base text-neutral-300 leading-relaxed">
                Comece gratuitamente hoje mesmo ou garanta o plano PRO com 17% de desconto. Ativação imediata em menos de 1 minuto.
              </p>

              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/admin"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/30 active:scale-95 transition-all text-center"
                >
                  Experimentar a Versão Free
                </Link>
                <Link
                  href="/demo"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-neutral-700 hover:border-neutral-500 text-neutral-200 hover:text-white font-semibold text-sm transition-all text-center flex items-center justify-center gap-2"
                >
                  <Store className="w-4 h-4 text-rose-400" />
                  <span>Ver Restaurante Modelo</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 9. RODAPÉ INSTITUCIONAL OFICIAL */}
      <footer className="border-t border-neutral-200 bg-white py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-neutral-500">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="font-bold text-neutral-900">
              MAYARANAS SISTEMAS INOVA SIMPLES (I.S.) • CNPJ: 70.099.118/0001-02
            </span>
            <span>Horizonte, Ceará, Brasil • Suporte: contato@mayamenu.com.br</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 font-semibold">
            <Link href="/" className="hover:text-rose-600 transition-colors">
              Página Inicial
            </Link>
            <Link href="/demo" className="hover:text-rose-600 transition-colors">
              Restaurante Modelo
            </Link>
            <Link href="/manual" className="hover:text-rose-600 transition-colors">
              Manual de Instruções
            </Link>
            <Link href="/termos-de-uso" className="hover:text-rose-600 transition-colors">
              Termos de Uso
            </Link>
            <Link href="/politica-de-privacidade" className="hover:text-rose-600 transition-colors">
              Política de Privacidade (LGPD)
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

