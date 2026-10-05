/** «1 tappa ha modifiche non salvate» oppure «3 tappe hanno modifiche non salvate»: la frase è condivisa
 *  dall'avviso di SyncBanner e dalla conferma di uscita, così i due testi restano uguali */
export function tappeNonSalvate(n: number): string {
  if (n === 1) return "1 tappa ha modifiche non salvate";
  return `${n} tappe hanno modifiche non salvate`;
}
