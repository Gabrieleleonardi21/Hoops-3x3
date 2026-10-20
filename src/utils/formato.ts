/** Testi brevi ripetuti nelle pagine, scritti in un posto solo (FP-5). */

/** La lettera di un girone dal suo indice: il primo è A, poi B, C… */
export function letteraGirone(indice: number): string {
  return String.fromCharCode(65 + indice);
}

/** Una media con un decimale e la virgola italiana: 7.5 → «7,5» */
export function fmtMedia(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

/** Una data come la salva il campo data (AAAA-MM-GG) in gg/mm/aaaa, il modo in cui la scrive chi cerca una tappa nel Coach.
 *  Una data di altra forma (o vuota) torna com'è */
export function dataItaliana(data: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) return data;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
