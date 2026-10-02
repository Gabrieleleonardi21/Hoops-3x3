/** Operazioni di tappa come funzioni pure: ricevono la tappa, applicano le regole del torneo e
 *  restituiscono la NUOVA tappa (quella ricevuta non viene mai modificata) oppure il motivo per cui
 *  l'operazione non si può fare. Le usano sia l'interfaccia (useTappa, useLega, BracketSection) sia i tool
 *  del Coach AI, che salvano il risultato con replaceTappa: la logica sta in un posto solo ed è
 *  testabile con Vitest senza React. Una tappa conclusa non si modifica: ogni operazione la rifiuta. */
import type { Partita, Regole, SquadraTappa, StatSheet, Tappa } from "../types";
import { buildGironi } from "../utils/buildGironi";
import { buildGironiSeeded } from "../utils/buildGironiSeeded";
import { buildMatches } from "../utils/buildMatches";
import { buildBracket, nextBracketSlot } from "../utils/buildBracket";
import { replaceById } from "../utils/replaceById";
import { uid } from "../utils/uid";
import { DEFAULT_RULES } from "../constants/rules";

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

/** Dati di una tappa da creare. Le squadre le prepara chi la crea: segnaposto «Squadra N» l'interfaccia, prese
 *  dall'anagrafe il Coach. */
export interface NuovaTappa {
  nome: string;
  luogo: string;
  data: string;
  nGironi: number;
  squadre: SquadraTappa[];
}

const ok = (tappa: Tappa): Esito => ({ ok: true, tappa });
const ko = (errore: string): Esito => ({ ok: false, errore });

/** Una tappa conclusa è pubblicata nell'archivio e non si modifica più: ogni operazione di questo modulo la rifiuta.
 *  Restano possibili solo i video e «Riapri», che non passano da qui. */
const CONCLUSA = "La tappa è conclusa: riaprila per modificarla.";

/** Il server rifiuta una tappa senza nome: nello store il nome non è mai vuoto */
const NOME_VUOTO = "Il nome della tappa non può essere vuoto.";

/** Squadre ammesse in una tappa */
const MAX_SQUADRE = 64;
const LIMITE_SQUADRE = `Una tappa ha da 2 a ${MAX_SQUADRE} squadre.`;

/** Gironi possibili con `nSquadre` squadre: almeno 2 squadre per girone e non più di 32 gironi */
const massimoGironi = (nSquadre: number) => Math.max(1, Math.min(32, Math.floor(nSquadre / 2)));

/** Il numero di gironi è un intero tra 1 e metà delle squadre, al massimo 32. null se va bene */
function erroreGironi(nSquadre: number, nGironi: number): string | null {
  const massimo = massimoGironi(nSquadre);
  if (Number.isInteger(nGironi) && nGironi >= 1 && nGironi <= massimo) return null;
  return `Numero di gironi non valido: con ${nSquadre} squadre deve essere un intero da 1 a ${massimo}.`;
}

/** Limiti di una tappa, gli stessi per interfaccia e Coach: da 2 a 64 squadre e un numero di gironi intero tra 1 e
 *  metà delle squadre (al massimo 32). null se vanno bene. Si controllano prima di preparare le squadre: così
 *  nessuno crea squadre (o le registra in anagrafe) per una tappa che poi verrebbe rifiutata. */
export function erroreLimitiTappa(nSquadre: number, nGironi: number): string | null {
  if (!Number.isInteger(nSquadre) || nSquadre < 2 || nSquadre > MAX_SQUADRE) return LIMITE_SQUADRE;
  return erroreGironi(nSquadre, nGironi);
}

/** Crea una tappa non ancora sorteggiata, con le regole predefinite: rispetta i limiti di erroreLimitiTappa e, come
 *  ogni tappa nello store, ha un nome non vuoto. */
export function creaTappa(dati: NuovaTappa): Esito {
  const limiti = erroreLimitiTappa(dati.squadre.length, dati.nGironi);
  if (limiti) return ko(limiti);
  const nome = dati.nome.trim();
  if (!nome) return ko(NOME_VUOTO);
  return ok({
    id: uid(), nome, luogo: dati.luogo.trim(), data: dati.data, nGironi: dati.nGironi,
    regole: { ...DEFAULT_RULES }, squadre: dati.squadre, gironi: null, partite: [], video: [],
  });
}

/** Cambia il nome della tappa, senza spazi ai lati. Un nome vuoto è rifiutato: arrivato al server, farebbe fallire
 *  ogni salvataggio della tappa. Lo stesso nome non cambia niente (restituisce la tappa ricevuta). */
export function rinominaTappa(tappa: Tappa, nome: string): Esito {
  if (tappa.conclusa) return ko(CONCLUSA);
  const pulito = nome.trim();
  if (!pulito) return ko(NOME_VUOTO);
  if (pulito === tappa.nome) return ok(tappa);
  return ok({ ...tappa, nome: pulito });
}

/** La tappa senza sorteggio: gironi, calendario e tabellone ripartono da zero. Serve a ogni cambio di struttura
 *  (numero di gironi, squadre): con squadre o gironi diversi né il vecchio calendario né il vecchio tabellone valgono. */
function senzaSorteggio(tappa: Tappa): Tappa {
  return { ...tappa, gironi: null, partite: [], bracket: undefined };
}

/** Controlli validi per ogni risultato: due numeri interi non negativi e nessun pareggio */
function erroreRisultato(regole: Regole, a: number, b: number): string | null {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return "Inserisci entrambi i punteggi.";
  if (a === b) return `Nel 3x3 non esistono pareggi: si gioca il supplementare (primo a ${regole.ot} punti).`;
  return null;
}

/** Sorteggia i gironi (casuale o a serpentina per ranking) e genera il calendario all'italiana.
 *  Un nuovo sorteggio riparte da zero: i risultati già registrati e il tabellone vanno persi. */
export function sorteggia(tappa: Tappa, modo: ModoSorteggio): Esito {
  if (tappa.conclusa) return ko(CONCLUSA);
  if (tappa.squadre.length < 2) return ko("Servono almeno 2 squadre per sorteggiare i gironi.");
  // Una tappa salvata prima di questi controlli può avere un numero di gironi non valido (2.5, o più di metà delle
  // squadre): costruire i gironi andrebbe in errore o lascerebbe gironi con una squadra sola
  const gironiNonValidi = erroreGironi(tappa.squadre.length, tappa.nGironi);
  if (gironiNonValidi) return ko(gironiNonValidi);
  let gironi: string[][];
  if (modo === "ranking") {
    gironi = buildGironiSeeded(tappa.squadre, tappa.nGironi);
  } else {
    gironi = buildGironi(tappa.squadre.map((s) => s.id), tappa.nGironi);
  }
  return ok({ ...senzaSorteggio(tappa), gironi, partite: buildMatches(gironi) });
}

/** Che cosa cancellano un nuovo sorteggio o un cambio di struttura (numero di gironi, squadre): il testo da mostrare
 *  nella richiesta di conferma, oppure null se non c'è nessun risultato da perdere e si può procedere senza chiedere.
 *  Lo usano l'interfaccia e il Coach (decisione D4). I turni superati d'ufficio (`bye`) non sono risultati. */
export function perditaRisultati(tappa: Tappa): string | null {
  const giocate = tappa.partite.filter((m) => m.done).length
    + (tappa.bracket ?? []).filter((m) => m.done && !m.bye).length;
  if (giocate === 0) return null;
  let risultati = `${giocate} risultati`;
  if (giocate === 1) risultati = "1 risultato";
  if (tappa.bracket?.length) return `Verranno eliminati il sorteggio, la fase finale e ${risultati}.`;
  return `Verranno eliminati il sorteggio e ${risultati}.`;
}

/** Aggiunge una squadra con il nome provvisorio «Squadra N». Il sorteggio fatto non vale più. */
export function aggiungiSquadra(tappa: Tappa): Esito {
  if (tappa.conclusa) return ko(CONCLUSA);
  if (tappa.squadre.length >= MAX_SQUADRE) return ko(LIMITE_SQUADRE);
  const squadra: SquadraTappa = { id: uid(), nome: `Squadra ${tappa.squadre.length + 1}`, giocatori: [], rank: "" };
  return ok(senzaSorteggio({ ...tappa, squadre: [...tappa.squadre, squadra] }));
}

/** Toglie una squadra dalla tappa. Il sorteggio fatto non vale più; se i gironi diventano più di metà delle
 *  squadre scendono al massimo possibile, altrimenti il prossimo sorteggio avrebbe gironi con una squadra sola. */
export function rimuoviSquadra(tappa: Tappa, squadraId: string): Esito {
  if (tappa.conclusa) return ko(CONCLUSA);
  if (!tappa.squadre.some((s) => s.id === squadraId)) return ko("Squadra non trovata.");
  if (tappa.squadre.length <= 2) return ko(LIMITE_SQUADRE);
  const squadre = tappa.squadre.filter((s) => s.id !== squadraId);
  const nGironi = Math.min(tappa.nGironi, massimoGironi(squadre.length));
  return ok(senzaSorteggio({ ...tappa, squadre, nGironi }));
}

/** Cambia il numero di gironi: un intero tra 1 e metà delle squadre, al massimo 32. Il sorteggio fatto non vale più;
 *  lo stesso numero invece non cambia niente (restituisce la tappa ricevuta), così ridigitarlo non cancella nulla. */
export function impostaNumeroGironi(tappa: Tappa, nGironi: number): Esito {
  if (tappa.conclusa) return ko(CONCLUSA);
  if (nGironi === tappa.nGironi) return ok(tappa);
  const errore = erroreGironi(tappa.squadre.length, nGironi);
  if (errore) return ko(errore);
  return ok(senzaSorteggio({ ...tappa, nGironi }));
}

/** Con la fase finale generata i risultati dei gironi non cambiano più: il tabellone è nato da quelle classifiche */
function erroreFaseFinale(tappa: Tappa): string | null {
  if (!tappa.bracket?.length) return null;
  return "Per correggere o annullare un risultato dei gironi elimina prima la fase finale, generata da questi risultati.";
}

/** Registra il risultato di una partita dei gironi */
export function registraRisultato(tappa: Tappa, partitaId: string, punteggio: Punteggio): Esito {
  if (tappa.conclusa) return ko(CONCLUSA);
  const partita = tappa.partite.find((m) => m.id === partitaId);
  if (!partita) return ko("Partita non trovata.");
  const faseFinale = erroreFaseFinale(tappa);
  if (faseFinale) return ko(faseFinale);
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

/** Annulla il risultato di una partita dei gironi: la partita torna da giocare e non conta più in classifica. Serve sia
 *  per correggerlo («Correggi» nell'interfaccia: punteggi e schede restano come bozza) sia per annullarlo (Coach). */
export function annullaRisultato(tappa: Tappa, partitaId: string): Esito {
  if (tappa.conclusa) return ko(CONCLUSA);
  const partita = tappa.partite.find((m) => m.id === partitaId);
  if (!partita) return ko("Partita non trovata.");
  const faseFinale = erroreFaseFinale(tappa);
  if (faseFinale) return ko(faseFinale);
  return ok({ ...tappa, partite: replaceById(tappa.partite, { ...partita, done: false }) });
}

/** Registra il risultato di un match della fase a eliminazione diretta e fa avanzare il vincitore nella
 *  gara del turno successivo che gli spetta per posizione, qualunque sia l'ordine dei risultati (vedi
 *  nextBracketSlot; solo i tabelloni nati con la vecchia logica ricadono sul primo posto libero).
 *  Dopo la finale non avanza nessuno. */
export function registraRisultatoBracket(tappa: Tappa, matchId: string, pA: number, pB: number): Esito {
  if (tappa.conclusa) return ko(CONCLUSA);
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
  if (tappa.conclusa) return ko(CONCLUSA);
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
  if (tappa.conclusa) return ko(CONCLUSA);
  if (!tappa.gironi || !tappa.partite.length) return ko("Sorteggia i gironi e registra le partite prima di concludere.");
  const left = tappa.partite.filter((m) => !m.done).length;
  if (left > 0) return ko(`Mancano ancora ${left} partite da registrare.`);
  // La finale non può restare aperta: se il bracket esiste va giocato fino in fondo
  const bracketLeft = (tappa.bracket ?? []).filter((m) => !m.done).length;
  if (bracketLeft > 0) return ko(`La fase a eliminazione diretta non è completa: mancano ${bracketLeft} match.`);
  return ok({ ...tappa, conclusa: true });
}
