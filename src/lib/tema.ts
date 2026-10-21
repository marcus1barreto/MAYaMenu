import type { Restaurante } from "@/types";

export type TemaId =
  | "white-label"
  | "dark-elegante"
  | "brasa-fogo"
  | "fresh-nature"
  | "neon-pub";

export interface TemaDef {
  id: TemaId;
  nome: string;
  descricao: string;
  classe: string;
  corAmostra: string;
  corPrimaria: string;
}

export const TEMAS_DISPONIVEIS: TemaDef[] = [
  {
    id: "white-label",
    nome: "Padrão White-Label",
    descricao: "Estilo limpo, fundo branco absoluto e botão vermelho chama-fome (estilo iFood)",
    classe: "", // Vazio = herda :root seguro diretamente
    corAmostra: "#FFFFFF",
    corPrimaria: "#E11D48",
  },
  {
    id: "dark-elegante",
    nome: "Dark Elegante",
    descricao: "Alta gastronomia, fundo chumbo (Zinc 950) e botões dourados requintados",
    classe: "theme-dark-elegante",
    corAmostra: "#09090b",
    corPrimaria: "#F59E0B",
  },
  {
    id: "brasa-fogo",
    nome: "Brasa & Fogo",
    descricao: "Hamburguerias, churrascarias e fast-food, fundo carbono e botões laranja brasa",
    classe: "theme-brasa-fogo",
    corAmostra: "#140e0c",
    corPrimaria: "#F97316",
  },
  {
    id: "fresh-nature",
    nome: "Fresh & Nature",
    descricao: "Saudável, cafés e orgânicos, fundo areia suave e botões verde esmeralda",
    classe: "theme-fresh-nature",
    corAmostra: "#FAF9F6",
    corPrimaria: "#059669",
  },
  {
    id: "neon-pub",
    nome: "Neon Pub",
    descricao: "Baladas, bares e food trucks noturnos, fundo azul profundo e botões violeta neon",
    classe: "theme-neon-pub",
    corAmostra: "#020617",
    corPrimaria: "#8B5CF6",
  },
];

/**
 * Retorna a classe CSS correspondente ao tema configurado no restaurante.
 * Se nenhum tema estiver configurado ou for 'light'/'white-label', retorna string vazia (usando :root).
 */
export function obterClasseTema(tema?: string | null): string {
  if (!tema || tema === "white-label" || tema === "light") {
    return "";
  }
  if (tema === "dark" || tema === "dark-elegante") {
    return "theme-dark-elegante";
  }
  if (tema === "brasa-fogo") {
    return "theme-brasa-fogo";
  }
  if (tema === "fresh-nature") {
    return "theme-fresh-nature";
  }
  if (tema === "neon-pub") {
    return "theme-neon-pub";
  }
  return "";
}

/**
 * Helper para resolver a classe de tema a partir do objeto restaurante.
 */
export function resolverClasseTemaRestaurante(restaurante?: Restaurante | null): string {
  return obterClasseTema(restaurante?.configuracoes?.tema);
}
