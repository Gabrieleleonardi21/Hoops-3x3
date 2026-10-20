/** Helper condivisi dagli strumenti del Coach AI: letture degli argomenti, ricerche per nome, tappe e anagrafe. Stanno qui e non
 *  in toolHandlers.ts perché li usano sia toolHandlers.ts sia toolHandlersSimulazione.ts: se fossero in toolHandlers.ts, quel file
 *  importerebbe l'altro e l'altro importerebbe lui (un ciclo di import). */
import { useAppStore, tappaCorrente } from "../stores/useAppStore";
import { useAnagrafeStore } from "../stores/useAnagrafeStore";
import { anagrafeApi } from "../services/anagrafeApi";
import { testoErrore } from "../services/api";
import { uid } from "../utils/uid";
import { MAX_ROSTER } from "../constants/rules";
import { pulisci, senzaTag } from "../utils/buildCoachContext";
import { registraRisultato, registraRisultatoBracket, type Esito } from "../domain/tappaOps";
import type { Tappa, RegSquadra, RegGiocatore, SquadraTappa } from "../types";
import { letteraGironeDi, postoSquadra, squadraDi } from "../utils/tappaInfo";
import { dataItaliana } from "../utils/formato";
import { haOmonimi, normalizza } from "../utils/identita";
import { trovaPerNome, type Dettagli } from "../utils/ricercaPerNome";

// trovaPerNome vive in utils/ricercaPerNome (la usa anche il dominio): qui si ri-esporta perché chi la importa da strumentiComuni non cambi
export { trovaPerNome };

/** Ciò che l'hook dà agli strumenti */
export interface ContestoStrumenti {
  /** Apre una pagina dell'app */
  vai: (percorso: string) => void;
  /** Il segnale della richiesta: interrotto se intanto la chat viene cancellata */
  segnale: AbortSignal;
  /** Mostra nel pannello la richiesta di conferma di un'azione distruttiva (D4); true = «Conferma» */
  chiediConferma: (titolo: string, testo: string) => Promise<boolean>;
  /** Le chiavi (`chiaveCreato`) delle tappe, squadre e giocatori creati in questa richiesta: il modello non ne crea due con lo stesso
   *  nome nella stessa richiesta.
   *  Facoltativo: chi non lo passa non ha il controllo, e le tappe della lega restano coperte dalla conferma (D3) */
  creati?: Set<string>;
}

export type Argomenti = Record<string, unknown>;

/* ── Lettura degli argomenti ── */

/** Legge un campo stringa dagli argomenti del tool, con fallback a stringa vuota. */
export function str(args: Argomenti, key: string): string {
  if (typeof args[key] !== "string") return "";
  return (args[key] as string).trim();
}

/** Testo obbligatorio: se manca o è vuoto lo strumento non agisce (un nome vuoto «corrisponde» a qualsiasi squadra,
 *  e il risultato finirebbe sulla prima partita libera) e il modello sa che cosa manca */
export function obbligatorio(args: Argomenti, key: string, cosa: string): string {
  const valore = str(args, key);
  if (!valore) throw new Error(`Manca ${cosa} (${key}).`);
  return valore;
}

/** true se il modello ha passato l'argomento facoltativo (null vale come assente): se c'è va controllato, non ignorato */
export function presente(args: Argomenti, key: string): boolean {
  return args[key] !== undefined && args[key] !== null;
}

/** Campo numerico: un numero, oppure un testo che lo contiene ("21"); NaN se manca. Number e non parseInt: "21.5"
 *  resta decimale e tappaOps lo rifiuta, invece di diventare 21 */
export function numero(args: Argomenti, key: string): number {
  const valore = args[key];
  if (typeof valore === "number") return valore;
  const testo = str(args, key);
  if (!testo) return NaN;
  return Number(testo);
}

/** Nomi delle squadre di crea_tappa: un elenco di nomi non vuoti (quanti, lo controlla erroreLimitiTappa) */
export function nomiSquadre(args: Argomenti): string[] {
  if (!Array.isArray(args.squadre)) throw new Error("Manca l'elenco delle squadre (squadre).");
  const nomi = args.squadre.map((n) => {
    if (typeof n === "string") return n.trim();
    return "";
  });
  if (nomi.some((n) => !n)) throw new Error("Nell'elenco delle squadre c'è un nome vuoto: serve il nome di ogni squadra.");
  return nomi;
}

/** Il primo nome di squadra che compare due volte nell'elenco (maiuscole, accenti e spazi a parte), come è stato scritto la prima volta.
 *  Due volte la stessa squadra in crea_tappa darebbe due squadre con lo stesso nome nella tappa: non si crea */
export function squadraRipetuta(nomi: string[]): string | null {
  const prime = new Map<string, string>();
  for (const nome of nomi) {
    const chiave = normalizza(nome);
    const prima = prime.get(chiave);
    if (prima !== undefined) return prima;
    prime.set(chiave, nome);
  }
  return null;
}

/** Numero di gironi di crea_tappa: quello indicato (erroreLimitiTappa vuole un intero), altrimenti 2, oppure 1 con meno
 *  di 4 squadre (ogni girone ne vuole almeno 2) */
export function gironiRichiesti(args: Argomenti, nSquadre: number): number {
  if (presente(args, "nGironi")) return numero(args, "nGironi");
  if (nSquadre < 4) return 1;
  return 2;
}

/** Squadre per girone che passano alla fase finale: 2 se non è indicato (come l'interfaccia), altrimenti un intero da
 *  1 in su. Prima un valore sbagliato diventava 2 in silenzio, e un tabellone generato non si rigenera */
export function qualificateRichieste(args: Argomenti): number {
  if (!presente(args, "qualificate")) return 2;
  const n = numero(args, "qualificate");
  if (!Number.isInteger(n) || n < 1) throw new Error("Numero di qualificate per girone non valido: serve un intero da 1 in su.");
  return n;
}

/** Normalizza il parametro 'fase' a "girone" | "bracket" | null (nessun filtro). */
function faseFilter(raw: string): "girone" | "bracket" | null {
  const f = raw.toLowerCase();
  if (f.includes("giron")) return "girone";
  if (f.includes("dirett") || f.includes("bracket") || f.includes("final") || f.includes("semi") || f.includes("quarto") || f.includes("elimin")) return "bracket";
  return null;
}

/* ── Tappe, squadre e conferme ── */

/** La chat è stata cancellata (o l'utente è uscito) mentre lo strumento aspettava una lettura: la richiesta è
 *  abbandonata e lo strumento non scrive niente. Le scritture già spedite al server finiscono comunque */
export function fermaSeCancellata(segnale: AbortSignal) {
  if (segnale.aborted) throw new Error("La chat è stata cancellata: azione non eseguita.");
}

/** D4: un'azione distruttiva parte solo con «Conferma»; con «Annulla» lo strumento si ferma e il modello lo sa */
export async function confermata(ctx: ContestoStrumenti, titolo: string, testo: string) {
  if (await ctx.chiediConferma(titolo, testo)) return;
  throw new Error("L'utente ha annullato: azione non eseguita. Non riprovarla se non te lo chiede di nuovo.");
}

/* ── Come si distinguono tappe e squadre omonime, e come si nominano nelle conferme ── */

// Una tappa salvata da una versione vecchia può non avere data o luogo: come in buildCoachContext, vale il testo vuoto
const dataDi = (t: Tappa) => String(t.data ?? "");
const luogoDi = (t: Tappa) => String(t.luogo ?? "");
/** Come si distinguono due tappe dello stesso nome: data e luogo, che il dettaglio tra parentesi accetta («Roma Open (26/06/2026)») */
export const dettagliTappa: Dettagli<Tappa> = {
  descrittori: (t) => [dataItaliana(dataDi(t)), dataDi(t), luogoDi(t)].filter((d) => d.trim()),
  descrivi: (t) => `"${pulisci(t.nome)}" (${pulisci(dataItaliana(dataDi(t))) || "senza data"}, ${pulisci(luogoDi(t)) || "senza luogo"})`,
};

/** La città dell'anagrafe della squadra collegata, dalla cache se è caricata: la squadra della tappa non la porta con sé */
function cittaDi(s: SquadraTappa): string {
  if (!s.regId) return "";
  const reg = (useAnagrafeStore.getState().squadre ?? []).find((r) => r.id === s.regId);
  return reg?.citta ?? "";
}

/** Come si distinguono due squadre dello stesso nome in una tappa: il girone, la città dell'anagrafe e i giocatori. Il dettaglio
 *  «Roma (girone B)» o «Roma (Torino)» o il nome di un giocatore sceglie tra le omonime */
export function dettagliSquadra(tappa: Tappa): Dettagli<SquadraTappa> {
  return {
    descrittori: (s) => {
      // «girone B» e «B» (la lettera da sola), così il dettaglio «B» e «girone B» scelgono la stessa squadra
      const parti: string[] = [];
      const lettera = letteraGironeDi(tappa, s.id);
      if (lettera) parti.push(`girone ${lettera}`, lettera);
      parti.push(cittaDi(s), ...(s.giocatori ?? []).map((g) => g.nome));
      return parti.filter((p) => p.trim());
    },
    descrivi: (s) => {
      const testa = [cittaDi(s), postoSquadra(tappa, s.id)].filter((p) => p.trim()).map((p) => pulisci(p)).join(", ");
      const nomi = (s.giocatori ?? []).map((g) => pulisci(g.nome)).filter((n) => n.trim());
      let coda = "";
      if (nomi.length) coda = `: ${nomi.join(", ")}`;
      return `"${pulisci(s.nome)}" (${testa}${coda})`;
    },
  };
}

/** Come si nomina una tappa nei testi delle conferme: il nome tra virgolette, e con data e luogo solo se un'altra tappa della
 *  lega ha lo stesso nome. Così la conferma dice quale delle due */
export function etichettaTappa(tappa: Tappa, tappe: Tappa[]): string {
  if (haOmonimi(tappe, tappa, (t) => t.nome)) return dettagliTappa.descrivi(tappa);
  return `"${pulisci(tappa.nome)}"`;
}

/** Come si nomina una squadra nei testi delle conferme: il nome, e il girone solo se la tappa ha un'omonima */
export function etichettaSquadra(tappa: Tappa, squadra: SquadraTappa): string {
  if (haOmonimi(tappa.squadre, squadra, (s) => s.nome)) return `${pulisci(squadra.nome)} (${postoSquadra(tappa, squadra.id)})`;
  return pulisci(squadra.nome);
}

/** Trova una tappa per nome (trovaPerNome); se il nome manca restituisce l'ultima. Con «Roma Open» e «Roma Open 2» aperte
 *  insieme, «Roma» è un errore e non la prima delle due (registra_risultato non chiede conferma) */
function findTappa(tappe: Tappa[], nomeTappa?: string): Tappa | null {
  if (!nomeTappa) {
    if (tappe.length === 0) return null;
    return tappe[tappe.length - 1];
  }
  return trovaPerNome(tappe, nomeTappa, (t) => t.nome, "tappe", dettagliTappa);
}

/** La tappa indicata da `tappa_nome` (o l'ultima, se manca) com'è adesso nello store. Un tappa_nome passato ma non
 *  valido (un numero, un testo vuoto) è un errore: prima diventava «l'ultima tappa» e lo strumento agiva su quella */
export function tappaRichiesta(args: Argomenti): Tappa {
  const nome = str(args, "tappa_nome");
  if (presente(args, "tappa_nome") && !nome) {
    throw new Error("Nome della tappa non valido: indica il nome (o una sua parte), oppure omettilo per usare l'ultima tappa.");
  }
  const tappa = findTappa(useAppStore.getState().tappe, nome || undefined);
  if (!tappa) throw new Error("Nessuna tappa trovata: crea prima una tappa con le squadre.");
  return tappa;
}

/** Errore di un'operazione di tappa, con il nome della tappa così l'AI sa a quale si riferisce */
function erroreTappa(tappa: Tappa, errore: string): string {
  return `Tappa "${pulisci(tappa.nome)}": ${errore}`;
}

/** La tappa che darebbe un'operazione di tappaOps, senza salvarla; se tappaOps la rifiuta, errore con il motivo.
 *  Da sola serve prima di una conferma (D4): l'utente non conferma un'azione che poi verrebbe rifiutata */
export function prova(tappa: Tappa, operazione: (t: Tappa) => Esito): Tappa {
  const esito = operazione(tappa);
  if (!esito.ok) throw new Error(erroreTappa(tappa, esito.errore));
  return esito.tappa;
}

/** Applica un'operazione di tappaOps alla tappa com'è adesso nello store e salva la nuova versione. La tappa si rilegge
 *  per id: dopo l'attesa di una conferma può essere cambiata. Se non è più nella lega aperta (un'altra lega aperta, la
 *  tappa eliminata) è un errore: replaceTappa la ignorerebbe in silenzio e lo strumento direbbe di esserci riuscito */
export function applica(tappa: Tappa, operazione: (t: Tappa) => Esito): Tappa {
  const corrente = tappaCorrente(tappa.id);
  if (!corrente) throw new Error(`La tappa "${pulisci(tappa.nome)}" non è più nella lega aperta: azione non eseguita.`);
  const nuova = prova(corrente, operazione);
  useAppStore.getState().replaceTappa(nuova);
  return nuova;
}

/** La squadra della tappa indicata dal modello, per nome con la regola di trovaPerNome (esatto, poi una parte del nome solo se
 *  corrisponde a una squadra sola) */
export function squadraRichiesta(tappa: Tappa, nome: string): SquadraTappa {
  const squadra = trovaPerNome(tappa.squadre, nome, (s) => s.nome, "squadre della tappa", dettagliSquadra(tappa));
  if (!squadra) throw new Error(`Nessuna squadra della tappa "${pulisci(tappa.nome)}" si chiama "${nome}".`);
  return squadra;
}

/** Le due squadre della tappa indicate dal modello, trovate per nome con la regola di trovaPerNome (esatto, poi una parte del
 *  nome solo se corrisponde a una squadra sola). Prima bastava che un nome contenesse l'altro: con «Roma», «Roma Nord» e «Milano»
 *  il risultato finiva sulla partita sbagliata o con i punteggi invertiti. Ogni partita poi si cerca e si orienta per id */
export function squadreRichieste(tappa: Tappa, nomeA: string, nomeB: string): [SquadraTappa, SquadraTappa] {
  const a = squadraRichiesta(tappa, nomeA);
  const b = squadraRichiesta(tappa, nomeB);
  if (a.id === b.id) throw new Error(`"${nomeA}" e "${nomeB}" indicano la stessa squadra, "${pulisci(a.nome)}": servono due squadre diverse.`);
  return [a, b];
}

/** true se la gara è tra le due squadre, in qualunque ordine */
export function stessaCoppia(x: string | null, y: string | null, idA: string, idB: string): boolean {
  return (x === idA && y === idB) || (x === idB && y === idA);
}

/** Una squadra di una partita trovata per nome: c'è sempre, perché la ricerca è passata dai nomi delle squadre della tappa. Se manca
 *  la tappa è rovinata, e lo strumento si ferma invece di registrare un risultato a metà */
export function squadraDellaPartita(tappa: Tappa, id: string | null): SquadraTappa {
  const squadra = squadraDi(tappa.squadre, id);
  if (!squadra) throw new Error(`Tappa "${pulisci(tappa.nome)}": una squadra della partita non è più nella tappa.`);
  return squadra;
}

/** L'anagrafe non ha risposto: lo strumento si ferma con il motivo vero. Una lista vuota al suo posto farebbe passare per nuove
 *  le squadre che esistono già (crea_tappa le registrerebbe due volte nell'anagrafe condivisa) e per assenti quelle da
 *  aggiornare (aggiorna_squadra direbbe «non trovata» anche se il server non ha risposto) */
function anagrafeNonRisponde(e: unknown): never {
  throw new Error(`L'anagrafe condivisa non risponde (${senzaTag(testoErrore(e))}): non ho registrato né modificato niente, riprova tra poco.`);
}

/** Anagrafe dal backend, sempre fresca; se il server non risponde lancia un errore (anagrafeNonRisponde). */
export async function fetchSquadre(): Promise<RegSquadra[]> {
  return anagrafeApi.listSquadre().catch(anagrafeNonRisponde);
}
export async function fetchGiocatori(): Promise<RegGiocatore[]> {
  return anagrafeApi.listGiocatori().catch(anagrafeNonRisponde);
}

/** Il messaggio quando non c'è una lega aperta: lo stesso per crea_tappa e crea_tappa_simulata */
export const ERRORE_NESSUNA_LEGA = "Nessuna lega attiva: crea una lega prima di aggiungere tappe.";

/** Il testo della conferma per una tappa che ha già lo stesso nome nella lega (D3): dice quali sono, con data e luogo */
export const CONFERMA_TAPPA_OMONIMA = (elenco: string) => `Esiste già una tappa con questo nome: ${elenco}. Crearne un'altra con lo stesso nome?`;

/** Il testo della conferma per una squadra o un giocatore già registrato con lo stesso nome (D3). `elenco` descrive chi c'è già,
 *  `nuova` completa la frase («un'altra» per una squadra, «un altro» per un giocatore) */
export const CONFERMA_VOCE_OMONIMA = (elenco: string, nuova: "un'altra" | "un altro") =>
  `Esiste già ${elenco}. Registrarne ${nuova}?`;

/** D3: una tappa con lo stesso nome di una della lega si crea solo se l'utente conferma, perché i doppioni restano permessi. Le
 *  tappe create in questa stessa richiesta non passano di qui: sono un errore (erroreTappaDuplicata, in creati) */
export async function confermaTappaOmonima(nome: string, tappe: Tappa[], ctx: ContestoStrumenti) {
  const omonime = tappe.filter((t) => normalizza(t.nome) === normalizza(nome));
  if (omonime.length === 0) return;
  const elenco = omonime.map((t) => dettagliTappa.descrivi(t)).join("; ");
  await confermata(ctx, "Tappa con lo stesso nome", CONFERMA_TAPPA_OMONIMA(elenco));
}

/** Il nome di una tappa nuova non può esistere già nella lega aperta: il messaggio è lo stesso per crea_tappa e per le tappe simulate.
 *  Il nome lo ha scritto il modello (o l'utente), e passa da pulisci come gli altri nomi nei testi */
export function erroreTappaDuplicata(nome: string): string {
  return `La tappa "${pulisci(nome)}" esiste già in questa lega: non ne creo un'altra.`;
}

/** La chiave con cui `creati` ricorda una voce creata in questa richiesta: il tipo e il nome normalizzato («squadra:roma») */
export function chiaveCreato(tipo: "tappa" | "squadra" | "giocatore", nome: string): string {
  return `${tipo}:${normalizza(nome)}`;
}

/** La squadra o il giocatore registrati due volte nella stessa richiesta: è il modello che ripete lo strumento, non l'utente */
export const erroreSquadraRipetuta = (nome: string) =>
  `La squadra "${pulisci(nome)}" è già stata registrata in questa richiesta: non ne registro un'altra.`;
export const erroreGiocatoreRipetuto = (nome: string, cognome: string) =>
  `Il giocatore "${pulisci(nome)} ${pulisci(cognome)}" è già stato registrato in questa richiesta: non ne registro un altro.`;

/** I giocatori del roster di una squadra dell'anagrafe, nell'ordine del roster. Un id che non è più tra i giocatori dell'anagrafe si salta */
function giocatoriDelRoster(reg: RegSquadra, giocatori: RegGiocatore[]): RegGiocatore[] {
  return reg.roster.flatMap((id) => {
    const g = giocatori.find((x) => x.id === id);
    if (!g) return [];
    return [g];
  });
}

/** I nomi («Nome Cognome») dei giocatori del roster di una squadra dell'anagrafe, nell'ordine del roster */
export function nomiRoster(reg: RegSquadra, giocatori: RegGiocatore[]): string[] {
  return giocatoriDelRoster(reg, giocatori).map((g) => `${g.nome} ${g.cognome}`);
}

/** La squadra di una tappa presa dall'anagrafe: nome, punti ranking e collegamenti (logo, sito, Instagram), con i giocatori del roster.
 *  Al massimo MAX_ROSTER, il tetto che l'interfaccia impone alle squadre di una tappa: gli altri (dopo i primi dell'anagrafe) restano
 *  fuori, e chi chiama lo dice al modello (nomiRoster) */
export function squadraTappaDaAnagrafe(reg: RegSquadra, giocatori: RegGiocatore[]): SquadraTappa {
  return {
    id: uid(),
    nome: reg.nome,
    // regId: l'id della voce in anagrafe, che le statistiche usano per riconoscere il giocatore anche tra omonimi
    giocatori: giocatoriDelRoster(reg, giocatori).slice(0, MAX_ROSTER).map((g) => ({ id: uid(), nome: `${g.nome} ${g.cognome}`, regId: g.id })),
    rank: reg.rank || "",
    regId: reg.id,
    logo: reg.logo || undefined,
    website: reg.website || undefined,
    instagram: reg.instagram || undefined,
  };
}

/** Esito di una riga di registra_risultato: la tappa nuova, il testo per il modello e la sintesi del punteggio («Alfa 21 — 15 Beta»),
 *  che registra_risultati usa per il riepilogo di più righe */
export interface RisultatoRiga {
  tappa: Tappa;
  testo: string;
  sintesi: string;
}

/** Registra un risultato (nei gironi o nel tabellone) su `tappa`: trova la partita tra le due squadre e la registra. Non salva niente,
 *  lo fa chi chiama. Lancia l'errore con il motivo se la partita non c'è o se tappaOps rifiuta il risultato. Serve sia a registra_risultato
 *  (una riga) sia a registra_risultati (più righe su una copia della tappa, poi una sola replaceTappa) */
export function registraUnaRiga(tappa: Tappa, args: Argomenti): RisultatoRiga {
  // Prima gli argomenti: con un nome vuoto la ricerca troverebbe la prima partita libera
  const nomeA = obbligatorio(args, "squadra_a", "il nome della prima squadra");
  const nomeB = obbligatorio(args, "squadra_b", "il nome della seconda squadra");
  const pA = numero(args, "punti_a");
  const pB = numero(args, "punti_b");

  if (!tappa.gironi) throw new Error(`La tappa "${pulisci(tappa.nome)}" non è ancora sorteggiata: fai prima il sorteggio.`);

  const nomeOf = (id: string | null) => squadraDi(tappa.squadre, id)?.nome ?? "";
  const [richiestaA, richiestaB] = squadreRichieste(tappa, nomeA, nomeB);

  // Candidato nei gironi: partita non ancora registrata tra le due squadre
  let matchGirone = tappa.partite.find((m) => !m.done && stessaCoppia(m.a, m.b, richiestaA.id, richiestaB.id));
  // Candidato nella fase finale: match con entrambe le squadre note e non ancora giocato
  let matchBracket = (tappa.bracket ?? []).find(
    (m) => !m.done && stessaCoppia(m.squadraA, m.squadraB, richiestaA.id, richiestaB.id),
  );

  // Filtro 'fase' esplicito: passato solo per disambiguare
  const fase = faseFilter(str(args, "fase"));
  if (fase === "girone")  matchBracket = undefined;
  if (fase === "bracket") matchGirone  = undefined;

  // Ambiguità: la stessa coppia è in gioco in entrambe le fasi. Caso raro (possibile solo
  // se un risultato di girone viene annullato DOPO aver generato il bracket): non indoviniamo,
  // chiediamo di specificare la fase. Nel flusso normale è impossibile, perché il bracket si
  // genera solo a gironi conclusi: quindi quando il bracket esiste non c'è nessun girone aperto.
  if (matchGirone && matchBracket) {
    throw new Error(`"${nomeA}" e "${nomeB}" risultano in gioco sia nei gironi sia nella fase finale (${matchBracket.label}). Specifica la fase: "nei gironi" oppure "in ${matchBracket.label}".`);
  }

  // --- Risultato di un girone ---
  if (matchGirone) {
    const mg = matchGirone;
    const sqA = squadraDellaPartita(tappa, mg.a);
    const sqB = squadraDellaPartita(tappa, mg.b);
    // Allinea i punteggi all'ordine a/b della partita per non invertirli: conta l'id, non il nome
    let sa = pB;
    let sb = pA;
    if (mg.a === richiestaA.id) {
      sa = pA;
      sb = pB;
    }
    const nuova = prova(tappa, (t) => registraRisultato(t, mg.id, { sa, sb }));

    let vincitore = sqB.nome;
    if (sa > sb) vincitore = sqA.nome;
    const sintesi = `${pulisci(sqA.nome)} ${sa} — ${sb} ${pulisci(sqB.nome)}`;
    return { tappa: nuova, sintesi, testo: `Risultato registrato: ${sintesi}. Vince ${pulisci(vincitore)}.` };
  }

  // --- Risultato della fase a eliminazione diretta ---
  if (matchBracket) {
    const mb = matchBracket;
    const sqA = squadraDellaPartita(tappa, mb.squadraA);
    const sqB = squadraDellaPartita(tappa, mb.squadraB);
    // Allinea i punteggi all'ordine squadraA/squadraB del match (per id)
    let ptA = pB;
    let ptB = pA;
    if (mb.squadraA === richiestaA.id) {
      ptA = pA;
      ptB = pB;
    }
    // tappaOps registra il match e fa avanzare il vincitore al round successivo
    const nuova = prova(tappa, (t) => registraRisultatoBracket(t, mb.id, ptA, ptB));

    let vincitoreId = mb.squadraB;
    if (ptA > ptB) vincitoreId = mb.squadraA;
    const sintesi = `${pulisci(sqA.nome)} ${ptA} — ${ptB} ${pulisci(sqB.nome)}`;
    return { tappa: nuova, sintesi, testo: `${mb.label} registrata: ${sintesi}. Avanza ${pulisci(nomeOf(vincitoreId))}.` };
  }

  throw new Error(`Partita tra "${nomeA}" e "${nomeB}" non trovata o già registrata.`);
}
