import { Suspense } from "react";
import { RESTAURANTE_DEMO, CARDAPIO_DEMO } from "@/lib/mock-data";
import { MenuView } from "@/components/cliente/menu-view";
import { CartProvider } from "@/context/cart-context";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `${RESTAURANTE_DEMO.nome} | Cardápio Digital`,
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

  const restaurante = {
    ...RESTAURANTE_DEMO,
    slug,
  };

  return (
    <CartProvider slug={slug} mesaInicial={numeroMesa}>
      <MenuView
        restaurante={restaurante}
        cardapio={CARDAPIO_DEMO}
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
