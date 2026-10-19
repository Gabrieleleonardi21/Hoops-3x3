/** Simulazione di una tappa: punteggi, tabellini e scelta delle squadre dall'anagrafe, come funzioni pure. Le usa il Coach AI
 *  per le tappe di prova: il modello sceglie i criteri, qui si generano i numeri. Il generatore casuale
 *  si passa come parametro (`rng`): in produzione è Math.random, nei test un generatore con seme, così una tappa si riproduce.
 *  Una simulazione non è mai un risultato vero: i numeri sono di prova, e il testo che il Coach riceve lo dice. */
import type { GiocatoreRoster, Regole, RegGiocatore, RegSquadra, SquadraTappa, StatLine, StatSheet, Tappa } from "../types";
import { MIN_ROSTER } from "../constants/rules";
import { registraRisultato, registraRisultatoBracket, generaFasiDirette } from "./tappaOps";
import { normalizza } from "../utils/statGiocatori";
import { standings } from "../utils/standings";
import { nomeSquadra, squadraDi } from "../utils/tappaInfo";
import { pulisci } from "../utils/buildCoachContext";
import { conteggio } from "../utils/testi";

/** Numeri in [0, 1). In produzione è Math.random; nei test si passa un generatore con seme */
export type Rng = () => number;

/** Intero tra min e max compresi */
const intero = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

/** Indice estratto con probabilità proporzionale al peso */
function scegli(pesi: number[], rng: Rng): number {
  let r = rng() * pesi.reduce((s, p) => s + p, 0);
  for (let i = 0; i < pesi.length; i++) {
    r -= pesi[i];
    if (r < 0) return i;
  }
  return pesi.length - 1;
}

/** Punteggio di una gara a due esiti: gara a `target` (60%), allo scadere (35%) o supplementare (5%). Le quote ricalcano una
 *  tappa reale: quasi tutte le gare finiscono a 21, le altre o allo scadere del tempo (vincitore sotto 21, perdente di
 *  qualche punto) o ai supplementari (che si vincono di `ot` punti). Il vincitore è 50/50; se entrambe le squadre hanno un
 *  punteggio ranking numerico, la più forte vince con il 65%: basta a far sentire la differenza senza rendere scontato il
 *  risultato. Non esce mai un pareggio (la regola di registraRisultato lo rifiuta) né un punteggio oltre target + 4. */
export function generaPunteggio(
  regole: Regole,
  forzaA: number | null,
  forzaB: number | null,
  rng: Rng = Math.random,
): { sa: number; sb: number } {
  const { target } = regole;
  const esito = rng();
  let vincente = 0;
  let perdente = 0;
  if (esito < 0.6) {
    // Gara finita a target: il perdente chiude tra target−15 e target−2 (mai sotto 0)
    vincente = target;
    perdente = intero(rng, Math.max(0, target - 15), target - 2);
  } else if (esito < 0.95) {
    // Allo scadere: il vincitore sta sotto il target, il perdente da 1 a 8 punti meno di lui
    vincente = intero(rng, 11, target - 1);
    perdente = vincente - intero(rng, 1, 8);
  } else {
    // Supplementare: x a x + ot, con x tra 14 e 20, così il massimo resta sotto target + 4
    const x = intero(rng, 14, 20);
    vincente = x + regole.ot;
    perdente = x;
  }

  // Probabilità che vinca la squadra A: se una ha un ranking più alto dell'altra, la vantaggia
  let pA = 0.5;
  if (forzaA !== null && forzaB !== null) {
    if (forzaA > forzaB) pA = 0.65;
    if (forzaB > forzaA) pA = 0.35;
  }
  const vinceA = rng() < pA;
  if (vinceA) return { sa: vincente, sb: perdente };
  return { sa: perdente, sb: vincente };
}

/** Tabellino di una squadra in una gara: i punti si assegnano canestro per canestro (da 2 nel 30% dei casi, altrimenti da 1),
 *  a un giocatore alla volta con pesi decrescenti (il primo del roster pesa 4, poi 3, 2, 1): così la somma dei `pt` è
 *  esattamente il totale della squadra, la regola che la UI impone ai punteggi registrati a mano. Le altre statistiche sono
 *  numeri plausibili e indipendenti dal punteggio. Roster vuoto: nessun tabellino ({}). Le chiavi sono gli id dei giocatori. */
export function generaTabellino(roster: GiocatoreRoster[], punti: number, rng: Rng = Math.random): StatSheet {
  if (roster.length === 0) return {};
  const linee: StatLine[] = roster.map(() => ({
    pt: 0, rb: intero(rng, 0, 6), as: intero(rng, 0, 3), ru: intero(rng, 0, 2), st: intero(rng, 0, 1), pe: intero(rng, 0, 3), fa: intero(rng, 0, 3),
  }));
  // Il primo del roster pesa 4, il secondo 3, e così via fino a 1 (e 1 anche oltre il quarto)
  const pesi = roster.map((_, i) => Math.max(1, 4 - i));
  let rimanenti = punti;
  while (rimanenti > 0) {
    // Non si va oltre il totale: l'ultimo canestro chiude esattamente la somma
    const canestro = Math.min(1 + Number(rng() < 0.3), rimanenti);
    const chi = scegli(pesi, rng);
    linee[chi].pt = (linee[chi].pt ?? 0) + canestro;
    rimanenti -= canestro;
  }
  return Object.fromEntries(roster.map((g, i) => [g.id, linee[i]]));
}

/** Criteri con cui il Coach chiede le squadre dall'anagrafe */
export interface CriteriScelta {
  n: number;
  modo: "casuale" | "ranking" | "citta";
  citta?: string;
  obbligatorie?: string[];
}

/** Le squadre che un nome indicato dal modello corrisponde: il nome esatto, altrimenti una parte del nome. È la regola di
 *  trovaPerNome (coach/toolHandlers), copiata qui perché importarla farebbe un ciclo (toolHandlers importa questo file). La
 *  differenza: l'ambiguità non lancia un'eccezione ma torna come elenco, perché qui la risposta è un Esito. */
function cercaSquadra(squadre: RegSquadra[], nome: string): RegSquadra[] {
  const nl = nome.trim().toLowerCase();
  const esatte = squadre.filter((s) => s.nome.toLowerCase() === nl);
  if (esatte.length > 0) return esatte;
  return squadre.filter((s) => s.nome.toLowerCase().includes(nl));
}

/** Punti ranking come numero; null se il campo è vuoto o non è un numero */
function rankDi(s: RegSquadra): number | null {
  const testo = String(s.rank).trim();
  if (testo === "") return null;
  const n = Number(testo);
  if (Number.isFinite(n)) return n;
  return null;
}

/** Ordine per ranking decrescente; chi non ha un ranking numerico sta in fondo, nell'ordine d'ingresso (il sort è stabile) */
function perRank(squadre: RegSquadra[]): RegSquadra[] {
  return [...squadre].sort((a, b) => {
    const x = rankDi(a);
    const y = rankDi(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x;
  });
}

/** Ordine casuale con il generatore passato (Fisher-Yates): shuffle.ts usa Math.random e qui non si può */
function mescola<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Scelta delle squadre per una tappa di prova. Ammissibili sono le squadre con almeno MIN_ROSTER giocatori registrati: una
 *  squadra senza giocatori non si può simulare. Prima le obbligatorie (per nome), poi le altre secondo il criterio: a caso,
 *  per ranking, o per città (poi per ranking). L'anagrafe non si modifica: si scelgono solo squadre già registrate. */
export function scegliSquadre(
  squadre: RegSquadra[],
  giocatori: RegGiocatore[],
  criteri: CriteriScelta,
  rng: Rng = Math.random,
): { ok: true; squadre: RegSquadra[] } | { ok: false; errore: string } {
  if (criteri.modo === "citta" && !criteri.citta) return { ok: false, errore: "Per scegliere per città indica la città." };
  const presenti = new Set(giocatori.map((g) => g.id));
  const ammissibili = squadre.filter((s) => s.roster.filter((id) => presenti.has(id)).length >= MIN_ROSTER);

  const scelte: RegSquadra[] = [];
  for (const nome of criteri.obbligatorie ?? []) {
    const trovate = cercaSquadra(squadre, nome);
    if (trovate.length === 0) return { ok: false, errore: `La squadra «${pulisci(nome)}» non è in anagrafe.` };
    if (trovate.length > 1) {
      const elenco = trovate.map((s) => `«${pulisci(s.nome)}»`).join(", ");
      return { ok: false, errore: `Più squadre corrispondono a «${pulisci(nome)}»: ${elenco}. Indica il nome completo.` };
    }
    const [squadra] = trovate;
    if (!ammissibili.includes(squadra)) {
      return { ok: false, errore: `La squadra «${pulisci(squadra.nome)}» non ha almeno ${MIN_ROSTER} giocatori in anagrafe.` };
    }
    if (!scelte.includes(squadra)) scelte.push(squadra);
  }
  if (scelte.length > criteri.n) {
    return { ok: false, errore: `Le squadre da includere (${scelte.length}) sono più di quelle richieste (${criteri.n}).` };
  }

  const pool = ammissibili.filter((s) => !scelte.includes(s));
  let candidate = pool;
  if (criteri.modo === "citta") candidate = pool.filter((s) => normalizza(s.citta) === normalizza(criteri.citta ?? ""));
  const disponibili = scelte.length + candidate.length;
  if (disponibili < criteri.n) {
    let luogo = "";
    if (criteri.modo === "citta") luogo = ` a ${pulisci(criteri.citta ?? "")}`;
    return {
      ok: false,
      errore: `In anagrafe ci sono solo ${disponibili} squadre con almeno ${MIN_ROSTER} giocatori${luogo}: `
        + `chiedi al massimo ${disponibili} squadre oppure completa i roster`,
    };
  }

  // Il casuale mescola con rng; ranking e città ordinano per punti ranking
  let ordinate = perRank(candidate);
  if (criteri.modo === "casuale") ordinate = mescola(candidate, rng);
  return { ok: true, squadre: [...scelte, ...ordinate.slice(0, criteri.n - scelte.length)] };
}

/** Opzioni di una simulazione: quali fasi giocare, se generare i tabellini, quante squadre per girone passano */
export interface OpzioniSimulazione {
  fase: "tutto" | "gironi" | "finale";
  tabellini: boolean;
  qualificate: number;
}

/** Che cosa è successo in una simulazione, in numeri e testi brevi (non la tappa intera) */
export interface Rapporto {
  gareGironi: number;
  gareTabellone: number;
  /** Una classifica per girone, numerato da 1; righe «1. Alfa 3-0» (posizione, nome, vittorie-sconfitte) */
  classifiche: { girone: number; righe: string[] }[];
  campione: string | null;
  /** «Team Rome su Concrete 21-17», se la finale è stata giocata */
  finale: string | null;
  note: string[];
}

/** Forza di una squadra per il punteggio: il ranking se è un numero, altrimenti null */
function forza(squadra: SquadraTappa | undefined): number | null {
  if (!squadra) return null;
  const testo = String(squadra.rank).trim();
  if (testo === "") return null;
  const n = Number(testo);
  if (Number.isFinite(n)) return n;
  return null;
}

/** Tabellino di una squadra, se va generato: serve che lo si chieda e che il roster non sia vuoto. Il rng avanza solo qui */
function tabellinoDi(squadra: SquadraTappa | undefined, punti: number, tabellini: boolean, rng: Rng): StatSheet | undefined {
  if (!tabellini || !squadra || squadra.giocatori.length === 0) return undefined;
  return generaTabellino(squadra.giocatori, punti, rng);
}

/** La prossima gara del tabellone da giocare: la prima nell'ordine dei turni con entrambe le squadre note */
function prossimoMatch(t: Tappa) {
  return (t.bracket ?? []).find((m) => !m.done && m.squadraA !== null && m.squadraB !== null);
}

/** Vincitore della finale (se giocata) e il punteggio, per il testo del riepilogo */
function esitoFinale(t: Tappa): { campione: string; finale: string } | null {
  const bracket = t.bracket ?? [];
  const ultima = bracket[bracket.length - 1];
  if (!ultima || !ultima.done || ultima.squadraA === null || ultima.squadraB === null) return null;
  // Chi ha più punti vince: la squadra A se ha segnato di più, altrimenti la B
  let vincente = ultima.squadraB;
  let perdente = ultima.squadraA;
  if (ultima.pA > ultima.pB) {
    vincente = ultima.squadraA;
    perdente = ultima.squadraB;
  }
  const campione = nomeSquadra(t.squadre, vincente);
  const punteggio = `${Math.max(ultima.pA, ultima.pB)}-${Math.min(ultima.pA, ultima.pB)}`;
  return { campione, finale: `${campione} su ${nomeSquadra(t.squadre, perdente)} ${punteggio}` };
}

/** Simula una tappa sorteggiata: le gare dei gironi non ancora giocate (con i tabellini, se richiesti), poi, se la fase lo
 *  prevede e i gironi sono finiti, il tabellone (se manca) e le sue gare fino alla finale. Le gare già registrate non si
 *  toccano. Il tabellone non ha tabellini: il modello dati (BracketMatch) non li prevede, e le statistiche di stagione contano
 *  solo i gironi. Restituisce la tappa nuova: quella ricevuta non cambia. */
export function simulaTappa(
  tappa: Tappa,
  opzioni: OpzioniSimulazione,
  rng: Rng = Math.random,
): { ok: true; tappa: Tappa; rapporto: Rapporto } | { ok: false; errore: string } {
  const { nome, gironi } = tappa;
  if (tappa.conclusa) return { ok: false, errore: `La tappa "${nome}" è conclusa.` };
  if (!gironi) return { ok: false, errore: `La tappa "${nome}" non è ancora sorteggiata: fai prima il sorteggio.` };
  const daGiocare = tappa.partite.filter((m) => !m.done);
  if (opzioni.fase === "finale" && daGiocare.length > 0) {
    return { ok: false, errore: `Per la finale mancano ancora ${daGiocare.length} partite dei gironi: simula prima i gironi.` };
  }

  let t = tappa;
  const note: string[] = [];
  let gareGironi = 0;
  if (opzioni.fase !== "finale") {
    for (const m of daGiocare) {
      const squadraA = squadraDi(t.squadre, m.a);
      const squadraB = squadraDi(t.squadre, m.b);
      const { sa, sb } = generaPunteggio(t.regole, forza(squadraA), forza(squadraB), rng);
      const pa = tabellinoDi(squadraA, sa, opzioni.tabellini, rng);
      const pb = tabellinoDi(squadraB, sb, opzioni.tabellini, rng);
      const esito = registraRisultato(t, m.id, { sa, sb, pa, pb });
      if (!esito.ok) return { ok: false, errore: esito.errore };
      t = esito.tappa;
      gareGironi++;
    }
  }

  let gareTabellone = 0;
  const gironiFiniti = t.partite.every((m) => m.done);
  if (opzioni.fase !== "gironi" && gironiFiniti) {
    if (!t.bracket) {
      if (gironi.length < 2) {
        note.push("Con un girone solo non c'è fase finale.");
      } else {
        const esito = generaFasiDirette(t, opzioni.qualificate);
        if (!esito.ok) return { ok: false, errore: esito.errore };
        t = esito.tappa;
      }
    }
    let m = prossimoMatch(t);
    while (m) {
      // Un match del tabellone non ha tabellini: si registra solo il punteggio della gara
      const { sa, sb } = generaPunteggio(t.regole, forza(squadraDi(t.squadre, m.squadraA)), forza(squadraDi(t.squadre, m.squadraB)), rng);
      const esito = registraRisultatoBracket(t, m.id, sa, sb);
      if (!esito.ok) return { ok: false, errore: esito.errore };
      t = esito.tappa;
      gareTabellone++;
      m = prossimoMatch(t);
    }
  }

  if (gareGironi + gareTabellone === 0) return { ok: false, errore: `La tappa "${nome}" non ha gare da giocare.` };

  const nomeDi = (id: string) => nomeSquadra(t.squadre, id);
  const classifiche = gironi.map((g, i) => ({
    girone: i + 1,
    righe: standings(g, t.partite, nomeDi).map((r, pos) => `${pos + 1}. ${r.nome} ${r.v}-${r.p}`),
  }));
  const finale = esitoFinale(t);
  return {
    ok: true,
    tappa: t,
    rapporto: {
      gareGironi, gareTabellone, classifiche,
      campione: finale?.campione ?? null,
      finale: finale?.finale ?? null,
      note,
    },
  };
}

/** Il testo che il Coach riceve dopo una simulazione: chi lo legge sa che cosa è stato giocato, con quali numeri di prova e
 *  che la tappa non è ancora conclusa. Una tappa nuova elenca le squadre; una esistente conta le gare mancanti giocate */
export function riepilogoSimulazione(
  nomeTappa: string,
  rapporto: Rapporto,
  dettagli: { squadre?: string[]; nuova: boolean; tabellini: boolean },
): string {
  const giocate = rapporto.gareGironi + rapporto.gareTabellone;
  const frasi: string[] = [];
  let tabellini = "";
  if (dettagli.tabellini) tabellini = " con i tabellini";
  let finale = "";
  if (rapporto.finale) finale = `, fase finale giocata: vince ${rapporto.finale}`;
  if (dettagli.nuova) {
    const squadre = dettagli.squadre ?? [];
    const gironi = conteggio(rapporto.classifiche.length, "girone", "gironi");
    const elenco = squadre.join(", ");
    frasi.push(
      `Tappa "${nomeTappa}" creata con ${conteggio(squadre.length, "squadra", "squadre")} dall'anagrafe (${elenco}), `
        + `${gironi}, ${conteggio(giocate, "gara giocata", "gare giocate")}${tabellini}${finale}.`,
    );
  } else {
    frasi.push(`Tappa "${nomeTappa}": ${conteggio(giocate, "gara mancante giocata", "gare mancanti giocate")}${tabellini}${finale}.`);
  }
  if (rapporto.classifiche.length > 0) {
    const righe = rapporto.classifiche.map((c) => `girone ${c.girone}: ${c.righe.join(", ")}`).join("; ");
    frasi.push(`Classifiche dei gironi (vittorie-sconfitte): ${righe}.`);
  }
  frasi.push(...rapporto.note);
  // Sempre, anche per una tappa esistente: il Coach non deve presentare questi punteggi come veri
  frasi.push("I punteggi sono numeri di prova generati dall'app, non risultati veri.");
  frasi.push("La tappa non è conclusa: per pubblicarla chiedi di concluderla.");
  return frasi.join(" ");
}
