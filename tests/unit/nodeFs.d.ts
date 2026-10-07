/** @types/node non è installato: i test che leggono un file del repository (src/index.css) dichiarano qui la sola funzione che usano.
 *  Non si usa l'import `?raw`: Vitest sostituisce ogni file CSS con una stringa vuota. */
declare module "node:fs" {
  export function readFileSync(percorso: URL, codifica: "utf8"): string;
}
