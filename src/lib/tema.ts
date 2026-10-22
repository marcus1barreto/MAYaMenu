import type { Restaurante } from "@/types";

export type FamiliaId =
  | "fast-furious"
  | "brisa-natureza"
  | "boemia-noturna"
  | "premium-tradicao"
  | "acessibilidade-foco";

export type TemaId =
  | "white-label"
  | "fast-carbono"
  | "brisa-areia"
  | "boemia-marinho"
  | "premium-asfalto"
  | "acessibilidade-sepia"
  // Aliases / retrocompatibilidade
  | "padrao"
  | "fast-furious"
  | "boemia-noturna"
  | "premium-tradicao"
  | "brisa-natureza"
  | "descanso-vista"
  | "dark-elegante"
  | "brasa-fogo"
  | "fresh-nature"
  | "neon-pub"
  | "descanso-visual"
  | "dark"
  | "light";

export interface TemaDef {
  id: TemaId;
  familiaId: FamiliaId;
  nome: string;
  subtitulo: string;
  descricao: string;
  classe: string;
  corAmostra: string;
  corPrimaria: string;
  corTexto: string;
  tagline: string;
  badge?: string;
  fonteTitulo?: "sans" | "serif";
}

export interface FamiliaTemaDef {
  id: FamiliaId;
  icone: string;
  nome: string;
  publico: string;
  psicologia: string;
  temas: TemaDef[];
}

export const FAMILIAS_TEMAS: FamiliaTemaDef[] = [
  {
    id: "fast-furious",
    icone: "🍔",
    nome: "Fast & Furious",
    publico: "Fast foods, Hamburgueria, Food truck, Lanchonete, Espetaria",
    psicologia: "Fome urgente, decisão por impulso, ticket menor e alto giro de mesas.",
    temas: [
      {
        id: "fast-carbono",
        familiaId: "fast-furious",
        nome: "Carbono & Brasa",
        subtitulo: "Fundo Carbono Quente #1C1917",
        descricao: "Fundo escuro apetitoso que realça cores dos lanches e botões em Laranja Fogo.",
        classe: "theme-fast-carbono",
        corAmostra: "#1C1917",
        corPrimaria: "#F97316",
        corTexto: "#FDF8F6",
        tagline: "Alta Rotação",
        badge: "Mais Vendido",
      },
    ],
  },
  {
    id: "brisa-natureza",
    icone: "🍹",
    nome: "Brisa & Natureza",
    publico: "Sucos, Barraca de Praia, Quiosques, Açaí, Saladerias e Orgânicos",
    psicologia: "Refrescância, leveza, saúde, ambiente diurno e descontraído.",
    temas: [
      {
        id: "brisa-areia",
        familiaId: "brisa-natureza",
        nome: "Areia & Esmeralda",
        subtitulo: "Fundo Areia #FAFAF9 e Verde",
        descricao: "Evoca papel reciclado e praia, com botões Esmeralda e textos em café escuro suave.",
        classe: "theme-brisa-areia",
        corAmostra: "#FAFAF9",
        corPrimaria: "#059669",
        corTexto: "#1C1917",
        tagline: "Leveza & Dia",
      },
    ],
  },
  {
    id: "boemia-noturna",
    icone: "🍕",
    nome: "Boemia Noturna",
    publico: "Pizzarias, Barzinhos, Pubs, Coquetelaria e Espetarias Noturnas",
    psicologia: "Luz ambiente baixa; tela suave que não cega o cliente relaxado com drinques.",
    temas: [
      {
        id: "boemia-marinho",
        familiaId: "boemia-noturna",
        nome: "Marinho & Ciano Neon",
        subtitulo: "Azul Marinho Profundo #020617",
        descricao: "Fundo ultra escuro aveludado com destaque inteligente em ciano e textos suaves.",
        classe: "theme-boemia-marinho",
        corAmostra: "#020617",
        corPrimaria: "#06B6D4",
        corTexto: "#F8FAFC",
        tagline: "Penumbra Confortável",
      },
    ],
  },
  {
    id: "premium-tradicao",
    icone: "🥩",
    nome: "Premium & Tradição",
    publico: "Restaurantes clássicos, Churrascarias nobres, Bistrôs, Alta Gastronomia",
    psicologia: "Espaço para respirar (White Space), elegância, valor percebido e sofisticação.",
    temas: [
      {
        id: "premium-asfalto",
        familiaId: "premium-tradicao",
        nome: "Preto Asfalto & Ouro",
        subtitulo: "Asfalto Elegante #09090B e Dourado",
        descricao: "Tipografia serifada nobre nos títulos dos pratos e detalhes em Ouro Nobre.",
        classe: "theme-premium-asfalto",
        corAmostra: "#09090B",
        corPrimaria: "#D97706",
        corTexto: "#FAFAFA",
        tagline: "Alto Ticket",
        fonteTitulo: "serif",
      },
    ],
  },
  {
    id: "acessibilidade-foco",
    icone: "👁️",
    nome: "Acessibilidade & Foco",
    publico: "Modo leitura, clientes sensíveis à luz, normas WCAG e padrão clean",
    psicologia: "Máxima legibilidade, alívio de vista (Solarized) e neutralidade universal.",
    temas: [
      {
        id: "white-label",
        familiaId: "acessibilidade-foco",
        nome: "Claro Clássico (iFood)",
        subtitulo: "Fundo Branco #FFFFFF e Carmesim",
        descricao: "Contraste absoluto, base sólida de ouro do e-commerce com botão vermelho chama-fome.",
        classe: "", // Padrão no :root
        corAmostra: "#FFFFFF",
        corPrimaria: "#E11D48",
        corTexto: "#09090B",
        tagline: "WCAG 2.1 AAA",
      },
      {
        id: "acessibilidade-sepia",
        familiaId: "acessibilidade-foco",
        nome: "Descanso de Vista (Sépia)",
        subtitulo: "Solarized Paper #FDF6E3",
        descricao: "Fundo âmbar muito suave que reduz a luz azul em 80%, sem contraste agressivo.",
        classe: "theme-acessibilidade-sepia",
        corAmostra: "#FDF6E3",
        corPrimaria: "#C26D2B",
        corTexto: "#2D221A",
        tagline: "Eye-care & Conforto",
        badge: "Recomendado à Noite",
      },
    ],
  },
];

// Lista linear contendo todos os temas para seleção e dropdowns
export const TEMAS_DISPONIVEIS: TemaDef[] = FAMILIAS_TEMAS.flatMap((f) => f.temas);

/**
 * Retorna a classe CSS correspondente ao tema configurado no restaurante.
 * Se nenhum tema estiver configurado ou for 'light'/'white-label', retorna string vazia (usando :root).
 */
export function obterClasseTema(tema?: string | null): string {
  if (!tema || tema === "white-label" || tema === "padrao" || tema === "light") {
    return "";
  }
  // Mapeamentos novos das 5 Famílias
  if (tema === "fast-carbono" || tema === "fast-furious" || tema === "brasa-fogo") {
    return "theme-fast-carbono";
  }
  if (tema === "brisa-areia" || tema === "brisa-natureza" || tema === "fresh-nature") {
    return "theme-brisa-areia";
  }
  if (tema === "boemia-marinho" || tema === "boemia-noturna" || tema === "neon-pub") {
    return "theme-boemia-marinho";
  }
  if (tema === "premium-asfalto" || tema === "premium-tradicao" || tema === "dark-elegante" || tema === "dark") {
    return "theme-premium-asfalto";
  }
  if (tema === "acessibilidade-sepia" || tema === "descanso-vista" || tema === "descanso-visual") {
    return "theme-acessibilidade-sepia";
  }

  return "";
}

/**
 * Helper para resolver a classe de tema a partir do objeto restaurante.
 */
export function resolverClasseTemaRestaurante(restaurante?: Restaurante | null): string {
  return obterClasseTema(restaurante?.configuracoes?.tema);
}
