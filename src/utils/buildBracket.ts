import type { BracketMatch, Partita, SquadraTappa } from "../types";
import { standings } from "./standings";
import { uid } from "./uid";

/**
 * Genera la fase a eliminazione diretta dai gironi.
 * Prende le prime `nPass` squadre per girone, le incrocia (1°A vs 2°B, 1°B vs 2°A)
 * e crea semifinali + finale. Restituisce un array piatto di BracketMatch.
 *
 * Casi supportati:
 *  - 2 qualificate → 1 Finale
 *  - 4 qualificate → 2 SF + 1 Finale (caso tipico 3x3 con 2 gironi)
 *  - 8 qualificate → 4 QF + 2 SF + 1 Finale
 */
export function buildBracket(
  gironi: string[][],
  partite: Partita[],
  squadre: SquadraTappa[],
  nPass = 2,
): BracketMatch[] {
  const nameOf = (id: string) => squadre.find((s) => s.id === id)?.nome ?? id;

  // Classifica per ogni girone, prende i primi nPass
  const qualPerGirone: string[][] = gironi.map((g) => {
    const matchesGirone = partite.filter((m) => g.includes(m.a) && g.includes(m.b));
    return standings(g, matchesGirone, nameOf).slice(0, nPass).map((r) => r.id);
  });

  // Cross-seeding: 1°G0 vs 2°G1, 1°G1 vs 2°G0, ecc.
  // Costruisce coppie per il primo round
  const firstRoundPairs = makeFirstRoundPairs(qualPerGirone);
  return buildMatches(firstRoundPairs);
}

/** Incrocia i qualificati in modo da evitare scontri tra squadre dello stesso girone al primo round. */
function makeFirstRoundPairs(qualPerGirone: string[][]): Array<[string, string]> {
  // Caso 1 girone: nessun playoff necessario
  if (qualPerGirone.length === 1) return [];

  // Caso 2 gironi: incrocio classico
  if (qualPerGirone.length === 2) {
    const [a, b] = qualPerGirone;
    const pairs: Array<[string, string]> = [];
    // 1°A vs 2°B, 1°B vs 2°A, ecc.
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] && b[b.length - 1 - i]) pairs.push([a[i], b[b.length - 1 - i]]);
    }
    return pairs;
  }

  // Caso N gironi: accoppia in sequenza 1°G0 vs 1°G(last), 1°G1 vs 1°G(last-1)...
  const topSeeds = qualPerGirone.map((g) => g[0]).filter(Boolean);
  const pairs: Array<[string, string]> = [];
  const half = Math.floor(topSeeds.length / 2);
  for (let i = 0; i < half; i++) {
    pairs.push([topSeeds[i], topSeeds[topSeeds.length - 1 - i]]);
  }
  return pairs;
}

/**
 * Data una lista di coppie del primo round, costruisce l'intero albero di match.
 * I match dei round successivi partono con squadraA/B = null (TBD).
 */
function buildMatches(firstPairs: Array<[string, string]>): BracketMatch[] {
  const all: BracketMatch[] = [];
  let currentRoundCount = firstPairs.length;

  // Genera i match del primo round con le squadre note
  for (let i = 0; i < firstPairs.length; i++) {
    const [a, b] = firstPairs[i];
    all.push({
      id: uid(),
      label: roundLabel(currentRoundCount, i),
      squadraA: a,
      squadraB: b,
      pA: 0, pB: 0,
      done: false,
    });
  }

  // Genera i round successivi con TBD finché non rimane 1 match (la finale)
  while (currentRoundCount > 1) {
    const nextCount = Math.ceil(currentRoundCount / 2);
    for (let i = 0; i < nextCount; i++) {
      all.push({
        id: uid(),
        label: roundLabel(nextCount, i),
        squadraA: null,
        squadraB: null,
        pA: 0, pB: 0,
        done: false,
      });
    }
    currentRoundCount = nextCount;
  }

  return all;
}

/** Restituisce l'etichetta del match in base al numero di match nel round. */
function roundLabel(matchesInRound: number, index: number): string {
  if (matchesInRound === 1) return "Finale";
  if (matchesInRound === 2) return `Semifinale ${index + 1}`;
  if (matchesInRound === 4) return `Quarto di finale ${index + 1}`;
  return `Round ${index + 1}`;
}

/**
 * Calcola lo slot del round successivo in cui far avanzare il vincitore di un match.
 * I match sono ordinati round per round, quindi il primo slot TBD (squadra null) dopo
 * il match corrente è quello da riempire. Logica condivisa tra la UI (BracketSection)
 * e il Coach AI, così l'avanzamento è identico in entrambi i percorsi.
 *
 * @returns id del match successivo e patch da applicare, oppure null se è la finale.
 */
export function nextBracketSlot(
  bracket: BracketMatch[],
  matchId: string,
  vincitoreId: string | null,
): { id: string; patch: Partial<BracketMatch> } | null {
  if (!vincitoreId) return null;
  const idx = bracket.findIndex((m) => m.id === matchId);
  if (idx === -1) return null;

  // Primo slot TBD nei round successivi (squadraA o squadraB ancora da assegnare)
  const nextTbd = bracket
    .slice(idx + 1)
    .find((m) => !m.done && (m.squadraA === null || m.squadraB === null));
  if (!nextTbd) return null;

  const patch: Partial<BracketMatch> = {};
  if (nextTbd.squadraA === null) {
    patch.squadraA = vincitoreId;
  } else {
    patch.squadraB = vincitoreId;
  }
  return { id: nextTbd.id, patch };
}
