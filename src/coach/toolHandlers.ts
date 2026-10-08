/** Chi esegue gli strumenti del Coach AI: una funzione per strumento (le definizioni sono in toolDefs.ts), senza React.
 *  Lega, tappe e utente si leggono con useAppStore.getState() nel momento in cui lo strumento agisce: una copia presa prima
 *  è vecchia dopo le attese del modello o dopo gli strumenti precedenti della stessa richiesta. Dall'hook arrivano solo la
 *  navigazione, il segnale della richiesta e la richiesta di conferma (ContestoStrumenti).
 *
 *  Gli strumenti restituiscono il testo per il modello quando l'azione è fatta; quando non si può fare lanciano un errore
 *  con il motivo: askCoachWithTools lo passa al modello come risultato e l'azione non compare tra le eseguite. I nomi letti
 *  dallo store o dall'anagrafe (tappe, squadre) entrano in quei testi solo attraverso pulisci (FC-5): sono scritti dagli
 *  utenti, anche da altri attraverso l'anagrafe condivisa, e un nome non deve diventare un'istruzione. */
import { useAppStore, tappaCorrente } from "../stores/useAppStore";
import { useAnagrafeStore } from "../stores/useAnagrafeStore";
import { anagrafeApi } from "../services/anagrafeApi";
import { testoErrore } from "../services/api";
import { uid } from "../utils/uid";
import { MAX_ROSTER } from "../constants/rules";
import { pulisci, senzaTag } from "../utils/buildCoachContext";
import {
  annullaRisultato, concludi, creaTappa, erroreLimitiTappa, generaFasiDirette, perditaRisultati, registraRisultato,
  registraRisultatoBracket, sorteggia, type Esito, type ModoSorteggio,
} from "../domain/tappaOps";
import type { Tappa, RegSquadra, RegGiocatore, SquadraTappa, GiocatoreRoster } from "../types";
import { squadraDi } from "../utils/tappaInfo";
import { puoModificare } from "../utils/permessi";

/** Ciò che l'hook dà agli strumenti */
export interface ContestoStrumenti {
  /** Apre una pagina dell'app */
  vai: (percorso: string) => void;
  /** Il segnale della richiesta: interrotto se intanto la chat viene cancellata */
  segnale: AbortSignal;
  /** Mostra nel pannello la richiesta di conferma di un'azione distruttiva (D4); true = «Conferma» */
  chiediConferma: (titolo: string, testo: string) => Promise<boolean>;
}

/** Gli argomenti di uno strumento, come li manda il modello */
type Argomenti = Record<string, unknown>;
type Esecutore = (args: Argomenti, ctx: ContestoStrumenti) => string | Promise<string>;

/* ── Lettura degli argomenti ── */

/** Legge un campo stringa dagli argomenti del tool, con fallback a stringa vuota. */
function str(args: Argomenti, key: string): string {
  return typeof args[key] === "string" ? (args[key] as string).trim() : "";
}

/** Testo obbligatorio: se manca o è vuoto lo strumento non agisce (un nome vuoto «corrisponde» a qualsiasi squadra,
 *  e il risultato finirebbe sulla prima partita libera) e il modello sa che cosa manca */
function obbligatorio(args: Argomenti, key: string, cosa: string): string {
  const valore = str(args, key);
  if (!valore) throw new Error(`Manca ${cosa} (${key}).`);
  return valore;
}

/** true se il modello ha passato l'argomento facoltativo (null vale come assente): se c'è va controllato, non ignorato */
function presente(args: Argomenti, key: string): boolean {
  return args[key] !== undefined && args[key] !== null;
}

/** Campo numerico: un numero, oppure un testo che lo contiene ("21"); NaN se manca. Number e non parseInt: "21.5"
 *  resta decimale e tappaOps lo rifiuta, invece di diventare 21 */
function numero(args: Argomenti, key: string): number {
  const valore = args[key];
  if (typeof valore === "number") return valore;
  const testo = str(args, key);
  if (!testo) return NaN;
  return Number(testo);
}

/** Nomi delle squadre di crea_tappa: un elenco di nomi non vuoti (quanti, lo controlla erroreLimitiTappa) */
function nomiSquadre(args: Argomenti): string[] {
  if (!Array.isArray(args.squadre)) throw new Error("Manca l'elenco delle squadre (squadre).");
  const nomi = args.squadre.map((n) => {
    if (typeof n === "string") return n.trim();
    return "";
  });
  if (nomi.some((n) => !n)) throw new Error("Nell'elenco delle squadre c'è un nome vuoto: serve il nome di ogni squadra.");
  return nomi;
}

/** Numero di gironi di crea_tappa: quello indicato (erroreLimitiTappa vuole un intero), altrimenti 2, oppure 1 con meno
 *  di 4 squadre (ogni girone ne vuole almeno 2) */
function gironiRichiesti(args: Argomenti, nSquadre: number): number {
  if (presente(args, "nGironi")) return numero(args, "nGironi");
  if (nSquadre < 4) return 1;
  return 2;
}

/** Modalità di sorteggio: «casuale» se non è indicata. Un valore diverso da casuale o ranking (maiuscole a parte) è un
 *  errore: prima diventava un sorteggio casuale, fatto senza conferma se la tappa non aveva risultati */
function modoSorteggio(args: Argomenti): ModoSorteggio {
  if (!presente(args, "mode")) return "casuale";
  const modo = str(args, "mode").toLowerCase();
  if (modo === "casuale" || modo === "ranking") return modo;
  throw new Error("Modalità di sorteggio non valida: usa «casuale» o «ranking».");
}

/** Squadre per girone che passano alla fase finale: 2 se non è indicato (come l'interfaccia), altrimenti un intero da
 *  1 in su. Prima un valore sbagliato diventava 2 in silenzio, e un tabellone generato non si rigenera */
function qualificateRichieste(args: Argomenti): number {
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
function fermaSeCancellata(segnale: AbortSignal) {
  if (segnale.aborted) throw new Error("La chat è stata cancellata: azione non eseguita.");
}

/** D4: un'azione distruttiva parte solo con «Conferma»; con «Annulla» lo strumento si ferma e il modello lo sa */
async function confermata(ctx: ContestoStrumenti, titolo: string, testo: string) {
  if (await ctx.chiediConferma(titolo, testo)) return;
  throw new Error("L'utente ha annullato: azione non eseguita. Non riprovarla se non te lo chiede di nuovo.");
}

/** La regola con cui un nome dato dal modello sceglie una tappa o una squadra, maiuscole a parte: vince il nome esatto,
 *  altrimenti basta una parte del nome purché corrisponda a un elemento solo. Se ne corrispondono più d'uno è un errore che
 *  li elenca (nomi scritti dagli utenti: passano da pulisci) e chiede il nome completo: scegliere il primo della lista
 *  metterebbe un risultato sulla tappa sbagliata, o una modifica sulla squadra sbagliata dell'anagrafe condivisa, senza che
 *  nessuno se ne accorga. `plurale` completa la frase dell'errore («Più tappe corrispondono a…») */
function trovaPerNome<T>(elementi: T[], nome: string, nomeDi: (e: T) => string, plurale: string): T | null {
  const nl = nome.toLowerCase();
  const esatto = elementi.find((e) => nomeDi(e).toLowerCase() === nl);
  if (esatto) return esatto;
  const simili = elementi.filter((e) => nomeDi(e).toLowerCase().includes(nl));
  if (simili.length > 1) {
    const nomi = simili.map((e) => `"${pulisci(nomeDi(e))}"`).join(", ");
    throw new Error(`Più ${plurale} corrispondono a "${nome}": ${nomi}. Indica il nome completo.`);
  }
  return simili[0] ?? null;
}

/** Trova una tappa per nome (trovaPerNome); se il nome manca restituisce l'ultima. Con «Roma Open» e «Roma Open 2» aperte
 *  insieme, «Roma» è un errore e non la prima delle due (registra_risultato non chiede conferma) */
function findTappa(tappe: Tappa[], nomeTappa?: string): Tappa | null {
  if (!nomeTappa) return tappe.length > 0 ? tappe[tappe.length - 1] : null;
  return trovaPerNome(tappe, nomeTappa, (t) => t.nome, "tappe");
}

/** Come si distingue una squadra da un'omonima: città e autore (scritti da altri utenti: passano da pulisci) */
function descrizione(s: RegSquadra): string {
  const citta = pulisci(s.citta) || "città non indicata";
  return `"${pulisci(s.nome)}" (${citta}, di ${pulisci(s.autore)})`;
}

/** L'errore per più squadre dallo stesso nome esatto: le elenca per città e autore e dice che fare */
function erroreOmonime(omonime: RegSquadra[], cosaFare: string): Error {
  return new Error(`Più squadre in anagrafe si chiamano "${pulisci(omonime[0].nome)}": ${omonime.map(descrizione).join("; ")}. ${cosaFare}`);
}

/** aggiorna_squadra tra più squadre dallo stesso nome esatto: quelle che l'utente di adesso può modificare (le sue, o tutte se è
 *  ADMIN), come sul server. Se ne resta una è quella; se nessuna, l'errore lo dice invece di lasciar arrivare il 403 (e un ADMIN
 *  non modifica per caso la squadra di un altro); se più d'una, non si indovina */
function traLeModificabili(omonime: RegSquadra[]): RegSquadra {
  const { user } = useAppStore.getState();
  const modificabili = omonime.filter((s) => puoModificare(user, s.autoreId));
  if (modificabili.length === 1) return modificabili[0];
  if (modificabili.length === 0) {
    throw erroreOmonime(omonime, "Nessuna è tua: le modifica solo l'autore o un ADMIN, e non ho modificato niente.");
  }
  throw erroreOmonime(modificabili, "Il Coach non sa quale di queste modificare: aprila dalla pagina Anagrafe.");
}

/** crea_tappa (che legge la squadra per collegarla, non la modifica) tra più squadre dallo stesso nome esatto: quella creata
 *  dall'utente di adesso, se è una sola; altrimenti non si indovina. Conta l'autore e non il permesso: un ADMIN può modificarle
 *  tutte, ma questo non dice quale voleva collegare */
function traLeMie(omonime: RegSquadra[]): RegSquadra {
  const { user } = useAppStore.getState();
  const mie = omonime.filter((s) => s.autoreId === user?.id);
  if (mie.length === 1) return mie[0];
  throw erroreOmonime(omonime, "Il Coach non sa quale collegare alla tappa: sistema i doppioni dalla pagina Anagrafe e riprova.");
}

/** Trova una squadra dell'anagrafe condivisa per nome, con la stessa regola delle tappe: con «Roma Kings» elencata prima di
 *  «Roma», chiedere «Roma» sceglie «Roma». In più, l'anagrafe può avere due squadre dallo stesso nome esatto (nessuno lo impedisce):
 *  tra quelle sceglie `traLeOmonime` (traLeModificabili o traLeMie), che restituisce la squadra o lancia l'errore */
function findSquadra(squadre: RegSquadra[], nome: string, traLeOmonime: (omonime: RegSquadra[]) => RegSquadra): RegSquadra | null {
  const omonime = squadre.filter((s) => s.nome.toLowerCase() === nome.toLowerCase());
  if (omonime.length > 1) return traLeOmonime(omonime);
  return trovaPerNome(squadre, nome, (s) => s.nome, "squadre in anagrafe");
}

/** La tappa indicata da `tappa_nome` (o l'ultima, se manca) com'è adesso nello store. Un tappa_nome passato ma non
 *  valido (un numero, un testo vuoto) è un errore: prima diventava «l'ultima tappa» e lo strumento agiva su quella */
function tappaRichiesta(args: Argomenti): Tappa {
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
function prova(tappa: Tappa, operazione: (t: Tappa) => Esito): Tappa {
  const esito = operazione(tappa);
  if (!esito.ok) throw new Error(erroreTappa(tappa, esito.errore));
  return esito.tappa;
}

/** Applica un'operazione di tappaOps alla tappa com'è adesso nello store e salva la nuova versione. La tappa si rilegge
 *  per id: dopo l'attesa di una conferma può essere cambiata. Se non è più nella lega aperta (un'altra lega aperta, la
 *  tappa eliminata) è un errore: replaceTappa la ignorerebbe in silenzio e lo strumento direbbe di esserci riuscito */
function applica(tappa: Tappa, operazione: (t: Tappa) => Esito): Tappa {
  const corrente = tappaCorrente(tappa.id);
  if (!corrente) throw new Error(`La tappa "${pulisci(tappa.nome)}" non è più nella lega aperta: azione non eseguita.`);
  const nuova = prova(corrente, operazione);
  useAppStore.getState().replaceTappa(nuova);
  return nuova;
}

/** Le due squadre della tappa indicate dal modello, trovate per nome con la regola di trovaPerNome (esatto, poi una parte del
 *  nome solo se corrisponde a una squadra sola). Prima bastava che un nome contenesse l'altro: con «Roma», «Roma Nord» e «Milano»
 *  il risultato finiva sulla partita sbagliata o con i punteggi invertiti. Ogni partita poi si cerca e si orienta per id */
function squadreRichieste(tappa: Tappa, nomeA: string, nomeB: string): [SquadraTappa, SquadraTappa] {
  const trova = (nome: string) => {
    const squadra = trovaPerNome(tappa.squadre, nome, (s) => s.nome, "squadre della tappa");
    if (!squadra) throw new Error(`Nessuna squadra della tappa "${pulisci(tappa.nome)}" si chiama "${nome}".`);
    return squadra;
  };
  const a = trova(nomeA);
  const b = trova(nomeB);
  if (a.id === b.id) throw new Error(`"${nomeA}" e "${nomeB}" indicano la stessa squadra, "${pulisci(a.nome)}": servono due squadre diverse.`);
  return [a, b];
}

/** true se la gara è tra le due squadre, in qualunque ordine */
function stessaCoppia(x: string | null, y: string | null, idA: string, idB: string): boolean {
  return (x === idA && y === idB) || (x === idB && y === idA);
}

/** Una squadra di una partita trovata per nome: c'è sempre, perché la ricerca è passata dai nomi delle squadre della tappa. Se manca
 *  la tappa è rovinata, e lo strumento si ferma invece di registrare un risultato a metà */
function squadraDellaPartita(tappa: Tappa, id: string | null): SquadraTappa {
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
async function fetchSquadre(): Promise<RegSquadra[]> {
  return anagrafeApi.listSquadre().catch(anagrafeNonRisponde);
}
async function fetchGiocatori(): Promise<RegGiocatore[]> {
  return anagrafeApi.listGiocatori().catch(anagrafeNonRisponde);
}

/* ── Gli strumenti ── */

async function eseguiCreaLega(args: Argomenti, ctx: ContestoStrumenti): Promise<string> {
  const nomeLega = obbligatorio(args, "nome", "il nome della lega");
  await useAppStore.getState().createLega(nomeLega);
  ctx.vai("/lega");
  return `Lega "${nomeLega}" creata con successo e impostata come attiva.`;
}

async function eseguiCreaTappa(args: Argomenti, ctx: ContestoStrumenti): Promise<string> {
  // Lega e tappe di adesso: comprendono la lega e le tappe create dagli strumenti precedenti della richiesta
  const { legaId, tappe } = useAppStore.getState();
  if (!legaId) throw new Error("Nessuna lega attiva: crea prima una lega prima di aggiungere tappe.");

  const nomeTappa = obbligatorio(args, "nome", "il nome della tappa");
  // Guard: evita che il modello crei duplicati chiamando il tool più volte
  if (tappe.some((t) => t.nome === nomeTappa)) {
    throw new Error(`La tappa "${nomeTappa}" esiste già in questa lega: non ne creo un'altra.`);
  }
  const luogo = str(args, "luogo");
  const data  = str(args, "data");
  // Squadre e gironi con i limiti dell'interfaccia (tappaOps), controllati prima di toccare l'anagrafe: una tappa
  // rifiutata non deve lasciare squadre registrate
  const nomiRichiesti = nomiSquadre(args);
  const nGironi = gironiRichiesti(args, nomiRichiesti.length);
  const limiti = erroreLimitiTappa(nomiRichiesti.length, nGironi, { nome: nomeTappa, luogo, data });
  if (limiti) throw new Error(limiti);

  // Carica anagrafe in parallelo
  const [tutteSquadre, tuttiGiocatori] = await Promise.all([fetchSquadre(), fetchGiocatori()]);
  // Chat cancellata durante la lettura: nessuna squadra registrata nell'anagrafe condivisa per una tappa che non ci sarà
  fermaSeCancellata(ctx.segnale);

  // Prima si abbinano tutti i nomi: se uno corrisponde a più squadre lo strumento si ferma senza aver registrato niente
  const abbinate = nomiRichiesti.map((nome) => ({ nome, trovata: findSquadra(tutteSquadre, nome, traLeMie) }));

  // Le richieste senza squadra in anagrafe si registrano in automatico
  const autoRegistrate: string[] = [];
  const abbinamenti = await Promise.all(
    abbinate.map(async ({ nome: nomeRichiesto, trovata }) => {
      let reg = trovata;

      if (!reg) {
        // Squadra non in anagrafe: la registra con dati minimi (dallo store, così la cache resta allineata)
        reg = await useAnagrafeStore.getState().saveSquadra({
          nome: nomeRichiesto,
          citta: "", anno: "", rank: "", referente: "",
          logo: "", website: "", instagram: "", note: "",
          roster: [],
        });
        autoRegistrate.push(nomeRichiesto);
      }

      // Carica i giocatori del roster dell'anagrafe
      const delRoster: GiocatoreRoster[] = reg.roster
        .map((gId) => {
          const g = tuttiGiocatori.find((x) => x.id === gId);
          return g ? { id: uid(), nome: `${g.nome} ${g.cognome}` } : null;
        })
        .filter((g): g is GiocatoreRoster => g !== null);
      // Al massimo MAX_ROSTER, il tetto che l'interfaccia impone alle squadre di una tappa: gli altri (dopo i primi dell'anagrafe)
      // restano fuori e lo strumento ne dice i nomi, perché chi gioca lo decide l'utente dalla pagina della tappa
      const giocatori = delRoster.slice(0, MAX_ROSTER);

      return {
        squadra: {
          id: uid(),
          nome: reg.nome,
          giocatori,
          rank: reg.rank || "",
          regId: reg.id,
          logo: reg.logo || undefined,
          website: reg.website || undefined,
          instagram: reg.instagram || undefined,
        },
        fuori: delRoster.slice(MAX_ROSTER).map((g) => g.nome),
      };
    })
  );
  const squadreTappa: SquadraTappa[] = abbinamenti.map((a) => a.squadra);
  // Le squadre con giocatori rimasti fuori, nell'ordine in cui sono state richieste
  const tagliate = abbinamenti.filter((a) => a.fuori.length > 0);

  // Chat cancellata durante le registrazioni (già spedite, finiscono comunque): la tappa non va creata
  fermaSeCancellata(ctx.segnale);
  // Oppure l'utente ha aperto un'altra lega: addTappa metterebbe la tappa lì
  if (useAppStore.getState().legaId !== legaId) {
    let motivo = "La lega aperta è cambiata mentre la tappa veniva preparata: tappa non creata.";
    if (autoRegistrate.length) motivo += ` Registrate comunque nell'anagrafe: ${autoRegistrate.join(", ")}.`;
    throw new Error(motivo);
  }

  const esito = creaTappa({ nome: nomeTappa, luogo, data, nGironi, squadre: squadreTappa });
  if (!esito.ok) throw new Error(esito.errore);
  useAppStore.getState().addTappa(esito.tappa);
  ctx.vai(`/lega/tappa/${esito.tappa.id}`);

  const trovate = squadreTappa.length - autoRegistrate.length;
  let msg = `Tappa "${nomeTappa}" creata con ${squadreTappa.length} squadre`;
  if (trovate > 0) msg += `, ${trovate} trovate in anagrafe con i rispettivi giocatori`;
  if (autoRegistrate.length) msg += `. Registrate automaticamente nell'anagrafe: ${autoRegistrate.join(", ")}`;
  msg += ".";
  if (tagliate.length) {
    // «Squadra: giocatore, giocatore» e le squadre separate da «;»: un nome di squadra che finisce con un numero («Roma Open 2»)
    // non si confonde con un conteggio. Nomi dall'anagrafe condivisa, scritti da altri: passano da pulisci
    const elenco = tagliate.map((a) => `${pulisci(a.squadra.nome)}: ${a.fuori.map(pulisci).join(", ")}`).join("; ");
    // Nella pagina della tappa i giocatori si scrivono a mano (RosterEditor): non c'è una scelta dall'anagrafe
    msg += ` Giocatori oltre il massimo di ${MAX_ROSTER} per squadra, rimasti fuori dal roster (tenuti i primi dell'anagrafe): ${elenco}.`;
    msg += " Nella pagina della tappa il roster si cambia a mano: l'utente toglie un giocatore e scrive il nome di chi vuole al suo posto.";
  }
  return msg;
}

/** Stesso nome, maiuscole e spazi ai lati a parte: per riconoscere un doppione nell'anagrafe condivisa */
const stessoNome = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

async function eseguiRegistraSquadra(args: Argomenti, ctx: ContestoStrumenti): Promise<string> {
  // L'anagrafe è condivisa: senza nome niente «Nuova squadra» visibile a tutti
  const nome = obbligatorio(args, "nome", "il nome della squadra");
  // Un modello che ripete la chiamata, o una squadra già registrata da altri, farebbe un doppione visibile a tutti: non si registra
  const omonime = (await fetchSquadre()).filter((s) => stessoNome(s.nome, nome));
  fermaSeCancellata(ctx.segnale);
  if (omonime.length) {
    throw new Error(`In anagrafe c'è già la squadra ${omonime.map(descrizione).join("; ")}: non ne registro un'altra. `
      + "Per cambiarne i dati usa aggiorna_squadra.");
  }
  // Le scritture in anagrafe passano dallo store: aggiornano il server e la cache usata dalle pagine
  await useAnagrafeStore.getState().saveSquadra({
    nome,
    citta:     str(args, "citta"),
    anno:      str(args, "anno"),
    rank:      str(args, "rank"),
    referente: str(args, "referente"),
    logo:      str(args, "logo"),
    website:   str(args, "website"),
    instagram: str(args, "instagram"),
    note:      str(args, "note"),
    roster: [],
  });
  return `Squadra "${nome}" registrata nell'anagrafe.`;
}

async function eseguiRegistraGiocatore(args: Argomenti, ctx: ContestoStrumenti): Promise<string> {
  const nome    = obbligatorio(args, "nome", "il nome del giocatore");
  const cognome = obbligatorio(args, "cognome", "il cognome del giocatore");
  // Come per le squadre: niente doppioni nell'anagrafe condivisa. Un omonimo vero (un'altra persona) si registra dalla pagina Anagrafe
  const omonimi = (await fetchGiocatori()).filter((g) => stessoNome(g.nome, nome) && stessoNome(g.cognome, cognome));
  fermaSeCancellata(ctx.segnale);
  if (omonimi.length) {
    const chi = `"${pulisci(omonimi[0].nome)} ${pulisci(omonimi[0].cognome)}"`;
    throw new Error(`In anagrafe c'è già il giocatore ${chi} (di ${pulisci(omonimi[0].autore)}): non ne registro un altro. `
      + "Se è un'altra persona con lo stesso nome, l'utente può registrarla dalla pagina Anagrafe.");
  }
  await useAnagrafeStore.getState().saveGiocatore({
    nome, cognome,
    soprannome:  str(args, "soprannome"),
    nascita:     str(args, "nascita"),
    citta:       str(args, "citta"),
    nazionalita: str(args, "nazionalita"),
    altezza:     str(args, "altezza"),
    peso:        str(args, "peso"),
    ruolo:       str(args, "ruolo"),
    numero:      str(args, "numero"),
    squadra:     str(args, "squadra"),
    esperienza:  str(args, "esperienza"),
    note:        str(args, "note"),
  });
  return `Giocatore "${nome} ${cognome}" registrato nell'anagrafe.`;
}

async function eseguiSorteggiaGironi(args: Argomenti, ctx: ContestoStrumenti): Promise<string> {
  const modo = modoSorteggio(args);
  const tappa = tappaRichiesta(args);
  const sorteggio = (t: Tappa) => sorteggia(t, modo);
  // D4: con dei risultati registrati il nuovo sorteggio li cancella e decide l'utente; prima però si prova, così
  // una tappa conclusa è rifiutata senza chiedere niente
  const perdita = perditaRisultati(tappa);
  if (perdita) {
    prova(tappa, sorteggio);
    await confermata(ctx, `Rifare il sorteggio di "${tappa.nome}"?`, perdita);
  }
  const nuova = applica(tappa, sorteggio);
  ctx.vai(`/lega/tappa/${tappa.id}`);

  return `Sorteggio "${modo}" completato per "${pulisci(tappa.nome)}": ${(nuova.gironi ?? []).length} gironi, ${nuova.partite.length} partite generate.`;
}

function eseguiRegistraRisultato(args: Argomenti): string {
  // Prima gli argomenti: con un nome vuoto la ricerca troverebbe la prima partita libera
  const nomeA = obbligatorio(args, "squadra_a", "il nome della prima squadra");
  const nomeB = obbligatorio(args, "squadra_b", "il nome della seconda squadra");
  const pA = numero(args, "punti_a");
  const pB = numero(args, "punti_b");

  const tappa = tappaRichiesta(args);
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
    // Tappa letta fresca (getState) e salvata subito, senza await in mezzo: più risultati
    // nello stesso ciclo non si sovrascrivono
    applica(tappa, (t) => registraRisultato(t, mg.id, { sa, sb }));

    let vincitore = sqB.nome;
    if (sa > sb) vincitore = sqA.nome;
    return `Risultato registrato: ${pulisci(sqA.nome)} ${sa} — ${sb} ${pulisci(sqB.nome)}. Vince ${pulisci(vincitore)}.`;
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
    applica(tappa, (t) => registraRisultatoBracket(t, mb.id, ptA, ptB));

    let vincitoreId = mb.squadraB;
    if (ptA > ptB) vincitoreId = mb.squadraA;
    return `${mb.label} registrata: ${pulisci(sqA.nome)} ${ptA} — ${ptB} ${pulisci(sqB.nome)}. Avanza ${pulisci(nomeOf(vincitoreId))}.`;
  }

  throw new Error(`Partita tra "${nomeA}" e "${nomeB}" non trovata o già registrata.`);
}

async function eseguiAnnullaRisultato(args: Argomenti, ctx: ContestoStrumenti): Promise<string> {
  // Prima gli argomenti: con un nome vuoto la ricerca troverebbe la prima partita giocata
  const nomeA = obbligatorio(args, "squadra_a", "il nome della prima squadra");
  const nomeB = obbligatorio(args, "squadra_b", "il nome della seconda squadra");

  const tappa = tappaRichiesta(args);
  if (!tappa.gironi) throw new Error(`La tappa "${pulisci(tappa.nome)}" non è ancora sorteggiata.`);

  // Cerca la partita (già conclusa) tra le due squadre
  const nomeOf = (id: string) => squadraDi(tappa.squadre, id)?.nome ?? "";
  const [richiestaA, richiestaB] = squadreRichieste(tappa, nomeA, nomeB);
  const partita = tappa.partite.find((m) => m.done && stessaCoppia(m.a, m.b, richiestaA.id, richiestaB.id));
  if (!partita) throw new Error(`Partita già conclusa tra "${nomeA}" e "${nomeB}" non trovata nella tappa "${pulisci(tappa.nome)}".`);

  // Le regole sono quelle di «Correggi» (tappaOps): no su una tappa conclusa (R5) né con la fase finale generata da
  // questi risultati (R6); i punteggi restano come bozza e la partita non conta più in classifica. Una partita già
  // da giocare (riaperta nella pagina mentre si aspettava la conferma) non si annulla di nuovo: annullaRisultato
  // darebbe comunque una tappa nuova e partirebbe un salvataggio identico
  const annulla = (t: Tappa): Esito => {
    if (!t.partite.some((m) => m.id === partita.id && m.done)) {
      return { ok: false, errore: `La partita ${pulisci(nomeOf(partita.a))}-${pulisci(nomeOf(partita.b))} è già da giocare: non c'è niente da annullare.` };
    }
    return annullaRisultato(t, partita.id);
  };
  // D4: si prova prima di chiedere, poi decide l'utente. Il titolo non dice «Annullare»: accanto al pulsante
  // «Annulla» si potrebbe premerlo volendo dire «sì, annulla il risultato»
  prova(tappa, annulla);
  await confermata(
    ctx,
    `Togliere il risultato ${nomeOf(partita.a)} ${partita.sa}-${partita.sb} ${nomeOf(partita.b)}?`,
    `La partita di "${tappa.nome}" torna da giocare e non conta più in classifica.`,
  );
  applica(tappa, annulla);
  return `Risultato di "${pulisci(nomeOf(partita.a))}" vs "${pulisci(nomeOf(partita.b))}" annullato: la partita è tornata a non disputata.`;
}

async function eseguiAggiornaSquadra(args: Argomenti, ctx: ContestoStrumenti): Promise<string> {
  const nomeRicerca = obbligatorio(args, "nome", "il nome della squadra da aggiornare");
  const tutteSquadre = await fetchSquadre();
  // Chat cancellata durante la lettura: niente scrittura nell'anagrafe condivisa
  fermaSeCancellata(ctx.segnale);
  const reg = findSquadra(tutteSquadre, nomeRicerca, traLeModificabili);
  if (!reg) throw new Error(`Squadra "${nomeRicerca}" non trovata in anagrafe.`);

  // Aggiorna solo i campi presenti negli argomenti
  const aggiornamenti: Partial<RegSquadra> = {};
  const campi = ["citta", "referente", "logo", "website", "instagram", "anno", "rank", "note"] as const;
  for (const k of campi) {
    const v = str(args, k);
    if (v) aggiornamenti[k] = v;
  }
  if (Object.keys(aggiornamenti).length === 0) throw new Error("Nessun campo da aggiornare specificato.");

  // Dallo store: aggiorna il server e la copia in cache (id, autore e ts li toglie lui)
  await useAnagrafeStore.getState().updateSquadra({ ...reg, ...aggiornamenti });
  const campiModificati = Object.keys(aggiornamenti).join(", ");
  return `Squadra "${pulisci(reg.nome)}" aggiornata in anagrafe (${campiModificati}).`;
}

function eseguiGeneraFasiDirette(args: Argomenti, ctx: ContestoStrumenti): string {
  const nPass = qualificateRichieste(args);
  const tappa = tappaRichiesta(args);

  const nuova = applica(tappa, (t) => generaFasiDirette(t, nPass));
  ctx.vai(`/lega/tappa/${tappa.id}`);
  // I turni superati d'ufficio (bye) non si giocano: non contano tra i match
  const bracket = nuova.bracket ?? [];
  const daGiocare = bracket.filter((m) => !m.bye).length;
  const bye = bracket.length - daGiocare;
  let msg = `Fase a eliminazione diretta generata per "${pulisci(tappa.nome)}": ${daGiocare} match da giocare (prime ${nPass} di ogni girone qualificate`;
  if (bye === 1) msg += "; 1 squadra passa il primo turno senza giocare";
  if (bye > 1) msg += `; ${bye} squadre passano il primo turno senza giocare`;
  return msg + ").";
}

async function eseguiConcludiTappa(args: Argomenti, ctx: ContestoStrumenti): Promise<string> {
  const tappa = tappaRichiesta(args);
  const { user } = useAppStore.getState();
  if (!user || user.guest) throw new Error("La conclusione nell'Archivio circuito richiede un account registrato (non ospite).");

  // Gironi tutti registrati e fase diretta completa (se generata): lo verifica tappaOps, prima di chiedere (D4)
  prova(tappa, concludi);
  await confermata(
    ctx,
    `Concludere "${tappa.nome}"?`,
    "La tappa viene pubblicata nell'Archivio circuito e da lì non si modifica più: per cambiarla andrà riaperta.",
  );
  const conclusa = applica(tappa, concludi);
  try {
    // Come la pagina della tappa: prima la tappa conclusa arriva al server (e parte la rinomina della lega in attesa, che non si
    // controlla: se fallisce la copia porta il nome che il server ha), poi si pubblica per id
    await useAppStore.getState().pubblica(conclusa.id);
    return `Tappa "${pulisci(tappa.nome)}" conclusa e pubblicata nell'Archivio circuito.`;
  } catch (e) {
    // Il motivo può riportare il nome della tappa salvato sul server (un conflitto): passa da senzaTag come ogni nome nel prompt
    const motivo = senzaTag(testoErrore(e));
    // Un conflitto con un altro dispositivo può aver rimesso nello store la tappa del server, non conclusa, o averla tolta (eliminata
    // altrove): allora la conclusione non c'è più, e il Coach non deve dire «conclusa»
    if (!tappaCorrente(conclusa.id)?.conclusa) {
      return `Tappa "${pulisci(tappa.nome)}" non pubblicata, e nella lega aperta ora non risulta conclusa. Motivo: ${motivo}`;
    }
    // Una tappa conclusa non si conclude di nuovo (R5): per ripubblicare va riaperta, come dice anche la pagina
    return `Tappa "${pulisci(tappa.nome)}" conclusa, ma la pubblicazione non è riuscita: per riprovare, nella pagina della tappa usa «Riapri» e poi «Concludi». Motivo: ${motivo}`;
  }
}

/** Il nome dello strumento (come in toolDefs.ts) e chi lo esegue. Una Map e non un oggetto: il nome arriva dal modello, e
 *  «constructor» o «toString» non devono trovare le proprietà che ogni oggetto ha */
const ESECUTORI = new Map<string, Esecutore>([
  ["crea_lega", eseguiCreaLega],
  ["crea_tappa", eseguiCreaTappa],
  ["registra_squadra", eseguiRegistraSquadra],
  ["registra_giocatore", eseguiRegistraGiocatore],
  ["sorteggia_gironi", eseguiSorteggiaGironi],
  ["registra_risultato", eseguiRegistraRisultato],
  ["annulla_risultato", eseguiAnnullaRisultato],
  ["aggiorna_squadra", eseguiAggiornaSquadra],
  ["genera_fasi_dirette", eseguiGeneraFasiDirette],
  ["concludi_tappa", eseguiConcludiTappa],
]);

/** I nomi degli strumenti che hanno un esecutore */
export const NOMI_STRUMENTI: readonly string[] = [...ESECUTORI.keys()];

/** Esegue lo strumento richiesto dal modello e restituisce il testo per il modello; se l'azione non si può fare la
 *  promessa è rifiutata con il motivo, che torna al modello */
export async function eseguiStrumento(nome: string, args: Argomenti, ctx: ContestoStrumenti): Promise<string> {
  const esecutore = ESECUTORI.get(nome);
  if (!esecutore) throw new Error(`Strumento "${nome}" non riconosciuto.`);
  return esecutore(args, ctx);
}
