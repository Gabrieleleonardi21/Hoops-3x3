/** Aiuti per i testi dell'interfaccia: i conteggi e le frasi delle finestre di conferma, che dicono che cosa si perde.
 *  I nomi (di leghe, giocatori, squadre) li scrive l'utente: qui restano testo, e la finestra li mostra come testo React,
 *  mai come HTML. */
import type { LegaMeta, RegGiocatore, RegSquadra } from "../types";

/** Il numero con il nome al singolare o al plurale: «1 risultato», «12 risultati» */
export function conteggio(n: number, singolare: string, plurale: string): string {
  if (n === 1) return `1 ${singolare}`;
  return `${n} ${plurale}`;
}

/** Eliminare una lega cancella le sue tappe: si dice quante sono (l'elenco delle leghe non carica i risultati) */
export function perditaLega(m: LegaMeta): string {
  if (m.nTappe === 0) return `Verrà eliminata la lega «${m.nome}», che non ha tappe.`;
  return `Verrà eliminata la lega «${m.nome}» con ${conteggio(m.nTappe, "tappa", "tappe")}, squadre e risultati compresi.`;
}

/** L'anagrafe è condivisa: il giocatore sparisce per tutti, e il server lo toglie anche dai roster */
export function perditaGiocatore(g: RegGiocatore): string {
  return `Verrà eliminato il giocatore «${g.nome} ${g.cognome}» dall'anagrafe condivisa e dai roster delle squadre.`;
}

/** I giocatori del roster sono voci a sé: eliminando la squadra restano registrati */
export function perditaSquadraAnagrafe(s: RegSquadra): string {
  const testo = `Verrà eliminata la squadra «${s.nome}» dall'anagrafe condivisa.`;
  if (!s.roster?.length) return testo;
  return `${testo} I giocatori del roster restano registrati.`;
}
