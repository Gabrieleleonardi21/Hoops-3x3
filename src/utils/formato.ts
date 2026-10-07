/** Testi brevi ripetuti nelle pagine, scritti in un posto solo (FP-5). */

/** La lettera di un girone dal suo indice: il primo è A, poi B, C… */
export function letteraGirone(indice: number): string {
  return String.fromCharCode(65 + indice);
}

/** Una media con un decimale e la virgola italiana: 7.5 → «7,5» */
export function fmtMedia(n: number): string {
  return n.toFixed(1).replace(".", ",");
}
