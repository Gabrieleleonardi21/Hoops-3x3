/** Aiuti per i testi dell'interfaccia: i conteggi e le frasi delle finestre di conferma, che dicono che cosa si perde.
 *  I nomi (di leghe, giocatori, squadre) li scrive l'utente: qui restano testo, e la finestra li mostra come testo React,
 *  mai come HTML. */
import type { LegaMeta, RegGiocatore, RegSquadra } from "../types";

/* Avvisi quando il browser rifiuta di scrivere i dati dell'ospite (spazio esaurito o archivio disattivato). Cominciano tutti
 * allo stesso modo. La via d'uscita è quella che l'app offre: esportare la lega ed eliminare quelle che non si usano.
 *  - SPAZIO_ESAURITO: barra degli avvisi. Una modifica non si è salvata: da quel momento resta solo in questa pagina.
 *  - SPAZIO_ESAURITO_LEGA: una lega nuova, creata o importata, non si salva, quindi non si crea niente.
 *  - SPAZIO_ESAURITO_CAMBIO: aprire, creare o importare un'altra lega sostituirebbe la lega aperta, che ha modifiche non salvate:
 *    non si cambia niente finché non sono salve.
 *  - SPAZIO_ESAURITO_ACCESSO: più sotto, per il modulo d'accesso. */
const SPAZIO_ESAURITO_INIZIO = "Spazio esaurito nel browser: ";
export const SPAZIO_ESAURITO =
  SPAZIO_ESAURITO_INIZIO + "le ultime modifiche non sono salvate e andranno perse se chiudi o ricarichi la pagina. "
  + "Esporta la lega («Esporta JSON») ed elimina le leghe che non usi per liberare spazio.";
export const SPAZIO_ESAURITO_LEGA =
  SPAZIO_ESAURITO_INIZIO + "la lega non si può salvare. Elimina le leghe che non usi per liberare spazio.";
export const SPAZIO_ESAURITO_CAMBIO =
  SPAZIO_ESAURITO_INIZIO + "le modifiche della lega aperta non sono salvate. Esportala («Esporta JSON») o libera spazio, "
  + "eliminando le leghe che non usi, prima di aprirne o crearne un'altra.";

/** Ospite con l'app aperta in due schede: l'altra scheda ha eliminato la lega aperta qui, che quindi si chiude */
export const LEGA_ELIMINATA_IN_ALTRA_SCHEDA = "La lega aperta è stata eliminata in un'altra scheda di questo browser.";
/** Ospite con due schede: l'altra ha salvato la lega aperta mentre qui c'erano modifiche rimaste solo in memoria (spazio esaurito).
 *  Vale la versione salvata dall'altra scheda */
export const LEGA_RILETTA_DA_ALTRA_SCHEDA = "La lega è stata salvata da un'altra scheda di questo browser: questa scheda mostra "
  + "la sua versione, e le modifiche fatte qui che non si erano salvate (spazio esaurito) non ci sono più.";

/** «Esci» dell'ospite mentre la lega aperta ha modifiche che il browser non ha salvato (spazio esaurito, anche con l'avviso chiuso):
 *  esistono solo in questa pagina. Il testo della finestra «Uscire senza salvare?», con la via d'uscita per tenerle */
export const USCITA_OSPITE_NON_SALVATA =
  "Le ultime modifiche della lega aperta non sono salvate nel browser, perché lo spazio è esaurito: uscendo andranno perse. "
  + "Per tenerle, annulla ed esporta la lega («Esporta JSON»).";

/** Il JWT non si può scrivere nel browser (spazio esaurito) dopo una registrazione o un accesso riusciti sul server: l'account c'è, ma
 *  senza il JWT la sessione non può esistere, e il modulo d'accesso deve dire perché. */
export const SPAZIO_ESAURITO_ACCESSO =
  SPAZIO_ESAURITO_INIZIO + "non si può salvare l'accesso. Libera spazio (per esempio elimina le leghe dell'ospite che non usi) "
  + "e accedi di nuovo.";

/** La copia del link pubblico negli appunti non è riuscita: gli appunti esistono solo in un contesto sicuro (https o localhost, non
 *  su http in rete locale) e il browser può anche negare il permesso. Il link resta sullo schermo: si copia a mano. */
export const COPIA_LINK_NON_RIUSCITA =
  "Non è stato possibile copiare il link: gli appunti non sono disponibili in questo browser. Selezionalo e copialo a mano.";

/** L'elenco dell'archivio arriva con una forma che l'app non riconosce. Il testo è neutro perché la causa può essere qualunque
 *  (server e app non allineati, un difetto del server): non promette che passi da solo. Compare come motivo sotto «Non è stato
 *  possibile caricare l'archivio», con il «Riprova»: un elenco che non si può leggere non è un elenco vuoto. */
export const ELENCO_ARCHIVIO_NON_VALIDO = "Risposta del server non valida. Riprova più tardi.";

/** Un campetto, o l'elenco dei campetti, arriva con una forma che l'app non riconosce: stesso testo e stesso uso dell'archivio */
export const RISPOSTA_CAMPETTI_NON_VALIDA = ELENCO_ARCHIVIO_NON_VALIDO;

/** Il numero con il nome al singolare o al plurale: «1 risultato», «12 risultati» */
export function conteggio(n: number, singolare: string, plurale: string): string {
  if (n === 1) return `1 ${singolare}`;
  return `${n} ${plurale}`;
}

/** «Riapri» toglie la tappa dall'Archivio circuito: è l'unica cosa che si perde, la tappa in sé resta com'è. Il testo è fisso e
 *  vale per chi ha un account: l'ospite non pubblica niente. */
export const PERDITA_RIAPERTURA =
  "La tappa uscirà dall'Archivio circuito e il suo link pubblico smetterà di funzionare finché non la concluderai di nuovo. "
  + "Sorteggio e risultati restano.";

/** Avviso sulla pagina di una tappa conclusa che non è (o non è aggiornata) nell'Archivio circuito, con la via d'uscita: per
 *  ripubblicare la tappa va riaperta e conclusa di nuovo. `motivo` è il perché della pubblicazione non riuscita; null = nessun
 *  tentativo fallito, è la verifica con l'archivio a non averla trovata. */
export function tappaNonPubblicata(motivo: string | null): string {
  const uscita = "usa «Riapri» e poi «Concludi».";
  if (!motivo) return `La tappa è conclusa ma non risulta pubblicata nell'Archivio circuito. Per pubblicarla ${uscita}`;
  return `La pubblicazione nell'Archivio circuito non è riuscita. Per riprovare ${uscita} Motivo: ${motivo}`;
}

/** Avviso sulla pagina di una tappa che è in archivio ma la cui ultima ripubblicazione (dopo un video aggiunto o tolto) non è riuscita:
 *  la tappa resta pubblicata, ma la copia pubblica non è aggiornata, e un video tolto resta visibile a tutti finché non lo è. */
export function copiaPubblicaNonAggiornata(motivo: string): string {
  return "La copia pubblica non è aggiornata: l'ultima modifica ai video (un video aggiunto, o uno tolto che resta visibile a tutti) "
    + `non è stata pubblicata. Per aggiornarla usa «Riapri» e poi «Concludi». Motivo: ${motivo}`;
}

/** La pubblicazione non parte: la copia pubblica la costruisce il server da ciò che ha salvato, e l'ultima versione della tappa
 *  non gli è arrivata (rete assente, dati rifiutati). `motivo` è il perché del salvataggio non riuscito, se si sa. */
export function pubblicazioneSenzaSalvataggio(motivo: string | null): string {
  const testo = "Prima di pubblicare, l'ultima versione della tappa deve essere salvata sul server, ma il salvataggio non è riuscito";
  if (!motivo) return `${testo}.`;
  return `${testo}: ${motivo}`;
}

/** Il server ha rifiutato il salvataggio di una tappa (dati non validi). È una frase della riga dei salvataggi rifiutati nella barra
 *  degli avvisi, che dura finché il rifiuto vale (la versione rifiutata è l'ultima della tappa), e dice che cosa fare. Il nome è quello
 *  mandato, che può essere proprio il campo rifiutato (vuoto).
 *  - `aperta` = la tappa è della lega aperta: la versione rifiutata è sullo schermo. Se è di un'altra lega quella versione non è più in
 *    memoria (aprendo l'altra lega lo store l'ha sostituita): la frase nomina la lega e non promette di salvarla.
 *  - `nuova` = la POST di creazione è stata rifiutata: sul server la tappa non c'è. Riaprendo la lega non torna una versione del server,
 *    la tappa sparisce: va corretta; in un'altra lega è già persa.
 *  - altrimenti sul server resta la versione di prima, e riaprendo la lega torna quella. */
export function salvataggioRifiutato(nome: string, motivo: string, lega: string, aperta: boolean, nuova = false): string {
  let genere = "";
  if (nuova) genere = " nuova";
  let tappa = `della tappa${genere} «${nome.trim()}»`;
  if (!nome.trim()) tappa = `di una tappa${genere} senza nome`;
  const perche = motivo.trim().replace(/\.+$/, "");
  if (nuova && aperta) {
    return `Salvataggio ${tappa} non riuscito: ${perche}. Non è ancora sul server: correggila, perché riaprendo la lega «${lega}» `
      + "sparirebbe.";
  }
  if (nuova) {
    return `Salvataggio ${tappa} della lega «${lega}» non riuscito: ${perche}. Non è mai arrivata sul server e quella versione non è `
      + "più qui: è andata persa.";
  }
  if (aperta) {
    return `Salvataggio ${tappa} non riuscito: ${perche}. Correggi la tappa, oppure riapri la lega «${lega}» da «Le mie leghe» `
      + "per tornare alla versione salvata sul server.";
  }
  return `Salvataggio ${tappa} della lega «${lega}» non riuscito: ${perche}. Quella versione non è più qui: aprendo la lega «${lega}» `
    + "trovi quella salvata sul server.";
}

/* Conflitti tra dispositivi sulle tappe (T2.7): un altro dispositivo, o un'altra scheda, ha salvato la stessa tappa. Vale la tappa del
 * server, e la barra degli avvisi sotto l'intestazione lo dice. Il nome è quello della tappa sul server. */

/** Un salvataggio ha trovato sul server una tappa cambiata da un altro dispositivo: ora nello store c'è quella, e le modifiche fatte qui
 *  e non ancora salvate sono state scartate (salvarle avrebbe cancellato il lavoro dell'altro) */
export function tappaModificataAltrove(nome: string): string {
  return `La tappa «${nome}» è stata modificata da un altro dispositivo: ora vedi la versione salvata sul server, `
    + "e le modifiche fatte qui che non erano ancora salvate sono state scartate.";
}

/** Un salvataggio ha trovato la tappa eliminata sul server da un altro dispositivo: la tappa esce anche da qui, e le sue modifiche non
 *  ancora salvate non si possono più salvare */
export function tappaEliminataAltrove(nome: string): string {
  return `La tappa «${nome}» è stata eliminata da un altro dispositivo: non c'è più, e le modifiche fatte qui che non erano ancora `
    + "salvate sono andate perse.";
}

/** Una voce dell'anagrafe (B6) salvata con una versione vecchia: un altro dispositivo l'ha modificata nel frattempo (409). Come per
 *  le tappe vale la voce del server: la scheda esce dalla modifica e la mostra, e ciò che era scritto non è stato salvato (salvarlo
 *  sopra cancellerebbe il lavoro dell'altro). `cosa` è «La squadra» o «Il giocatore»: il participio segue il genere */
export function voceAnagrafeModificataAltrove(cosa: string, nome: string): string {
  let modificata = "è stato modificato";
  if (cosa.startsWith("La")) modificata = "è stata modificata";
  return `${cosa} «${nome}» ${modificata} da un altro dispositivo: la scheda mostra ora la versione salvata sul server. `
    + "Le modifiche scritte qui non sono state salvate: se servono ancora, riscrivile con «Modifica».";
}

/** Un campetto salvato con una versione vecchia: un altro dispositivo l'ha modificato nel frattempo (409). Vale il campetto del server:
 *  l'elenco si ricarica e lo mostra, e ciò che era scritto non è stato salvato (salvarlo sopra cancellerebbe il lavoro dell'altro) */
export function campettoModificatoAltrove(nome: string): string {
  return `Il campetto «${nome}» è stato modificato da un altro dispositivo: l'elenco mostra ora la versione salvata sul server. `
    + "Le modifiche scritte qui non sono state salvate: se servono ancora, riscrivile con «Modifica».";
}

/** I campetti sono condivisi: eliminarne uno lo toglie dalla mappa per tutti */
export function perditaCampetto(nome: string): string {
  return `Verrà eliminato il campetto «${nome}»: sparirà dalla mappa per tutti.`;
}

/** L'eliminazione di una tappa non è riuscita perché un altro dispositivo l'ha salvata nello stesso istante: la tappa resta */
export function eliminazioneTappaInConflitto(nome: string): string {
  return `La tappa «${nome}» non è stata eliminata: un altro dispositivo l'ha modificata nello stesso momento. `
    + "Ora vedi la versione salvata sul server: se vuoi, eliminala di nuovo.";
}

/** Eliminare una lega cancella le sue tappe: si dice quante sono (l'elenco delle leghe non carica i risultati). Per chi ha un
 *  account (`pubblicabili`) le tappe concluse possono essere nell'Archivio circuito, e il server toglie anche le copie pubbliche:
 *  l'elenco non sa quali siano, quindi lo si dice per tutte. L'ospite non pubblica niente. */
export function perditaLega(m: LegaMeta, pubblicabili = false): string {
  if (m.nTappe === 0) return `Verrà eliminata la lega «${m.nome}», che non ha tappe.`;
  const frase = `Verrà eliminata la lega «${m.nome}» con ${conteggio(m.nTappe, "tappa", "tappe")}, squadre e risultati compresi.`;
  if (!pubblicabili) return frase;
  return `${frase} Le tappe pubblicate usciranno dall'Archivio circuito e i loro link pubblici smetteranno di funzionare.`;
}

/** L'anagrafe è condivisa: il giocatore sparisce per tutti, e il server lo toglie anche dai roster in cui c'è. `squadre` è
 *  l'anagrafe delle squadre: si dice da quanti roster sparisce, e se non è in nessuno (o le squadre non si conoscono) non se
 *  ne parla. «Roster» non cambia al plurale. */
export function perditaGiocatore(g: RegGiocatore, squadre: RegSquadra[] = []): string {
  const testo = `Verrà eliminato il giocatore «${g.nome} ${g.cognome}» dall'anagrafe condivisa`;
  const roster = squadre.filter((s) => s.roster?.includes(g.id)).length;
  if (roster === 0) return `${testo}.`;
  return `${testo} e da ${roster} roster.`;
}

/** I giocatori del roster sono voci a sé: eliminando la squadra restano registrati */
export function perditaSquadraAnagrafe(s: RegSquadra): string {
  const testo = `Verrà eliminata la squadra «${s.nome}» dall'anagrafe condivisa.`;
  if (!s.roster?.length) return testo;
  return `${testo} I giocatori del roster restano registrati.`;
}
