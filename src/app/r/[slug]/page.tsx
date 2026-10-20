import { Suspense } from "react";
import Link from "next/link";
import { obterRestaurantePorSlugValido, obterCardapioDoRestaurante } from "@/lib/restaurante-service";
import { MenuView } from "@/components/cliente/menu-view";
import { CartProvider } from "@/context/cart-context";
import { Store, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cardápio Digital | MAYaMenu",
  description: "Faça seu pedido diretamente na mesa sem filas ou esperas.",
};

// Revalidação em segundo plano (Incremental Static Regeneration - ISR)
// Permite que o Firebase App Hosting e o CDN do Google Cloud sirvam o cardápio em cache estático
// e façam revalidação automática a cada 60 segundos se houver novas requisições.
export const revalidate = 60;

async function MenuContent({
  paramsPromise,
  searchParamsPromise,
}: {
  paramsPromise: Promise<{ slug: string }>;
  searchParamsPromise: Promise<{ mesa?: string }>;
}) {
  const { slug } = await paramsPromise;
  const { mesa } = await searchParamsPromise;
  const numeroMesa = mesa ? Number(mesa) || mesa : 1;

  // Tenant Existence Guard: bloqueia renderização de apps fantasmas se o restaurante não existir
  const restaurante = await obterRestaurantePorSlugValido(slug);

  if (!restaurante) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 text-center antialiased">
        <div className="max-w-md w-full bg-neutral-900/60 border border-neutral-800 p-8 rounded-3xl backdrop-blur-md shadow-2xl flex flex-col items-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Store className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Cardápio Temporariamente Indisponível
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              O estabelecimento solicitado não foi encontrado ou está em processo de ativação. Por favor, solicite o QR Code atualizado ao garçom ou à equipe do balcão.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-xs font-bold text-neutral-200 transition-all border border-neutral-700"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-400" />
            <span>Voltar ao Início</span>
          </Link>
        </div>
      </main>
    );
  }

  const cardapio = await obterCardapioDoRestaurante(restaurante.id);

  return (
    <CartProvider slug={slug} mesaInicial={numeroMesa}>
      <MenuView
        restaurante={restaurante}
        cardapio={cardapio}
        numeroMesa={numeroMesa}
      />
    </CartProvider>
  );
}

export default function PublicMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mesa?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-900 flex items-center justify-center text-white">
          <div className="animate-pulse text-sm font-semibold tracking-wider uppercase">
            Carregando Cardápio...
          </div>
        </div>
      }
    >
      <MenuContent paramsPromise={params} searchParamsPromise={searchParams} />
    </Suspense>
  );
}
