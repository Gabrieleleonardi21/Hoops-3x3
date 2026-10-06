/** Statistiche dei giocatori aggregate su più tappe. Il roster di tappa non è collegato all'anagrafe e gli id dei giocatori
 *  si generano a ogni tappa: lo stesso giocatore in due tappe ha due id. Per riconoscerlo si usano il nome e la squadra,
 *  normalizzati. È l'unica aggregazione di stagione: la usano la tabella «Statistiche stagione» e la pagina del giocatore,
 *  così i loro numeri coincidono. */
import type { Partita, StatLine, Tappa } from "../types";
import { STAT_KEYS } from "../constants/rules";

/** Nome o squadra confrontabili: spazi ai lati tolti, spazi interni ridotti a uno (ma non tolti: «De Rossi» e «DeRossi»
 *  restano diversi), maiuscole e accenti ignorati («Nicolò  Rossi» e «nicolo rossi» sono lo stesso giocatore), apostrofi
 *  tipografici resi come quello semplice («D’Angelo» e «D'Angelo» sono lo stesso giocatore) */
export function normalizza(testo: string): string {
  return testo
    .toLowerCase()
    .normalize("NFD") // separa la lettera dal suo accento («ò» diventa «o» più il segno)
    .replace(/[\u0300-\u036f]/g, "") // toglie i segni degli accenti
    .replace(/[\u2018\u2019]/g, "'") // ’ e ‘, che la tastiera del telefono scrive da sola, diventano l'apostrofo semplice
    .replace(/\s+/g, " ") // spazi, tabulazioni e a capo diventano un solo spazio
    .trim();
}

/** Le sette statistiche di un giocatore in numeri, mai mancanti */
type Conteggi = Record<keyof StatLine, number>;

/** Un valore mancante o non numerico vale 0 */
const numero = (valore: unknown) => Number(valore) || 0;

/** Il tabellino di un giocatore in una partita, in numeri. Il formato vecchio è un numero: i soli punti */
function conteggi(raw: StatLine | number): Conteggi {
  let stat: StatLine = { pt: raw as number };
  if (typeof raw === "object" && raw !== null) stat = raw;
  return {
    pt: numero(stat.pt), rb: numero(stat.rb), as: numero(stat.as), ru: numero(stat.ru),
    st: numero(stat.st), pe: numero(stat.pe), fa: numero(stat.fa),
  };
}

/** Il tabellino di un giocatore in una partita giocata, con nome e squadra come sono scritti nel roster della tappa, la
 *  partita e il lato (squadra A o B) della scheda in cui è scritto. Il lato è quello della scheda, non quello del roster:
 *  il tabellino conta dove sta scritto */
export interface Tabellino { pid: string; nome: string; squadra: string; stat: Conteggi; partita: Partita; lato: "a" | "b" }

/** I tabellini di tutte le partite giocate di una tappa, nell'ordine delle partite (in ognuna prima la squadra A).
 *  È la regola delle statistiche dei giocatori: conta ogni partita giocata (`done`), anche se è finita in parità, perché
 *  i punti dei giocatori non dipendono dal vincitore (la classifica invece la ignora: è un'altra regola, in
 *  standings.ts). Una partita non giocata non conta, nemmeno con un tabellino provvisorio: dopo «Annulla risultato» il
 *  tabellino resta come bozza. Si scartano i tabellini di un id che non è nel roster. */
export function tabellini(tappa: Tappa): Tabellino[] {
  const roster = new Map<string, { nome: string; squadra: string }>();
  for (const sq of tappa.squadre) {
    for (const p of sq.giocatori || []) roster.set(p.id, { nome: p.nome, squadra: sq.nome });
  }
  const out: Tabellino[] = [];
  for (const m of tappa.partite) {
    if (!m.done) continue;
    for (const { scheda, lato } of [{ scheda: m.pa, lato: "a" }, { scheda: m.pb, lato: "b" }] as const) {
      for (const [pid, raw] of Object.entries(scheda || {})) {
        const info = roster.get(pid);
        if (info) out.push({ pid, ...info, stat: conteggi(raw), partita: m, lato });
      }
    }
  }
  return out;
}

/** Una riga della tabella di stagione: un giocatore (nome e squadra) con i totali su tutte le tappe */
export interface StatGiocatore extends Conteggi {
  /** Nome e squadra normalizzati: è ciò che identifica la riga */
  chiave: string;
  /** Il nome e la squadra come si mostrano: vedi statGiocatori */
  nome: string;
  squadra: string;
  /** Partite giocate: una per ogni tabellino */
  g: number;
}

/** Aggrega i tabellini di tutte le tappe in una riga per giocatore. Il giocatore è il nome con la squadra, normalizzati
 *  (vedi normalizza): lo stesso giocatore in più tappe è una sola riga con i totali, due omonimi in squadre diverse sono
 *  due righe. Limite: chi cambia squadra compare su due righe, perché senza un legame con l'anagrafe non si può sapere che
 *  sia la stessa persona. Il nome e la squadra mostrati sono la grafia dell'ultima tappa dell'elenco in cui il giocatore ha
 *  un tabellino: le tappe si aggiungono in fondo, quindi è la più recente. Le righe seguono l'ordine in cui i giocatori
 *  compaiono; chi non ha un nome (un posto vuoto del roster) non ha riga. */
export function statGiocatori(tappe: Tappa[]): StatGiocatore[] {
  const righe = new Map<string, StatGiocatore>();
  for (const tappa of tappe) {
    for (const { nome, squadra, stat } of tabellini(tappa)) {
      const nomeNorm = normalizza(nome);
      if (!nomeNorm) continue;
      // Il separatore è un a capo: dopo la normalizzazione non può comparire né nel nome né nella squadra
      const chiave = `${nomeNorm}\n${normalizza(squadra)}`;
      const riga = righe.get(chiave) ?? { chiave, nome, squadra, g: 0, pt: 0, rb: 0, as: 0, ru: 0, st: 0, pe: 0, fa: 0 };
      // La grafia mostrata si aggiorna a ogni tabellino: alla fine resta quella dell'ultima tappa
      riga.nome = nome;
      riga.squadra = squadra;
      riga.g++;
      STAT_KEYS.forEach(([k]) => { riga[k] += stat[k]; });
      righe.set(chiave, riga);
    }
  }
  return [...righe.values()];
}
