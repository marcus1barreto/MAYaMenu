"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function B2BRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/parceiros");
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
      <div className="text-xs uppercase font-bold tracking-widest text-zinc-500 animate-pulse">
        Redirecionando para o Portal B2B de Parceiros...
      </div>
    </div>
  );
}
