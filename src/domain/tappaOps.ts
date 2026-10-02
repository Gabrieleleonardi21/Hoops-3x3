/** Operazioni di tappa come funzioni pure: ricevono la tappa, applicano le regole del torneo e
 *  restituiscono la NUOVA tappa (quella ricevuta non viene mai modificata) oppure il motivo per cui
 *  l'operazione non si può fare. Le usano sia l'interfaccia (useTappa, BracketSection) sia i tool
 *  del Coach AI, che salvano il risultato con replaceTappa: la logica sta in un posto solo ed è
 *  testabile con Vitest senza React. */
import type { Partita, Regole, StatSheet, Tappa } from "../types";
import { buildGironi } from "../utils/buildGironi";
import { buildGironiSeeded } from "../utils/buildGironiSeeded";
import { buildMatches } from "../utils/buildMatches";
import { buildBracket, nextBracketSlot } from "../utils/buildBracket";
import { replaceById } from "../utils/replaceById";

export type ModoSorteggio = "casuale" | "ranking";

/** Esito di un'operazione: la nuova tappa, oppure l'errore da mostrare a chi l'ha chiesta */
export type Esito = { ok: true; tappa: Tappa } | { ok: false; errore: string };

/** Punteggio di una gara dei gironi; le schede statistiche sono facoltative (il Coach AI registra solo il totale) */
export interface Punteggio {
  sa: number;
  sb: number;
  pa?: StatSheet;
  pb?: StatSheet;
}

const ok = (tappa: Tappa): Esito => ({ ok: true, tappa });
const ko = (errore: string): Esito => ({ ok: false, errore });

/** Controlli validi per ogni risultato: due numeri interi non negativi e nessun pareggio */
function erroreRisultato(regole: Regole, a: number, b: number): string | null {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return "Inserisci entrambi i punteggi.";
  if (a === b) return `Nel 3x3 non esistono pareggi: si gioca il supplementare (primo a ${regole.ot} punti).`;
  return null;
}

/** Sorteggia i gironi (casuale o a serpentina per ranking) e genera il calendario all'italiana.
 *  Un nuovo sorteggio riparte da zero: i risultati già registrati vanno persi. */
export function sorteggia(tappa: Tappa, modo: ModoSorteggio): Esito {
  if (tappa.squadre.length < 2) return ko("Servono almeno 2 squadre per sorteggiare i gironi.");
  let gironi: string[][];
  if (modo === "ranking") {
    gironi = buildGironiSeeded(tappa.squadre, tappa.nGironi);
  } else {
    gironi = buildGironi(tappa.squadre.map((s) => s.id), tappa.nGironi);
  }
  return ok({ ...tappa, gironi, partite: buildMatches(gironi) });
}

/** Registra il risultato di una partita dei gironi */
export function registraRisultato(tappa: Tappa, partitaId: string, punteggio: Punteggio): Esito {
  const partita = tappa.partite.find((m) => m.id === partitaId);
  if (!partita) return ko("Partita non trovata.");
  const { sa, sb, pa, pb } = punteggio;
  const errore = erroreRisultato(tappa.regole, sa, sb);
  if (errore) return ko(errore);
  if (Math.max(sa, sb) > tappa.regole.target + 4)
    return ko(`Punteggio insolito: nel 3x3 la gara finisce a ${tappa.regole.target} punti (o allo scadere dei ${tappa.regole.durata}').`);

  // Le schede statistiche si sovrascrivono solo se fornite: il Coach AI registra il solo totale
  const aggiornata: Partita = { ...partita, sa, sb, done: true };
  if (pa) aggiornata.pa = pa;
  if (pb) aggiornata.pb = pb;
  return ok({ ...tappa, partite: replaceById(tappa.partite, aggiornata) });
}

/** Registra il risultato di un match della fase a eliminazione diretta e fa avanzare il vincitore nella
 *  gara del turno successivo che gli spetta per posizione, qualunque sia l'ordine dei risultati (vedi
 *  nextBracketSlot; solo i tabelloni nati con la vecchia logica ricadono sul primo posto libero).
 *  Dopo la finale non avanza nessuno. */
export function registraRisultatoBracket(tappa: Tappa, matchId: string, pA: number, pB: number): Esito {
  const bracket = tappa.bracket ?? [];
  const match = bracket.find((m) => m.id === matchId);
  if (!match) return ko("Match non trovato nella fase a eliminazione diretta.");
  if (match.squadraA === null || match.squadraB === null) return ko(`${match.label}: le squadre non sono ancora note.`);
  // Un match già registrato non si riregistra: il vincitore avanzerebbe due volte
  if (match.done) return ko(`${match.label}: risultato già registrato.`);
  const errore = erroreRisultato(tappa.regole, pA, pB);
  if (errore) return ko(errore);

  let vincitoreId = match.squadraB;
  if (pA > pB) vincitoreId = match.squadraA;
  let nuovo = replaceById(bracket, { ...match, pA, pB, done: true });
  const next = nextBracketSlot(nuovo, matchId, vincitoreId);
  if (next) {
    nuovo = nuovo.map((m) => {
      if (m.id === next.id) return { ...m, ...next.patch };
      return m;
    });
  }
  return ok({ ...tappa, bracket: nuovo });
}

/** Genera la fase a eliminazione diretta dalla classifica dei gironi (nPass qualificate per girone) */
export function generaFasiDirette(tappa: Tappa, nPass = 2): Esito {
  if (!tappa.gironi) return ko("Sorteggia i gironi prima di generare la fase a eliminazione diretta.");
  const mancanti = tappa.partite.filter((m) => !m.done).length;
  if (mancanti > 0) return ko(`Completa prima i gironi: mancano ${mancanti} partite.`);
  if (tappa.bracket?.length) return ko("La fase a eliminazione diretta è già stata generata.");
  const bracket = buildBracket(tappa.gironi, tappa.partite, tappa.squadre, nPass);
  // buildBracket restituisce [] con un solo girone: non c'è incrocio possibile
  if (!bracket.length) return ko("Impossibile generare la fase finale: servono almeno 2 gironi.");
  return ok({ ...tappa, bracket });
}

/** Conclude la tappa: gironi tutti registrati e, se è stata generata, fase diretta completa */
export function concludi(tappa: Tappa): Esito {
  if (!tappa.gironi || !tappa.partite.length) return ko("Sorteggia i gironi e registra le partite prima di concludere.");
  const left = tappa.partite.filter((m) => !m.done).length;
  if (left > 0) return ko(`Mancano ancora ${left} partite da registrare.`);
  // La finale non può restare aperta: se il bracket esiste va giocato fino in fondo
  const bracketLeft = (tappa.bracket ?? []).filter((m) => !m.done).length;
  if (bracketLeft > 0) return ko(`La fase a eliminazione diretta non è completa: mancano ${bracketLeft} match.`);
  return ok({ ...tappa, conclusa: true });
}
