"use client";

import React, { useState } from "react";
import { EspecialistaAssistenteModal } from "./especialista-assistente-modal";

export function BannerLancamentoContato() {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <div className="w-full bg-amber-400 text-neutral-950 text-xs sm:text-sm font-semibold px-3 py-1.5 text-center border-b border-amber-500/40">
        Este aplicativo está em teste de lançamento. Se quiser,{" "}
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="underline font-bold hover:text-neutral-800 cursor-pointer"
        >
          tire dúvidas ou deixe um contato para nos falarmos
        </button>
        .
      </div>

      <EspecialistaAssistenteModal
        open={aberto}
        onOpenChange={setAberto}
        origem="banner_lancamento"
      />
    </>
  );
}
