/** Dichiarazione della sola funzione di node:fs che i test usano per leggere un file del repository (src/index.css, render.yaml).
 *  Nata quando @types/node non era installato; oggi lo è (devDependencies di package.json) e i suoi tipi coprono già node:fs:
 *  questa dichiarazione si aggiunge a quelli e il controllo dei tipi passa anche senza questo file.
 *  Non si usa l'import `?raw`: Vitest sostituisce ogni file CSS con una stringa vuota. */
declare module "node:fs" {
  export function readFileSync(percorso: URL, codifica: "utf8"): string;
}
