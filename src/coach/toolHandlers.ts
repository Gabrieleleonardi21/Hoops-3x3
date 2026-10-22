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
import { testoErrore } from "../services/api";
import { MAX_ROSTER, MAX_TAPPE_LEGA } from "../constants/rules";
import { pulisci, senzaTag } from "../utils/buildCoachContext";
import {
  annullaRisultato, concludi, correggiSquadra, creaTappa, erroreLimitiTappa, generaFasiDirette, nomeTappaLibero, perditaRisultati, sorteggia,
  type CorrezioneSquadra, type Esito, type ModoSorteggio,
} from "../domain/tappaOps";
import type { RegSquadra, SquadraTappa, Tappa } from "../types";
import { squadraDi } from "../utils/tappaInfo";
import { puoModificare } from "../utils/permessi";
import { normalizza } from "../utils/identita";
import { dettagliSquadraAnagrafe, separaDettaglio } from "../utils/ricercaPerNome";
import { eseguiCreaTappaSimulata, eseguiRegistraRisultati, eseguiSimulaRisultati } from "./toolHandlersSimulazione";
import {
  applica, chiaveCreato, confermaTappaOmonima, confermata, CONFERMA_VOCE_OMONIMA, ERRORE_NESSUNA_LEGA, erroreGiocatoreRipetuto,
  erroreLimiteTappe, erroreSquadraRipetuta, erroreTappaDuplicata, etichettaSquadra, etichettaTappa, fermaSeCancellata, fetchGiocatori, fetchSquadre, gironiRichiesti, nomiRoster, nomiSquadre, obbligatorio, presente,
  prova, qualificateRichieste, registraUnaRiga, squadraDellaPartita, squadraRichiesta, squadraRipetuta, squadraTappaDaAnagrafe,
  squadreRichieste, stessaCoppia, str, tappaRichiesta, trovaPerNome, type Argomenti, type ContestoStrumenti,
} from "./strumentiComuni";

// ContestoStrumenti sta in strumentiComuni.ts, dove lo usano anche gli strumenti in altri file: qui si ri-esporta perché chi lo importa da toolHandlers non cambi
export type { ContestoStrumenti } from "./strumentiComuni";


/** Gli argomenti di uno strumento, come li manda il modello */
type Esecutore = (args: Argomenti, ctx: ContestoStrumenti) => string | Promise<string>;



/** Modalità di sorteggio: «casuale» se non è indicata. Un valore diverso da casuale o ranking (maiuscole a parte) è un
 *  errore: prima diventava un sorteggio casuale, fatto senza conferma se la tappa non aveva risultati */
function modoSorteggio(args: Argomenti): ModoSorteggio {
  if (!presente(args, "mode")) return "casuale";
  const modo = str(args, "mode").toLowerCase();
  if (modo === "casuale" || modo === "ranking") return modo;
  throw new Error("Modalità di sorteggio non valida: usa «casuale» o «ranking».");
}



/** Come si distingue una squadra da un'omonima: città e autore. È la stessa frase della simulazione (dettagliSquadraAnagrafe) */
const descrizione = dettagliSquadraAnagrafe.descrivi;

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
 *  tra quelle sceglie `traLeOmonime` (traLeModificabili o traLeMie), che restituisce la squadra o lancia l'errore. Con un dettaglio
 *  tra parentesi («Roma (Torino)», «Roma (di Gabriele)») sceglie tra le omonime per città o autore, se il nome intero non è una squadra */
function findSquadra(squadre: RegSquadra[], nome: string, traLeOmonime: (omonime: RegSquadra[]) => RegSquadra): RegSquadra | null {
  const { base, dettaglio } = separaDettaglio(nome);
  const literale = squadre.some((s) => normalizza(s.nome) === normalizza(nome));
  if (dettaglio !== null && !literale) {
    const cercato = normalizza(dettaglio);
    const omonimeDiBase = squadre.filter((s) => normalizza(s.nome) === normalizza(base));
    const conDettaglio = (corrisponde: (d: string) => boolean) =>
      omonimeDiBase.filter((s) => dettagliSquadraAnagrafe.descrittori(s).some((d) => corrisponde(normalizza(d))));
    // Prima il descrittore uguale al dettaglio («Bari» non prende «Bari Vecchia», «di Anna» non prende «di Annalisa»), poi la parte
    let scelte = conDettaglio((d) => d === cercato);
    if (scelte.length === 0) scelte = conDettaglio((d) => d.includes(cercato));
    if (scelte.length === 1) return scelte[0];
    if (scelte.length > 1) return traLeOmonime(scelte);
    // Ci sono omonime ma il dettaglio non ne sceglie nessuna: non si registra una squadra nuova con lo stesso nome, si elencano le opzioni
    if (omonimeDiBase.length > 0) {
      const opzioni = omonimeDiBase.map(descrizione).join("; ");
      throw new Error(`Nessuna "${pulisci(base)}" corrisponde a "(${pulisci(dettaglio)})": le opzioni sono ${opzioni}.`);
    }
    // Nessuna squadra con quel nome: un nome nuovo, come lo era prima del dettaglio (crea_tappa la registra)
    return null;
  }
  const omonime = squadre.filter((s) => normalizza(s.nome) === normalizza(nome));
  if (omonime.length > 1) return traLeOmonime(omonime);
  return trovaPerNome(squadre, nome, (s) => s.nome, "squadre in anagrafe");
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
  if (!legaId) throw new Error(ERRORE_NESSUNA_LEGA);
  // Il limite del server si controlla prima di toccare l'anagrafe: una tappa rifiutata non lascia squadre registrate
  if (tappe.length >= MAX_TAPPE_LEGA) throw new Error(erroreLimiteTappe());

  // Senza nome, «Tappa N» con il primo numero libero: la stessa regola del form della lega
  const nomeTappa = str(args, "nome") || nomeTappaLibero(tappe);
  // Guard: evita che il modello crei duplicati chiamando il tool più volte nella stessa richiesta
  if (ctx.creati?.has(chiaveCreato("tappa", nomeTappa))) throw new Error(erroreTappaDuplicata(nomeTappa));
  const luogo = str(args, "luogo");
  const data  = str(args, "data");
  // Squadre e gironi con i limiti dell'interfaccia (tappaOps), controllati prima di toccare l'anagrafe: una tappa
  // rifiutata non deve lasciare squadre registrate
  const nomiRichiesti = nomiSquadre(args);
  const ripetuta = squadraRipetuta(nomiRichiesti);
  if (ripetuta) throw new Error(`"${pulisci(ripetuta)}" compare due volte nell'elenco delle squadre.`);
  const nGironi = gironiRichiesti(args, nomiRichiesti.length);
  const limiti = erroreLimitiTappa(nomiRichiesti.length, nGironi, { nome: nomeTappa, luogo, data });
  if (limiti) throw new Error(limiti);
  // Una tappa con lo stesso nome di una della lega: si crea solo se l'utente conferma (D3)
  await confermaTappaOmonima(nomeTappa, tappe, ctx);

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
        // Anche questa squadra è registrata in questa richiesta: registra_squadra non la registra di nuovo
        ctx.creati?.add(chiaveCreato("squadra", nomeRichiesto));
      }

      // Oltre il tetto restano fuori (dopo i primi dell'anagrafe): lo strumento ne dice i nomi, perché chi gioca lo decide
      // l'utente dalla pagina della tappa
      return {
        squadra: squadraTappaDaAnagrafe(reg, tuttiGiocatori),
        fuori: nomiRoster(reg, tuttiGiocatori).slice(MAX_ROSTER),
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
  ctx.creati?.add(chiaveCreato("tappa", nomeTappa));
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

/** Stesso nome per il doppione nell'anagrafe condivisa: maiuscole, accenti e spazi non contano (la stessa regola di `creati`) */
const stessoNome = (a: string, b: string) => normalizza(a) === normalizza(b);

async function eseguiRegistraSquadra(args: Argomenti, ctx: ContestoStrumenti): Promise<string> {
  // L'anagrafe è condivisa: senza nome niente «Nuova squadra» visibile a tutti
  const nome = obbligatorio(args, "nome", "il nome della squadra");
  // Già registrata in questa richiesta (anche con altre maiuscole): è il modello che la ripete, e si ferma prima di leggere l'anagrafe
  // o chiedere conferma, perché la conferma è per un omonimo di altri, non per una ripetizione
  if (ctx.creati?.has(chiaveCreato("squadra", nome))) throw new Error(erroreSquadraRipetuta(nome));
  // Un modello che ripete la chiamata, o una squadra già registrata da altri, farebbe un doppione visibile a tutti: non si registra
  const omonime = (await fetchSquadre()).filter((s) => stessoNome(s.nome, nome));
  fermaSeCancellata(ctx.segnale);
  // Due squadre con lo stesso nome sono permesse (D3): se ce n'è già una si registra solo con la conferma dell'utente
  if (omonime.length) {
    const elenco = omonime.map((s) => `la squadra ${descrizione(s)}`).join("; ");
    await confermata(ctx, "Nome già registrato", CONFERMA_VOCE_OMONIMA(elenco, "un'altra"));
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
  ctx.creati?.add(chiaveCreato("squadra", nome));
  return `Squadra "${nome}" registrata nell'anagrafe.`;
}

async function eseguiRegistraGiocatore(args: Argomenti, ctx: ContestoStrumenti): Promise<string> {
  const nome    = obbligatorio(args, "nome", "il nome del giocatore");
  const cognome = obbligatorio(args, "cognome", "il cognome del giocatore");
  // Come per le squadre: già registrato in questa richiesta è un errore, prima di leggere l'anagrafe o chiedere conferma
  if (ctx.creati?.has(chiaveCreato("giocatore", `${nome} ${cognome}`))) throw new Error(erroreGiocatoreRipetuto(nome, cognome));
  // Come per le squadre: niente doppioni nell'anagrafe condivisa. Un omonimo vero (un'altra persona) si registra dalla pagina Anagrafe
  const omonimi = (await fetchGiocatori()).filter((g) => stessoNome(g.nome, nome) && stessoNome(g.cognome, cognome));
  fermaSeCancellata(ctx.segnale);
  // Come per le squadre: un omonimo si registra solo se l'utente lo conferma (un'altra persona con lo stesso nome è possibile)
  if (omonimi.length) {
    const elenco = omonimi.map((g) => `il giocatore "${pulisci(g.nome)} ${pulisci(g.cognome)}" (di ${pulisci(g.autore)})`).join("; ");
    await confermata(ctx, "Nome già registrato", CONFERMA_VOCE_OMONIMA(elenco, "un altro"));
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
  ctx.creati?.add(chiaveCreato("giocatore", `${nome} ${cognome}`));
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
    await confermata(ctx, `Rifare il sorteggio di ${etichettaTappa(tappa, useAppStore.getState().tappe)}?`, perdita);
  }
  const nuova = applica(tappa, sorteggio);
  ctx.vai(`/lega/tappa/${tappa.id}`);

  return `Sorteggio "${modo}" completato per "${pulisci(tappa.nome)}": ${(nuova.gironi ?? []).length} gironi, ${nuova.partite.length} partite generate.`;
}

/** registra_risultato: una partita. La riga si calcola sulla tappa letta dallo store nel momento in cui si salva (applica),
 *  così il risultato non finisce su una copia vecchia */
function eseguiRegistraRisultato(args: Argomenti): string {
  const tappa = tappaRichiesta(args);
  let testo = "";
  applica(tappa, (t) => {
    const riga = registraUnaRiga(t, args);
    testo = riga.testo;
    return { ok: true, tappa: riga.tappa };
  });
  return testo;
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
  // Le squadre e la tappa si nominano con il dettaglio quando sono omonime: la conferma dice quale
  const etichettaDi = (id: string) => {
    const squadra = squadraDi(tappa.squadre, id);
    if (!squadra) return "";
    return etichettaSquadra(tappa, squadra);
  };
  await confermata(
    ctx,
    `Togliere il risultato ${etichettaDi(partita.a)} ${partita.sa}-${partita.sb} ${etichettaDi(partita.b)}?`,
    `La partita di ${etichettaTappa(tappa, useAppStore.getState().tappe)} torna da giocare e non conta più in classifica.`,
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

/** correggi_squadra: nome e/o giocatori di una squadra della tappa, con le regole di correggiSquadra (tappaOps). Non distrugge
 *  risultati, quindi senza conferma (D4). I giocatori arrivano come elenco di nomi: un testo da solo è un errore, non un nome */
function eseguiCorreggiSquadra(args: Argomenti): string {
  const nome = obbligatorio(args, "squadra", "il nome attuale della squadra");
  const modifiche: CorrezioneSquadra = {};
  if (presente(args, "nuovo_nome")) modifiche.nome = str(args, "nuovo_nome");
  if (presente(args, "giocatori")) {
    if (!Array.isArray(args.giocatori)) throw new Error("I giocatori (giocatori) vanno dati come elenco di nomi.");
    modifiche.giocatori = args.giocatori.map((g) => {
      if (typeof g === "string") return g;
      return "";
    });
  }
  const tappa = tappaRichiesta(args);
  const squadra = squadraRichiesta(tappa, nome);
  const nuova = applica(tappa, (t) => correggiSquadra(t, squadra.id, modifiche));
  const corretta = squadraDellaPartita(nuova, squadra.id);
  let giocatori = "nessun giocatore";
  if (corretta.giocatori.length) giocatori = `giocatori ${corretta.giocatori.map((g) => pulisci(g.nome)).join(", ")}`;
  return `Squadra «${pulisci(squadra.nome)}» corretta: nome ${pulisci(corretta.nome)}, ${giocatori}.`;
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
    `Concludere ${etichettaTappa(tappa, useAppStore.getState().tappe)}?`,
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
  ["correggi_squadra", eseguiCorreggiSquadra],
  ["genera_fasi_dirette", eseguiGeneraFasiDirette],
  ["concludi_tappa", eseguiConcludiTappa],
  ["crea_tappa_simulata", eseguiCreaTappaSimulata],
  ["simula_risultati", eseguiSimulaRisultati],
  ["registra_risultati", eseguiRegistraRisultati],
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
