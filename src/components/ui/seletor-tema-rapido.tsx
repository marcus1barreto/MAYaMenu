"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTemaUsuario } from "@/context/tema-context";
import { TEMAS_DISPONIVEIS, FAMILIAS_TEMAS, type TemaId } from "@/lib/tema";
import { Sparkles, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SeletorTemaRapidoProps {
  rotulo?: string;
  classeBotao?: string;
}

export function SeletorTemaRapido(_props: SeletorTemaRapidoProps) {
  // Retorna null para garantir que nenhuma tela operacional exiba controles de temas
  return null;
}
