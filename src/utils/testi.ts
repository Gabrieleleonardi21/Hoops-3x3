/** Aiuti per i testi dell'interfaccia: i conteggi e le frasi delle finestre di conferma, che dicono che cosa si perde.
 *  I nomi (di leghe, giocatori, squadre) li scrive l'utente: qui restano testo, e la finestra li mostra come testo React,
 *  mai come HTML. */
import type { LegaMeta, RegGiocatore, RegSquadra } from "../types";

/** Avvisi quando il browser rifiuta di scrivere i dati dell'ospite (spazio esaurito o archivio disattivato). Per le modifiche
 *  (barra degli avvisi) ciò che si fa da quel momento resta solo in questa pagina; per una lega nuova, creata o importata, non si
 *  crea niente. La via d'uscita è quella che l'app offre: esportare la lega ed eliminare quelle che non si usano. */
export const SPAZIO_ESAURITO =
  "Spazio esaurito nel browser: le ultime modifiche non sono salvate e andranno perse se chiudi o ricarichi la pagina. "
  + "Esporta la lega («Esporta JSON») ed elimina le leghe che non usi per liberare spazio.";
export const SPAZIO_ESAURITO_LEGA =
  "Spazio esaurito nel browser: la lega non si può salvare. Elimina le leghe che non usi per liberare spazio.";

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
