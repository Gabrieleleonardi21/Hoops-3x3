/** Gli strumenti del Coach per le tappe di prova: crea_tappa_simulata (una tappa nuova, giocata fino alla finale), simula_risultati
 *  (le gare mancanti di una tappa, con conferma) e registra_risultati (più risultati dettati in un colpo). I numeri li genera
 *  domain/simulazione: il modello non li vede mai. Le squadre si leggono dall'anagrafe e non vi si scrive niente.
 *  Le funzioni condivise con gli altri strumenti stanno in strumentiComuni.ts (non in toolHandlers.ts, per non creare un ciclo). */
import { useAppStore } from "../stores/useAppStore";
import { MAX_RISULTATI, MAX_TAPPE_LEGA } from "../constants/rules";
import { pulisci, senzaTag } from "../utils/buildCoachContext";
import { conteggio } from "../utils/testi";
import { squadraDi } from "../utils/tappaInfo";
import { creaTappa, nomeTappaLibero, sorteggia, type ModoSorteggio } from "../domain/tappaOps";
import {
  riepilogoSimulazione, scegliSquadre, simulaTappa, type OpzioniSimulazione,
} from "../domain/simulazione";
import type { Tappa } from "../types";
import {
  applica, chiaveCreato, confermaTappaOmonima, confermata, ERRORE_NESSUNA_LEGA, erroreLimiteTappe, erroreTappaDuplicata, etichettaTappa, fermaSeCancellata, fetchGiocatori,
  fetchSquadre, gironiRichiesti, nomiSquadre,
  numero, presente, qualificateRichieste, registraUnaRiga, squadraTappaDaAnagrafe, str, tappaRichiesta,
  type Argomenti, type ContestoStrumenti,
} from "./strumentiComuni";

/** Squadre di una tappa di prova se il modello non dice quante */
const SQUADRE_DI_DEFAULT = 8;
/** Il motivo di un errore lanciato da uno strumento: il suo messaggio, o il testo se non è un Error */
function motivoDi(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Un interruttore facoltativo, vero di default: il modello lo passa come booleano, e un valore diverso da false (o «false») è vero */
function interruttore(args: Argomenti, key: string): boolean {
  if (!presente(args, key)) return true;
  return args[key] !== false && args[key] !== "false";
}

/** Fino a dove giocare una tappa di prova: «finale» (default: tutto il tabellone) o «gironi» */
function faseFinoA(args: Argomenti): OpzioniSimulazione["fase"] {
  if (!presente(args, "fino_a")) return "tutto";
  const valore = str(args, "fino_a").toLowerCase();
  if (valore === "finale") return "tutto";
  if (valore === "gironi") return "gironi";
  throw new Error(`Fino a dove giocare non valido («${pulisci(valore)}»): usa «finale» oppure «gironi».`);
}

/** Che cosa giocare in simula_risultati: «tutto» (default), «gironi» o «finale» */
function faseSimulata(args: Argomenti): OpzioniSimulazione["fase"] {
  if (!presente(args, "fase")) return "tutto";
  const valore = str(args, "fase").toLowerCase();
  if (valore === "tutto" || valore === "gironi" || valore === "finale") return valore;
  throw new Error(`Fase non valida («${pulisci(valore)}»): usa «tutto», «gironi» oppure «finale».`);
}

/** Come si scelgono le squadre di una tappa di prova: «casuale» (default), «ranking» o «citta» */
function criterioScelta(args: Argomenti): "casuale" | "ranking" | "citta" {
  if (!presente(args, "scelta")) return "casuale";
  const valore = str(args, "scelta").toLowerCase();
  if (valore === "casuale" || valore === "ranking" || valore === "citta") return valore;
  throw new Error(`Criterio di scelta non valido («${pulisci(valore)}»): usa «casuale», «ranking» oppure «citta».`);
}

/** Il testo della conferma di simula_risultati (D4): dice quante gare si inventano e che i numeri sono di prova, non veri.
 *  `etichetta` è la tappa nominata come in etichettaTappa (tra virgolette, con data e luogo se è omonima) */
function testoConfermaSimulazione(etichetta: string, gare: number): string {
  let cosa = `delle ${gare} gare mancanti`;
  if (gare === 1) cosa = "della gara mancante";
  return `Inventare i risultati ${cosa} di ${etichetta}? Sono numeri di prova, non veri.`;
}

/** Le righe di registra_risultati: un elenco da 1 a MAX_RISULTATI oggetti, come gli argomenti di registra_risultato */
function elencoRisultati(args: Argomenti): Argomenti[] {
  if (!Array.isArray(args.risultati)) throw new Error("Manca l'elenco dei risultati (risultati).");
  if (args.risultati.length < 1 || args.risultati.length > MAX_RISULTATI) {
    throw new Error(`L'elenco dei risultati va da 1 a ${MAX_RISULTATI} voci.`);
  }
  return args.risultati.map((riga) => {
    if (typeof riga !== "object" || riga === null || Array.isArray(riga)) {
      throw new Error("Ogni risultato è un oggetto con squadra_a, punti_a, squadra_b e punti_b.");
    }
    return riga as Argomenti;
  });
}

/** Le gare che mancano in una tappa, come «Alfa-Delta»: quelle dei gironi, e quelle del tabellone con le due squadre già note */
function gareMancanti(t: Tappa): string[] {
  const nomeDi = (id: string | null) => pulisci(squadraDi(t.squadre, id)?.nome ?? "");
  const deiGironi = t.partite.filter((m) => !m.done).map((m) => `${nomeDi(m.a)}-${nomeDi(m.b)}`);
  const delTabellone = (t.bracket ?? [])
    .filter((m) => !m.done && m.squadraA !== null && m.squadraB !== null)
    .map((m) => `${nomeDi(m.squadraA)}-${nomeDi(m.squadraB)}`);
  return [...deiGironi, ...delTabellone];
}

/** crea_tappa_simulata: una tappa di prova con squadre dall'anagrafe (solo quelle con il roster), sorteggiata e giocata con i tabellini
 *  fino alla finale. Tutto si costruisce in memoria e si salva con una sola addTappa: una tappa rifiutata non lascia niente in giro,
 *  e l'anagrafe non si tocca (le squadre si scelgono, non si registrano) */
export async function eseguiCreaTappaSimulata(args: Argomenti, ctx: ContestoStrumenti): Promise<string> {
  const { legaId, tappe } = useAppStore.getState();
  if (!legaId) throw new Error(ERRORE_NESSUNA_LEGA);
  if (tappe.length >= MAX_TAPPE_LEGA) throw new Error(erroreLimiteTappe());

  // Senza nome, «Tappa N» con il primo numero libero, come in crea_tappa
  const nome = str(args, "nome") || nomeTappaLibero(tappe);
  if (ctx.creati?.has(chiaveCreato("tappa", nome))) throw new Error(erroreTappaDuplicata(nome));
  const luogo = str(args, "luogo");
  const data = str(args, "data");
  let nSquadre = SQUADRE_DI_DEFAULT;
  if (presente(args, "nSquadre")) nSquadre = numero(args, "nSquadre");
  const nGironi = gironiRichiesti(args, nSquadre);
  const criterio = criterioScelta(args);
  const obbligatorie: string[] = [];
  if (presente(args, "squadre")) obbligatorie.push(...nomiSquadre(args));
  const fase = faseFinoA(args);
  const opzioni: OpzioniSimulazione = { fase, tabellini: interruttore(args, "tabellini"), qualificate: qualificateRichieste(args) };
  // Una tappa con lo stesso nome di una della lega: si crea solo se l'utente conferma (D3). La conferma viene dopo gli argomenti
  // (come in crea_tappa): con un argomento sbagliato l'errore arriva al modello, senza chiedere niente all'utente
  await confermaTappaOmonima(nome, tappe, ctx);

  // Squadre e giocatori dall'anagrafe, in sola lettura: se la lettura fallisce o la chat si cancella, non si crea niente
  const [tutteSquadre, tuttiGiocatori] = await Promise.all([fetchSquadre(), fetchGiocatori()]);
  fermaSeCancellata(ctx.segnale);

  const scelta = scegliSquadre(tutteSquadre, tuttiGiocatori, { n: nSquadre, modo: criterio, citta: str(args, "citta"), obbligatorie });
  if (!scelta.ok) throw new Error(scelta.errore);
  const squadre = scelta.squadre.map((reg) => squadraTappaDaAnagrafe(reg, tuttiGiocatori));

  // Il sorteggio per ranking se è stato chiesto; per città e casuale, il casuale
  let modo: ModoSorteggio = "casuale";
  if (criterio === "ranking") modo = "ranking";
  const creata = creaTappa({ nome, luogo, data, nGironi, squadre });
  if (!creata.ok) throw new Error(creata.errore);
  const sorteggiata = sorteggia(creata.tappa, modo);
  if (!sorteggiata.ok) throw new Error(sorteggiata.errore);
  const simulata = simulaTappa(sorteggiata.tappa, opzioni);
  if (!simulata.ok) throw new Error(simulata.errore);

  // Chat cancellata o lega cambiata durante le letture: la tappa non va creata nella lega di adesso
  fermaSeCancellata(ctx.segnale);
  if (useAppStore.getState().legaId !== legaId) {
    throw new Error("La lega aperta è cambiata mentre la tappa veniva preparata: tappa non creata.");
  }
  useAppStore.getState().addTappa(simulata.tappa);
  ctx.creati?.add(chiaveCreato("tappa", nome));
  ctx.vai(`/lega/tappa/${simulata.tappa.id}`);

  // I nomi delle squadre vengono dall'anagrafe condivisa (scritti da altri): senzaTag su tutto il testo, che è lungo
  const riepilogo = riepilogoSimulazione(nome, simulata.rapporto, {
    squadre: squadre.map((s) => s.nome), nuova: true, tabellini: opzioni.tabellini,
  });
  return senzaTag(riepilogo);
}

/** simula_risultati: inventa i risultati delle gare mancanti di una tappa, con conferma. La conferma c'è sempre (D4), anche per una
 *  tappa di prova: un «registra i risultati» capito male non deve riempire di numeri finti una tappa vera. Prima si prova (errori e
 *  numero di gare), poi la conferma, poi si gioca sulla tappa letta dallo store: una sola replaceTappa */
export async function eseguiSimulaRisultati(args: Argomenti, ctx: ContestoStrumenti): Promise<string> {
  const tappa = tappaRichiesta(args);
  const opzioni: OpzioniSimulazione = {
    fase: faseSimulata(args), tabellini: interruttore(args, "tabellini"), qualificate: qualificateRichieste(args),
  };
  // Errori come «è conclusa» o «non è ancora sorteggiata» si dicono subito, senza chiedere niente
  const provata = simulaTappa(tappa, opzioni);
  if (!provata.ok) throw new Error(provata.errore);
  const gare = provata.rapporto.gareGironi + provata.rapporto.gareTabellone;
  const etichetta = etichettaTappa(tappa, useAppStore.getState().tappe);
  await confermata(ctx, `Simulare i risultati di ${etichetta}?`, testoConfermaSimulazione(etichetta, gare));

  let testo = "";
  applica(tappa, (t) => {
    const simulata = simulaTappa(t, opzioni);
    if (!simulata.ok) return simulata;
    testo = riepilogoSimulazione(pulisci(tappa.nome), simulata.rapporto, { nuova: false, tabellini: opzioni.tabellini });
    return simulata;
  });
  ctx.vai(`/lega/tappa/${tappa.id}`);
  return senzaTag(testo);
}

/** registra_risultati: più risultati dettati in un colpo. Ogni riga è un registra_risultato. Le righe valide si applicano in fila sulla
 *  tappa e la tappa si salva una volta sola; le altre restano fuori, e il testo dice quali (con il numero di riga), perché, e che cosa manca.
 *  Senza conferma (D4): come il singolo risultato, si registra quello che l'utente ha scritto */
export function eseguiRegistraRisultati(args: Argomenti): string {
  const righe = elencoRisultati(args);
  const tappa = tappaRichiesta(args);
  const registrati: string[] = [];
  const errori: string[] = [];

  const nuova = applica(tappa, (t) => {
    let corrente = t;
    for (const [i, riga] of righe.entries()) {
      try {
        const esito = registraUnaRiga(corrente, riga);
        corrente = esito.tappa;
        registrati.push(esito.sintesi);
      } catch (e) {
        // Il motivo finisce con un punto: lo si toglie, perché la lista di errori ha già i suoi separatori
        const motivo = motivoDi(e).replace(/\.$/, "");
        errori.push(`riga ${i + 1} (${str(riga, "squadra_a")}-${str(riga, "squadra_b")}): ${motivo}`);
      }
    }
    // Nessuna riga valida: niente da salvare, e l'errore con i motivi torna al modello (applica lo prefissa con il nome della tappa)
    if (registrati.length === 0) return { ok: false, errore: errori.join("; ") };
    return { ok: true, tappa: corrente };
  });

  let testo = `Registrati ${conteggio(registrati.length, "risultato", "risultati")}: ${registrati.join("; ")}.`;
  if (errori.length) testo += ` Errori: ${errori.join("; ")}.`;
  const mancanti = gareMancanti(nuova);
  if (mancanti.length) testo += ` Mancano: ${mancanti.join(", ")}.`;
  return senzaTag(testo);
}
