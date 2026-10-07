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

/** Il JWT non si può scrivere nel browser (spazio esaurito) dopo una registrazione o un accesso riusciti sul server: l'account c'è, ma
 *  senza il JWT la sessione non può esistere, e il modulo d'accesso deve dire perché. */
export const SPAZIO_ESAURITO_ACCESSO =
  SPAZIO_ESAURITO_INIZIO + "non si può salvare l'accesso. Libera spazio (per esempio elimina le leghe dell'ospite che non usi) "
  + "e accedi di nuovo.";

/** La copia del link pubblico negli appunti non è riuscita: gli appunti esistono solo in un contesto sicuro (https o localhost, non
 *  su http in rete locale) e il browser può anche negare il permesso. Il link resta sullo schermo: si copia a mano. */
export const COPIA_LINK_NON_RIUSCITA =
  "Non è stato possibile copiare il link: gli appunti non sono disponibili in questo browser. Selezionalo e copialo a mano.";

/** L'elenco dell'archivio arriva con una forma che l'app non riconosce: succede nei minuti tra l'aggiornamento dell'app e quello del
 *  server, che cambiano la forma dell'elenco in momenti diversi. Compare come motivo sotto «Non è stato possibile caricare
 *  l'archivio», con il «Riprova»: un elenco che non si può leggere non è un elenco vuoto. */
export const ELENCO_ARCHIVIO_NON_VALIDO =
  "Risposta del server non valida: l'elenco delle tappe non ha la forma attesa (il server potrebbe essere in aggiornamento). "
  + "Riprova tra qualche minuto.";

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

/** Eliminare una lega cancella le sue tappe: si dice quante sono (l'elenco delle leghe non carica i risultati) */
export function perditaLega(m: LegaMeta): string {
  if (m.nTappe === 0) return `Verrà eliminata la lega «${m.nome}», che non ha tappe.`;
  return `Verrà eliminata la lega «${m.nome}» con ${conteggio(m.nTappe, "tappa", "tappe")}, squadre e risultati compresi.`;
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
