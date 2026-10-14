/** Test di guardia del README: i collegamenti interni portano a un titolo che esiste, i file citati esistono e l'indice elenca
 *  tutti i titoli di secondo livello nell'ordine del file. Così il README non resta indietro quando un file si sposta o un titolo
 *  cambia: la CI lo dice. I file del backend si citano con il prefisso `hoop3x3-backend/` o per nome, mai con `src/` da soli
 *  (sarebbero cercati in questo repository). */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const RADICE = new URL("../../", import.meta.url);
const README = readFileSync(new URL("README.md", RADICE), "utf8");

/** Le righe del README fuori dai blocchi di codice recintati (```): lì dentro un `#` o un percorso sono esempi, non titoli o citazioni */
function righeFuoriDalCodice(testo: string): string[] {
  let inCodice = false;
  return testo.split("\n").filter((riga) => {
    if (riga.trimStart().startsWith("```")) {
      inCodice = !inCodice;
      return false;
    }
    return !inCodice;
  });
}

const RIGHE = righeFuoriDalCodice(README);

/** L'ancora di un titolo come la calcola GitHub: minuscole, via la punteggiatura (accenti e lettere restano), spazi in trattini.
 *  Il testo del codice in linea conta senza i backtick */
function ancoraDi(titolo: string): string {
  return titolo
    .replace(/`/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
    .replace(/ /g, "-");
}

/** I titoli del file, in ordine, con il livello e l'ancora (i doppioni prendono -1, -2… come su GitHub) */
function titoli(): { livello: number; ancora: string }[] {
  const viste = new Map<string, number>();
  return RIGHE.flatMap((riga) => {
    const m = /^(#{1,6})\s+(.+?)\s*#*$/.exec(riga);
    if (!m) return [];
    const base = ancoraDi(m[2]);
    const n = viste.get(base) ?? 0;
    viste.set(base, n + 1);
    let ancora = base;
    if (n > 0) ancora = `${base}-${n}`;
    return [{ livello: m[1].length, ancora }];
  });
}

/** Le destinazioni dei collegamenti Markdown `[testo](destinazione)` fuori dal codice */
function collegamenti(): string[] {
  return RIGHE.flatMap((riga) => [...riga.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]));
}

describe("README.md: collegamenti, file citati e indice", () => {
  it("ogni collegamento interno (#ancora) porta a un titolo del file", () => {
    const ancore = new Set(titoli().map((t) => t.ancora));
    const rotti = collegamenti()
      .filter((d) => d.startsWith("#"))
      .filter((d) => !ancore.has(decodeURIComponent(d.slice(1))));
    expect(rotti).toEqual([]);
  });

  it("ogni collegamento relativo porta a un file o a una cartella del repository", () => {
    const mancanti = collegamenti()
      .filter((d) => !/^(https?:|mailto:|#)/.test(d))
      .map((d) => d.split("#")[0])
      .filter((d) => !existsSync(new URL(d, RADICE)));
    expect(mancanti).toEqual([]);
  });

  it("ogni file citato tra backtick sotto src/, tests/, docs/ o public/ esiste", () => {
    const citati = RIGHE.flatMap((riga) => [...riga.matchAll(/`((?:src|tests|docs|public)\/[^`\s]+)`/g)].map((m) => m[1]));
    const mancanti = citati
      // Un file ha un'estensione; i modelli con * o <segnaposto> non sono file
      .filter((p) => /\.[a-zA-Z0-9]+$/.test(p) && !/[*<>{}]/.test(p))
      .filter((p) => !existsSync(new URL(p, RADICE)));
    expect(mancanti).toEqual([]);
  });

  it("l'indice elenca tutti i titoli ## dopo di sé, nell'ordine del file", () => {
    const tutti = titoli();
    const posIndice = tutti.findIndex((t) => t.livello === 2 && t.ancora === "indice");
    expect(posIndice).toBeGreaterThanOrEqual(0);
    const attesi = tutti.slice(posIndice + 1).filter((t) => t.livello === 2).map((t) => t.ancora);
    // Le voci di primo livello dell'indice: le righe «- [Titolo](#ancora)» senza rientro, tra «## Indice» e il titolo successivo
    const inizio = RIGHE.findIndex((r) => /^##\s+Indice\s*$/.test(r));
    let fine = RIGHE.findIndex((r, i) => i > inizio && /^#{1,2}\s/.test(r));
    if (fine < 0) fine = RIGHE.length;
    const voci = RIGHE.slice(inizio + 1, fine)
      .map((r) => /^(?:-|\d+\.)\s+\[[^\]]+\]\(#([^)]+)\)/.exec(r))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => decodeURIComponent(m[1]));
    expect(voci).toEqual(attesi);
  });
});
