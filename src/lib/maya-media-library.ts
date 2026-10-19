// src/lib/maya-media-library.ts
// Galeria de Fotos Profissionais MAYa Media Library
// Fotos otimizadas de alta resolução para uso imediato pelo lojista

export interface FotoGaleriaMaya {
  id: string;
  titulo: string;
  categoria: string;
  url: string;
  thumbnail: string;
  tags: string[];
}

export const MAYA_MEDIA_LIBRARY: FotoGaleriaMaya[] = [
  {
    id: "maya-burger-artesanal",
    titulo: "Burger Artesanal Supremo",
    categoria: "Lanches",
    url: "/images/demo/hamburger.webp",
    thumbnail: "/images/demo/hamburger.webp",
    tags: ["hambúrguer", "artesanal", "lanche", "carne", "cheddar"],
  },
  {
    id: "maya-pizza-napolitana",
    titulo: "Pizza Napolitana Rústica",
    categoria: "Pizzas",
    url: "/images/demo/pizza.webp",
    thumbnail: "/images/demo/pizza.webp",
    tags: ["pizza", "napolitana", "queijo", "manjericão", "italiana"],
  },
  {
    id: "maya-coquetel-tropical",
    titulo: "Coquetel Sunburst Maya",
    categoria: "Bebidas",
    url: "/images/demo/coquetel.webp",
    thumbnail: "/images/demo/coquetel.webp",
    tags: ["coquetel", "drink", "bebida", "gin", "frutas"],
  },
  {
    id: "maya-gelato-silvestre",
    titulo: "Gelato Silvestre Artesanal",
    categoria: "Sobremesas",
    url: "/images/demo/sorvete.webp",
    thumbnail: "/images/demo/sorvete.webp",
    tags: ["sobremesa", "gelato", "sorvete", "doce", "pistache"],
  },
  {
    id: "maya-porcao-petisco",
    titulo: "Porções & Aperitivos",
    categoria: "Porções",
    url: "/images/demo/hamburger.webp",
    thumbnail: "/images/demo/hamburger.webp",
    tags: ["porção", "batata", "petisco", "bar", "aperitivo"],
  },
];
