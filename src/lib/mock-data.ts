// Mock e dados de demonstração com os assets existentes no projeto
// Utilizado como fallback para renderização instantânea (SSR/ISR) ou quando o banco não tiver dados cadastrados.

import type { MenuItem, Restaurante } from "@/types";

export const RESTAURANTE_DEMO: Restaurante = {
  id: "rest-demo-alpha",
  ownerId: "owner-demo-uid",
  slug: "demo",
  nome: "MAYaBurger & Co.",
  configuracoes: {
    corPrimaria: "#E11D48", // Rose-600 vibrante e elegante
    tema: "light",
    capaUrl: "/images/capa-padrao.webp",
    modoOperacao: "hibrido",
  },
};

export const CARDAPIO_DEMO: MenuItem[] = [
  {
    id: "item-burguer-artesanal",
    nome: "MAYaBurger Especial",
    categoria: "Hambúrgueres",
    descricao: "Blend 180g de angus, queijo cheddar inglês derretido, cebola caramelizada e maionese defumada no brioche tostado na manteiga.",
    precoBase: 38.0,
    fotoUrl: "/images/demo/hamburger.webp",
    ativo: true,
    grupoModificadores: [
      {
        nome: "Ponto da Carne",
        obrigatorio: true,
        minimo: 1,
        maximo: 1,
        opcoes: [
          { nome: "Ao Ponto", precoAdicional: 0 },
          { nome: "Bem Passado", precoAdicional: 0 },
          { nome: "Ao Ponto para Mal", precoAdicional: 0 },
        ],
      },
      {
        nome: "Adicionais do Chef",
        obrigatorio: false,
        minimo: 0,
        maximo: 3,
        opcoes: [
          { nome: "Bacon Crocante Duplo", precoAdicional: 6.0 },
          { nome: "Queijo Extra", precoAdicional: 4.5 },
          { nome: "Molho Especial Extra", precoAdicional: 3.0 },
        ],
      },
    ],
  },
  {
    id: "item-pizza-napolitana",
    nome: "Pizza Napolitana Rústica",
    categoria: "Pizzas",
    descricao: "Massa de fermentação natural (48h), molho de tomate San Marzano D.O.P., mozzarella di bufala e manjericão fresco.",
    precoBase: 54.0,
    fotoUrl: "/images/demo/pizza.webp",
    ativo: true,
    grupoModificadores: [
      {
        nome: "Borda Recheada",
        obrigatorio: false,
        minimo: 0,
        maximo: 1,
        opcoes: [
          { nome: "Catupiry Original", precoAdicional: 8.0 },
          { nome: "Cheddar Cremoso", precoAdicional: 7.0 },
        ],
      },
    ],
  },
  {
    id: "item-coquetel-tropical",
    nome: "Coquetel Sunburst Maya",
    categoria: "Bebidas",
    descricao: "Gin artesanal infusionado com zimbro, xarope de frutas vermelhas frescas, tônica premium e ramo de alecrim maçaricado.",
    precoBase: 29.0,
    fotoUrl: "/images/demo/coquetel.webp",
    ativo: true,
    grupoModificadores: [
      {
        nome: "Versão",
        obrigatorio: true,
        minimo: 1,
        maximo: 1,
        opcoes: [
          { nome: "Com Álcool (Gin Artesanal)", precoAdicional: 0 },
          { nome: "Sem Álcool (Mocktail)", precoAdicional: -4.0 },
        ],
      },
    ],
  },
  {
    id: "item-sorvete-artesanal",
    nome: "Gelato Pistache & Frutas Vermelhas",
    categoria: "Sobremesas",
    descricao: "Taça artesanal com duas bolas de gelato italiano de pistache siciliano com calda quente de frutas silvestres.",
    precoBase: 22.0,
    fotoUrl: "/images/demo/sorvete.webp",
    ativo: true,
    grupoModificadores: [
      {
        nome: "Cobertura Adicional",
        obrigatorio: false,
        minimo: 0,
        maximo: 2,
        opcoes: [
          { nome: "Farofa Crocante de Castanhas", precoAdicional: 3.5 },
          { nome: "Chantilly Fresco", precoAdicional: 2.5 },
        ],
      },
    ],
  },
];
