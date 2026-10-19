/** Identità di squadre e giocatori: la regola unica con cui si riconosce chi è chi. Il modulo è puro e importa solo tipi, così
 *  lo usano le statistiche, il Coach e le pagine senza creare cicli di import. */
import type { RegGiocatore, RegSquadra, SquadraTappa } from "../types";

/** Nome o squadra confrontabili: spazi ai lati tolti, spazi interni ridotti a uno (ma non tolti: «De Rossi» e «DeRossi»
 *  restano diversi), maiuscole e accenti ignorati («Nicolò  Rossi» e «nicolo rossi» sono lo stesso giocatore), apostrofi
 *  tipografici resi come quello semplice («D’Angelo» e «D'Angelo» sono lo stesso giocatore) */
export function normalizza(testo: string): string {
  return testo
    .toLowerCase()
    .normalize("NFD") // separa la lettera dal suo accento («ò» diventa «o» più il segno)
    .replace(/[̀-ͯ]/g, "") // toglie i segni degli accenti
    .replace(/[‘’]/g, "'") // ’ e ‘, che la tastiera del telefono scrive da sola, diventano l'apostrofo semplice
    .replace(/\s+/g, " ") // spazi, tabulazioni e a capo diventano un solo spazio
    .trim();
}

/** Chiave di una squadra di tappa, uguale in tutte le tappe. Se è collegata all'anagrafe conta la voce (regId): due squadre
 *  omonime collegate a voci diverse restano distinte, e la stessa squadra rinominata resta una sola. Se non è collegata conta
 *  il nome normalizzato */
export function identitaSquadra(sq: Pick<SquadraTappa, "regId" | "nome">): string {
  if (sq.regId) return `reg:${sq.regId}`;
  return `nome:${normalizza(sq.nome)}`;
}

/** Il nome completo di un giocatore dell'anagrafe, come si mostra («Mario Rossi») */
export function nomeCompleto(g: Pick<RegGiocatore, "nome" | "cognome">): string {
  return `${g.nome} ${g.cognome}`.trim();
}

/** Vero se `nome` è il nome del giocatore, scritto nell'ordine «nome cognome» o «cognome nome», senza contare maiuscole,
 *  accenti e spazi */
export function stessoNomeGiocatore(nome: string, g: Pick<RegGiocatore, "nome" | "cognome">): boolean {
  const cercato = normalizza(nome);
  return cercato === normalizza(nomeCompleto(g)) || cercato === normalizza(`${g.cognome} ${g.nome}`);
}

/** Gli elementi indicizzati per id: una ricerca per id senza scorrere l'elenco ogni volta */
export function perId<T extends { id: string }>(elementi: T[]): Map<string, T> {
  return new Map(elementi.map((e): [string, T] => [e.id, e]));
}

/** Il giocatore dell'anagrafe a cui attribuire una riga senza regId: il solo del roster della squadra collegata che si chiama
 *  così. Con due omonimi nel roster, o senza squadra collegata, non si sa a chi attribuirla e il risultato è null: la riga
 *  resta per nome. È la regola unica per le righe di tappa vecchie; la usano le statistiche e l'allineamento della tappa */
export function risolviGiocatore(
  nome: string, squadra: RegSquadra | undefined, giocatoriPerId: Map<string, RegGiocatore>,
): RegGiocatore | null {
  if (!squadra) return null;
  const omonimi = squadra.roster.flatMap((id) => {
    const g = giocatoriPerId.get(id);
    return g && stessoNomeGiocatore(nome, g) ? [g] : [];
  });
  const [unico, ...altri] = omonimi;
  if (altri.length > 0 || !unico) return null;
  return unico;
}

/** La squadra dell'anagrafe di un giocatore: quella il cui roster lo contiene; se nessuna, l'unica squadra che si chiama come
 *  la squadra scritta nel giocatore. Con due squadre omonime e nessun roster che lo contenga, undefined */
export function squadraDelGiocatore(g: RegGiocatore, squadre: RegSquadra[]): RegSquadra | undefined {
  const nelRoster = squadre.find((s) => s.roster.includes(g.id));
  if (nelRoster) return nelRoster;
  const nome = normalizza(g.squadra);
  if (!nome) return undefined;
  const [unica, ...altre] = squadre.filter((s) => normalizza(s.nome) === nome);
  if (altre.length > 0) return undefined;
  return unica;
}
