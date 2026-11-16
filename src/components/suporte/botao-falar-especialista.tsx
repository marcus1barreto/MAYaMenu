"use client";

import React, { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EspecialistaAssistenteModal } from "./especialista-assistente-modal";

export function BotaoFalarEspecialista({
  origem = "precos",
}: {
  origem?: string;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setAberto(true)}
        className="h-11 px-5 rounded-xl border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-sm flex items-center gap-2"
      >
        <MessageSquareText className="w-4 h-4 text-rose-600" />
        <span>Falar com Especialista</span>
      </Button>

      <EspecialistaAssistenteModal
        open={aberto}
        onOpenChange={setAberto}
        origem={origem}
      />
    </>
  );
}
