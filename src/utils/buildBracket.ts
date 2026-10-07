import type { BracketMatch, Partita, SquadraTappa } from "../types";
import { standings } from "./standings";
import { uid } from "./uid";
import { nomeSquadra } from "./tappaInfo";

/** Squadra qualificata alla fase finale, con i dati che servono a ordinarla tra le teste di serie */
interface Qualificata {
  id: string;
  girone: number; // indice del girone di provenienza
  pos: number;    // piazzamento nel girone (0 = prima)
  vittorie: number; // percentuale di vittorie (i gironi possono avere un numero diverso di gare)
  punti: number;    // media punti fatti a partita
  diff: number;
}

/** Prima potenza di due ≥ n: è il numero di posti del tabellone */
function potenzaDiDue(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Ordine delle teste di serie nei posti del tabellone: la 1 e la 2 possono incontrarsi solo in finale.
 *  Esempio con 8 posti: [1, 8, 4, 5, 2, 7, 3, 6] → gare 1-8, 4-5, 2-7, 3-6. */
function ordineTesteDiSerie(posti: number): number[] {
  let ordine = [1, 2];
  while (ordine.length < posti) {
    const n = ordine.length * 2;
    ordine = ordine.flatMap((s) => [s, n + 1 - s]);
  }
  return ordine;
}

/** Le prime `nPass` di ogni girone, ordinate come teste di serie: prima tutte le prime classificate,
 *  poi le seconde…; a parità di piazzamento contano % di vittorie, media punti e differenza punti. */
function qualificate(gironi: string[][], partite: Partita[], nameOf: (id: string) => string, nPass: number): Qualificata[] {
  const out: Qualificata[] = [];
  gironi.forEach((g, gi) => {
    const gare = partite.filter((m) => g.includes(m.a) && g.includes(m.b));
    standings(g, gare, nameOf).slice(0, nPass).forEach((r, pos) => {
      const giocate = Math.max(r.g, 1);
      out.push({ id: r.id, girone: gi, pos, vittorie: r.v / giocate, punti: r.pf / giocate, diff: r.pf - r.ps });
    });
  });
  return out.sort((a, b) =>
    a.pos - b.pos || b.vittorie - a.vittorie || b.punti - a.punti || b.diff - a.diff || a.girone - b.girone);
}

/** Etichetta del match in base a quante gare ha il suo turno */
function etichetta(gareNelTurno: number, indice: number, turno: number): string {
  if (gareNelTurno === 1) return "Finale";
  if (gareNelTurno === 2) return `Semifinale ${indice + 1}`;
  if (gareNelTurno === 4) return `Quarto di finale ${indice + 1}`;
  if (gareNelTurno === 8) return `Ottavo di finale ${indice + 1}`;
  return `Turno ${turno + 1} · Gara ${indice + 1}`;
}

/** true se le due squadre arrivano dallo stesso girone (un posto vuoto non fa mai conflitto) */
function stessoGirone(a: Qualificata | null, b: Qualificata | null): boolean {
  return a !== null && b !== null && a.girone === b.girone;
}

/** Al primo turno evita, dove possibile, le rivincite tra squadre dello stesso girone: scambia la
 *  squadra peggio classificata della gara con quella di un'altra gara, se lo scambio sistema entrambe. */
function evitaRivincite(posti: (Qualificata | null)[]): void {
  const gare = posti.length / 2;
  for (let k = 0; k < gare; k++) {
    if (!stessoGirone(posti[2 * k], posti[2 * k + 1])) continue;
    for (let j = 0; j < gare; j++) {
      if (j === k || posti[2 * j + 1] === null) continue;
      const risolveK = !stessoGirone(posti[2 * k], posti[2 * j + 1]);
      const risolveJ = !stessoGirone(posti[2 * j], posti[2 * k + 1]);
      if (risolveK && risolveJ) {
        [posti[2 * k + 1], posti[2 * j + 1]] = [posti[2 * j + 1], posti[2 * k + 1]];
        break;
      }
    }
  }
}

/** In ogni gara del primo turno la squadra del girone che viene prima è la squadra A:
 *  con 2 gironi si ottiene lo stesso ordine di sempre (1ªA-2ªB, 2ªA-1ªB). */
function ordinaPerGirone(posti: (Qualificata | null)[]): void {
  for (let k = 0; k < posti.length; k += 2) {
    const a = posti[k];
    const b = posti[k + 1];
    if (a !== null && b !== null && a.girone > b.girone) {
      posti[k] = b;
      posti[k + 1] = a;
    }
  }
}

/**
 * Genera la fase a eliminazione diretta dai gironi conclusi.
 * Si qualificano le prime `nPass` di ogni girone; il tabellone ha tanti posti quanti la potenza di due
 * che le contiene tutte: se le qualificate sono meno dei posti, le migliori teste di serie passano il
 * primo turno senza giocare (match con `bye: true`, già concluso). Nessuna qualificata resta fuori.
 *
 * I match sono in un array piatto, un turno dopo l'altro (primo turno, …, finale): la posizione
 * nell'array dice in quale gara del turno successivo va il vincitore (vedi nextBracketSlot).
 * Con un solo girone restituisce [] (non c'è incrocio possibile).
 */
export function buildBracket(gironi: string[][], partite: Partita[], squadre: SquadraTappa[], nPass = 2): BracketMatch[] {
  if (gironi.length < 2) return [];
  const nameOf = (id: string) => nomeSquadra(squadre, id);
  const teste = qualificate(gironi, partite, nameOf, nPass);
  if (teste.length < 2) return [];

  // Posti del primo turno: testa di serie n nel posto previsto, null = posto vuoto (turno superato d'ufficio)
  const nPosti = potenzaDiDue(teste.length);
  const posti: (Qualificata | null)[] = ordineTesteDiSerie(nPosti).map((n) => teste[n - 1] ?? null);
  evitaRivincite(posti);
  ordinaPerGirone(posti);

  // Albero completo: nPosti/2 gare al primo turno, poi la metà a ogni turno fino alla finale
  const bracket: BracketMatch[] = [];
  for (let gare = nPosti / 2, turno = 0; gare >= 1; gare /= 2, turno++) {
    for (let i = 0; i < gare; i++) {
      let squadraA: string | null = null;
      let squadraB: string | null = null;
      if (turno === 0) {
        squadraA = posti[2 * i]?.id ?? null;
        squadraB = posti[2 * i + 1]?.id ?? null;
      }
      bracket.push({ id: uid(), label: etichetta(gare, i, turno), squadraA, squadraB, pA: 0, pB: 0, done: false });
    }
  }

  // Turni superati d'ufficio: la squadra senza avversaria avanza subito al turno successivo
  for (let i = 0; i < nPosti / 2; i++) {
    const m = bracket[i];
    if (m.squadraA !== null && m.squadraB !== null) continue;
    m.done = true;
    m.bye = true;
    const next = nextBracketSlot(bracket, m.id, m.squadraA ?? m.squadraB);
    const destinazione = bracket.find((x) => x.id === next?.id);
    if (next && destinazione) Object.assign(destinazione, next.patch);
  }
  return bracket;
}

/** Divide il tabellone nei round in base alla posizione: i match sono un array piatto, un round dopo
 *  l'altro, e ogni round ha la metà delle gare del precedente fino alla finale (1 gara). Si parte dalla
 *  fine, così anche un tabellone salvato con la vecchia logica (primo round incompleto) mostra tutti i match.
 *  La usano l'interfaccia (una colonna per round) e nextBracketSlot (per trovare il round successivo). */
export function splitRounds(matches: BracketMatch[]): BracketMatch[][] {
  const rounds: BracketMatch[][] = [];
  let fine = matches.length; // dove finisce il round che si sta ritagliando
  let gare = 1;              // la finale ha 1 gara, il round prima 2, poi 4…
  while (fine > 0) {
    rounds.unshift(matches.slice(Math.max(fine - gare, 0), fine));
    fine -= gare;
    gare *= 2;
  }
  return rounds;
}

/**
 * Indica dove far avanzare il vincitore di un match: la gara del turno successivo e il posto (A o B).
 * La gara i-esima di un turno alimenta la gara ⌊i/2⌋ del turno dopo: posto A se i è pari, B se dispari.
 * Così l'accoppiamento non dipende dall'ordine in cui vengono inseriti i risultati.
 * Non sovrascrive mai un posto occupato. Logica condivisa tra la UI (BracketSection) e il Coach AI.
 *
 * @returns id del match successivo e patch da applicare, oppure null se è la finale
 *          o se nel turno successivo non c'è nessun posto libero.
 */
export function nextBracketSlot(
  bracket: BracketMatch[],
  matchId: string,
  vincitoreId: string | null,
): { id: string; patch: Partial<BracketMatch> } | null {
  if (!vincitoreId) return null;
  const turni = splitRounds(bracket);
  const t = turni.findIndex((turno) => turno.some((m) => m.id === matchId));
  if (t === -1) return null;
  const successivo = turni[t + 1];
  if (!successivo) return null; // finale: dopo non avanza nessuno

  /** Risultato: il vincitore occupa il posto `posto` della gara `m` */
  const occupa = (m: BracketMatch, posto: "squadraA" | "squadraB") => ({ id: m.id, patch: { [posto]: vincitoreId } });

  // Tabellone ad albero come quelli di buildBracket (2^k − 1 match): gara e posto li dà la posizione
  if (potenzaDiDue(bracket.length + 1) === bracket.length + 1) {
    const i = turni[t].findIndex((m) => m.id === matchId);
    const next = successivo[Math.floor(i / 2)];
    let posto: "squadraA" | "squadraB" = "squadraB";
    if (i % 2 === 0) posto = "squadraA";
    let altro: "squadraA" | "squadraB" = "squadraA";
    if (posto === "squadraA") altro = "squadraB";
    if (next[posto] === null || next[posto] === vincitoreId) return occupa(next, posto);
    // Il posto previsto ha già un'altra squadra (vecchia logica): si usa l'altro posto della gara, se libero
    if (next[altro] === null) return occupa(next, altro);
  }

  // Riserva per i tabelloni nati con la vecchia logica ("primo posto libero"): possono avere i due posti
  // previsti già occupati o non essere ad albero (es. 6 gare). Si ricade su quella regola nel solo turno
  // successivo, così il tabellone già iniziato si completa e nessuna squadra viene sovrascritta
  for (const m of successivo) {
    if (m.done) continue; // una gara già giocata non riceve squadre
    if (m.squadraA === null) return occupa(m, "squadraA");
    if (m.squadraB === null) return occupa(m, "squadraB");
  }
  return null;
}
