/** Contrasto del bordo dei campi (WCAG 1.4.11): chi usa un campo di testo, di punteggio o del tabellino deve vederne i bordi,
 *  quindi bordo e sfondo devono avere almeno 3:1. I colori si leggono da src/index.css, che è la fonte: se un token cambia
 *  o una classe passa a un altro, il test lo sa. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../src/index.css", import.meta.url), "utf8");

/** Il colore esadecimale del token `--color-<nome>` definito in index.css */
function colore(nome: string): string {
  const trovato = css.match(new RegExp(`--color-${nome}:\\s*(#[0-9a-fA-F]{6})`));
  if (!trovato) throw new Error(`Token --color-${nome} non trovato in index.css`);
  return trovato[1];
}

/** Il token (es. «asphalt-500») dell'utility `<prefisso>-<token>` nella regola `.classe { @apply … }` */
function tokenDi(classe: string, prefisso: "border" | "bg"): string {
  const regola = css.match(new RegExp(`\\.${classe}\\s*\\{([^}]*)\\}`));
  if (!regola) throw new Error(`Regola .${classe} non trovata in index.css`);
  // Dopo uno spazio o a inizio riga: «focus:border-court» e simili non contano
  const utility = regola[1].match(new RegExp(`(?:^|\\s)${prefisso}-(asphalt-\\d+)`));
  if (!utility) throw new Error(`.${classe} non ha ${prefisso}-asphalt-N`);
  return utility[1];
}

/** Luminanza relativa di un colore esadecimale (WCAG 2) */
function luminanza(esadecimale: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const canale = parseInt(esadecimale.slice(i, i + 2), 16) / 255;
    if (canale <= 0.03928) return canale / 12.92;
    return ((canale + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapporto di contrasto tra due colori (da 1 a 21) */
function contrasto(a: string, b: string): number {
  const [chiaro, scuro] = [luminanza(a), luminanza(b)].sort((x, y) => y - x);
  return (chiaro + 0.05) / (scuro + 0.05);
}

describe("Campi di testo, punteggio e tabellino: il bordo si vede sullo sfondo (WCAG 1.4.11)", () => {
  it.each(["statin", "scorein", "cellin"])(".%s ha il bordo ad almeno 3:1 sullo sfondo", (classe) => {
    const bordo = colore(tokenDi(classe, "border"));
    const sfondo = colore(tokenDi(classe, "bg"));
    expect(contrasto(bordo, sfondo)).toBeGreaterThanOrEqual(3);
  });
});
