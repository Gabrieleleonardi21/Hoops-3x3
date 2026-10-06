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
import { conteggio } from "../utils/testi";
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
/** Gironi al massimo in una tappa: il limite di TappaDTO.nGironi (@Min(1) @Max(32)). Lo usa anche l'import di una lega */
export const MAX_GIRONI = 32;

/** Limiti del server per nome e luogo (colonne di `tappe`), contati senza gli spazi ai lati, come li salva creaTappa.
 *  I campi dei form li usano come maxLength: il numero sta qui e basta. */
export const MAX_NOME_TAPPA = 120;
export const MAX_LUOGO = 160;
/** Data vuota oppure aaaa-mm-gg, come il valore del campo data del form: il server rifiuta ogni altro formato */
const DATA_ISO = /^(\d{4}-\d{2}-\d{2})?$/;

/** Testi di una tappa, controllati con i limiti del server */
export interface TestiTappa {
  nome: string;
  luogo: string;
  data: string;
}

/** Limiti del server per i testi di una tappa (TappaDTO): nome fino a 120 caratteri e luogo fino a 160, contati senza gli
 *  spazi ai lati, e data vuota oppure aaaa-mm-gg. Li controllano la creazione (erroreLimitiTappa) e l'import di una lega da
 *  file (utils/legaFile), che è un ripristino: accetta ciò che accetta il server, quindi non applica gli altri limiti di
 *  creazione (squadre e gironi). null se vanno bene. */
export function erroreTestiTappa(testi: TestiTappa): string | null {
  if (testi.nome.trim().length > MAX_NOME_TAPPA) return `Il nome della tappa può avere al massimo ${MAX_NOME_TAPPA} caratteri.`;
  if (testi.luogo.trim().length > MAX_LUOGO) return `Il luogo può avere al massimo ${MAX_LUOGO} caratteri.`;
  if (!DATA_ISO.test(testi.data)) return "La data deve essere vuota oppure nel formato aaaa-mm-gg (per esempio 2026-06-14).";
  return null;
}

/** Gironi possibili con `nSquadre` squadre: almeno 2 squadre per girone e non più di MAX_GIRONI gironi */
const massimoGironi = (nSquadre: number) => Math.max(1, Math.min(MAX_GIRONI, Math.floor(nSquadre / 2)));

/** Il numero di gironi è un intero tra 1 e metà delle squadre, al massimo 32. null se va bene */
function erroreGironi(nSquadre: number, nGironi: number): string | null {
  const massimo = massimoGironi(nSquadre);
  if (Number.isInteger(nGironi) && nGironi >= 1 && nGironi <= massimo) return null;
  return `Numero di gironi non valido: con ${nSquadre} squadre deve essere un intero da 1 a ${massimo}.`;
}

/** Limiti di una tappa, gli stessi per interfaccia e Coach: da 2 a 64 squadre, un numero di gironi intero tra 1 e
 *  metà delle squadre (al massimo 32) e i limiti del server per i testi (erroreTestiTappa: nome fino a 120 caratteri,
 *  luogo fino a 160, data vuota o aaaa-mm-gg). Oltre quelli del server la tappa sarebbe rifiutata alla creazione e poi a
 *  ogni salvataggio, perché ogni salvataggio manda la tappa intera. null se vanno bene. Si controllano prima di preparare
 *  le squadre: così nessuno crea squadre (o le registra in anagrafe) per una tappa che poi verrebbe rifiutata. */
export function erroreLimitiTappa(nSquadre: number, nGironi: number, testi: TestiTappa): string | null {
  if (!Number.isInteger(nSquadre) || nSquadre < 2 || nSquadre > MAX_SQUADRE) return LIMITE_SQUADRE;
  const gironi = erroreGironi(nSquadre, nGironi);
  if (gironi) return gironi;
  return erroreTestiTappa(testi);
}

/** Crea una tappa non ancora sorteggiata, con le regole predefinite: rispetta i limiti di erroreLimitiTappa e, come
 *  ogni tappa nello store, ha un nome non vuoto. */
export function creaTappa(dati: NuovaTappa): Esito {
  const limiti = erroreLimitiTappa(dati.squadre.length, dati.nGironi, dati);
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

/** Risultati registrati nella fase finale. I turni superati d'ufficio (`bye`) non sono risultati. */
const risultatiFaseFinale = (tappa: Tappa) => (tappa.bracket ?? []).filter((m) => m.done && !m.bye).length;

/** Risultati registrati in una tappa, gironi e fase finale */
const risultati = (tappa: Tappa) => tappa.partite.filter((m) => m.done).length + risultatiFaseFinale(tappa);

/** «Verranno eliminati a, b e c.»: la frase delle finestre di conferma. Una voce sola è sempre la tappa o la squadra, al
 *  femminile: «Verrà eliminata a.» */
function fraseEliminati(voci: string[]): string {
  if (voci.length === 1) return `Verrà eliminata ${voci[0]}.`;
  return `Verranno eliminati ${voci.slice(0, -1).join(", ")} e ${voci[voci.length - 1]}.`;
}

/** «la squadra «Falchi»», oppure solo «la squadra» se il nome è vuoto (campo svuotato, dati vecchi dell'ospite) */
function nominata(cosa: string, nome: string): string {
  const pulito = nome.trim();
  if (!pulito) return cosa;
  return `${cosa} «${pulito}»`;
}

/** Il sorteggio, la fase finale e i risultati che una tappa ha, nell'ordine in cui si elencano: vuoto se non ha niente.
 *  Con almeno un risultato le voci sono sempre due o più (i risultati stanno nel calendario o nel tabellone). */
function datiDiGioco(tappa: Tappa): string[] {
  const voci: string[] = [];
  if (tappa.gironi || tappa.partite.length > 0) voci.push("il sorteggio");
  if (tappa.bracket?.length) voci.push("la fase finale");
  const giocati = risultati(tappa);
  if (giocati > 0) voci.push(conteggio(giocati, "risultato", "risultati"));
  return voci;
}

/** Che cosa cancellano un nuovo sorteggio o un cambio di struttura (numero di gironi, squadre): il testo da mostrare
 *  nella richiesta di conferma, oppure null se non c'è nessun risultato da perdere e si può procedere senza chiedere.
 *  Lo usano l'interfaccia e il Coach (decisione D4). */
export function perditaRisultati(tappa: Tappa): string | null {
  if (risultati(tappa) === 0) return null;
  return fraseEliminati(datiDiGioco(tappa));
}

/** Che cosa cancella «Elimina»: la tappa con le sue squadre e, se ci sono, sorteggio, fase finale e risultati. Per questa
 *  azione la conferma si chiede sempre, quindi il testo c'è sempre. */
export function perditaTappa(tappa: Tappa): string {
  const voce = `${nominata("la tappa", tappa.nome)} con ${conteggio(tappa.squadre.length, "squadra", "squadre")}`;
  return fraseEliminati([voce, ...datiDiGioco(tappa)]);
}

/** Che cosa cancella «Elimina bracket e ricomincia»: il tabellone e i suoi risultati (quelli dei gironi restano). Anche
 *  per questa azione la conferma si chiede sempre. */
export function perditaTabellone(tappa: Tappa): string {
  const giocati = risultatiFaseFinale(tappa);
  const restano = "I risultati dei gironi restano.";
  if (giocati === 0) return `Verrà eliminato il tabellone. ${restano}`;
  return `Verranno eliminati il tabellone e ${conteggio(giocati, "risultato", "risultati")}. ${restano}`;
}

/** Il nome provvisorio di una squadra appena aggiunta, «Squadra 3» (lo dà aggiungiSquadra): finché resta quello nessuno ha
 *  scritto un nome */
export function eSegnaposto(nome: string): boolean {
  return /^Squadra \d+$/.test(nome.trim());
}

/** Che cosa cancella «Rimuovi squadra»: ciò che l'utente ha scritto (il nome, i giocatori con il nome) e, se ci sono, il
 *  sorteggio, la fase finale e i risultati, che il cambio di squadre azzera. null = niente di importante, si toglie senza
 *  chiedere: una squadra appena aggiunta (nome provvisorio, nessun giocatore) e nessun risultato. Un sorteggio senza
 *  risultati non fa chiedere da solo, come per un nuovo sorteggio: si rifà senza perdere niente. */
export function perditaSquadra(tappa: Tappa, squadraId: string): string | null {
  const squadra = tappa.squadre.find((s) => s.id === squadraId);
  if (!squadra) return null;
  const giocatori = (squadra.giocatori || []).filter((p) => p.nome.trim()).length;
  const nomeScritto = squadra.nome.trim() !== "" && !eSegnaposto(squadra.nome);
  if (!nomeScritto && giocatori === 0 && risultati(tappa) === 0) return null;
  let voce = nominata("la squadra", squadra.nome);
  if (giocatori > 0) voce += ` con ${conteggio(giocatori, "giocatore", "giocatori")}`;
  return fraseEliminati([voce, ...datiDiGioco(tappa)]);
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

  // Le schede statistiche si sovrascrivono solo se fornite: il Coach AI registra il solo totale. `ts` è il momento della
  // registrazione, anche di una correzione: dà l'ordine d'inserimento per «Ultimo risultato» (utils/ultimoRisultato)
  const aggiornata: Partita = { ...partita, sa, sb, done: true, ts: Date.now() };
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
