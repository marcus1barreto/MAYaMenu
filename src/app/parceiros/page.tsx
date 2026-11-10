"use client";

import React, { useState, useEffect } from "react";
import { B2BLogin } from "@/components/b2b/b2b-login";
import { B2BPortal } from "@/components/b2b/b2b-portal";
import { buscarPatrocinadorPorChave } from "@/lib/b2b-service";
import type { PatrocinadorB2B } from "@/types/b2b";

export default function ParceirosPage() {
  const [patrocinador, setPatrocinador] = useState<PatrocinadorB2B | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Recupera sessão ativa no sessionStorage
  useEffect(() => {
    const tokenSalvo = sessionStorage.getItem("mayamenu_b2b_token");
    const dadosSalvos = sessionStorage.getItem("mayamenu_b2b_patrocinador");

    if (dadosSalvos) {
      try {
        setPatrocinador(JSON.parse(dadosSalvos));
      } catch {
        // Ignora erro de parse
      }
    }

    if (tokenSalvo) {
      buscarPatrocinadorPorChave(tokenSalvo)
        .then((pat) => {
          if (pat) {
            setPatrocinador(pat);
            sessionStorage.setItem("mayamenu_b2b_patrocinador", JSON.stringify(pat));
          }
        })
        .finally(() => setCarregando(false));
    } else {
      setCarregando(false);
    }
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("mayamenu_b2b_token");
    sessionStorage.removeItem("mayamenu_b2b_patrocinador");
    setPatrocinador(null);
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <div className="text-xs uppercase font-bold tracking-widest text-zinc-500 animate-pulse">
          Carregando Portal B2B...
        </div>
      </div>
    );
  }

  if (patrocinador) {
    return <B2BPortal patrocinador={patrocinador} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden selection:bg-blue-600 selection:text-white">
      {/* Glows de ambientação externa */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-blue-600/15 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full bg-rose-600/10 blur-[120px] pointer-events-none" />

      <B2BLogin onAutenticado={setPatrocinador} />
    </div>
  );
}
