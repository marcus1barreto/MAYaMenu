"use client";

import { useNetworkStatus } from "@/hooks/use-network-status";
import { WifiOff, AlertTriangle } from "lucide-react";

export function OfflineBanner() {
  const { isOffline } = useNetworkStatus();

  if (!isOffline) return null;

  return (
    <div className="sticky top-0 z-[100] w-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-neutral-950 font-bold px-4 py-2 shadow-md transition-all flex items-center justify-center gap-2 text-xs sm:text-sm">
      <WifiOff className="w-4 h-4 text-neutral-950 shrink-0 animate-pulse" />
      <span>Conexão instável. Operando em modo offline. Sincronização pendente.</span>
    </div>
  );
}
