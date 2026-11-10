"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function B2BRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/parceiros");
  }, [router]);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center text-neutral-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-600 to-red-600 flex items-center justify-center text-white font-black text-lg animate-pulse shadow-md shadow-rose-600/20">
          M
        </div>
        <div className="text-xs font-bold tracking-wider uppercase text-neutral-400">
          Redirecionando para o Portal de Parceiros...
        </div>
      </div>
    </div>
  );
}

