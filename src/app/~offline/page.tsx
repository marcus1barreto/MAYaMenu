import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sem conexão",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Você está sem internet</h1>
      <p className="max-w-sm text-muted-foreground">
        Seu pedido não foi perdido. Se já finalizou, mostre o QR Code do seu ticket ao garçom.
      </p>
    </main>
  );
}
