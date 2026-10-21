// src/lib/datas.ts
// Fonte única para converter qualquer representação de data (Firestore ou local) em milissegundos.

/**
 * Converte qualquer formato de data para milissegundos de forma segura.
 * Aceita: number, Date, string (ISO), Firestore Timestamp (`toMillis` / `toDate`)
 * e Timestamps serializados (`{ seconds, nanoseconds }` ou `{ _seconds, _nanoseconds }`).
 * Retorna `null` quando o valor está ausente ou é inválido (inclusive datas que resultariam em NaN).
 */
export function parseDateToMillis(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;

  let millis: number | null = null;

  if (typeof valor === "number") {
    millis = valor;
  } else if (valor instanceof Date) {
    millis = valor.getTime();
  } else if (typeof valor === "string") {
    millis = new Date(valor).getTime();
  } else if (typeof valor === "object") {
    const v = valor as {
      toMillis?: () => number;
      toDate?: () => Date;
      seconds?: number;
      nanoseconds?: number;
      _seconds?: number;
      _nanoseconds?: number;
    };
    if (typeof v.toMillis === "function") {
      millis = v.toMillis();
    } else if (typeof v.toDate === "function") {
      millis = v.toDate().getTime();
    } else if (typeof v.seconds === "number") {
      millis = v.seconds * 1000 + Math.floor((v.nanoseconds ?? 0) / 1e6);
    } else if (typeof v._seconds === "number") {
      millis = v._seconds * 1000 + Math.floor((v._nanoseconds ?? 0) / 1e6);
    }
  }

  return millis !== null && Number.isFinite(millis) ? millis : null;
}

/**
 * Atalho para ordenações e comparações: devolve os milissegundos ou o `fallback` informado
 * (padrão 0) quando a data estiver ausente/inválida.
 */
export function millisOu(valor: unknown, fallback = 0): number {
  return parseDateToMillis(valor) ?? fallback;
}
