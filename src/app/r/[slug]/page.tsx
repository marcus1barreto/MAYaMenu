import { Suspense } from "react";
import { obterRestaurantePorSlug, obterCardapioDoRestaurante } from "@/lib/restaurante-service";
import { MenuView } from "@/components/cliente/menu-view";
import { CartProvider } from "@/context/cart-context";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cardápio Digital | MAYaMenu",
  description: "Faça seu pedido diretamente na mesa sem filas ou esperas.",
};

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

  const restaurante = await obterRestaurantePorSlug(slug);
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
