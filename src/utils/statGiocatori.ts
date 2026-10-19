/** Statistiche dei giocatori aggregate su più tappe. Il roster di tappa non è collegato all'anagrafe e gli id dei giocatori
 *  si generano a ogni tappa: lo stesso giocatore in due tappe ha due id. Per riconoscerlo si usa l'id dell'anagrafe (regId)
 *  quando c'è; altrimenti il nome con la squadra, normalizzati, e l'anagrafe solo quando non c'è ambiguità (vedi
 *  risolviGiocatore). È l'unica aggregazione di stagione: la usano la tabella «Statistiche stagione» e la pagina del giocatore,
 *  così i loro numeri coincidono. */
import type { Partita, RegGiocatore, RegSquadra, StatLine, Tappa } from "../types";
import { STAT_KEYS } from "../constants/rules";
import { toStatLine } from "./statLine";
import { identitaSquadra, normalizza, perId, risolviGiocatore } from "./identita";

// normalizza è nata qui e si è spostata in identita.ts: la si ri-esporta perché i chiamanti di prima non cambino import
export { normalizza } from "./identita";

/** Le sette statistiche di un giocatore in numeri, mai mancanti */
type Conteggi = Record<keyof StatLine, number>;

/** L'anagrafe che serve a riconoscere i giocatori: le squadre (per il loro roster) e i giocatori registrati. Senza, ogni
 *  giocatore si riconosce solo per nome e squadra */
export interface Anagrafe { squadre: RegSquadra[]; giocatori: RegGiocatore[] }

/** Un valore mancante o non numerico vale 0 */
const numero = (valore: unknown) => Number(valore) || 0;

/** Il tabellino di un giocatore in una partita, in numeri. Il formato vecchio è un numero: i soli punti */
function conteggi(raw: StatLine | number): Conteggi {
  const stat = toStatLine(raw);
  return {
    pt: numero(stat.pt), rb: numero(stat.rb), as: numero(stat.as), ru: numero(stat.ru),
    st: numero(stat.st), pe: numero(stat.pe), fa: numero(stat.fa),
  };
}

/** La chiave della riga di stagione: l'id dell'anagrafe se c'è, altrimenti nome e squadra normalizzati. Il separatore è un a
 *  capo, che la normalizzazione non lascia né nel nome né nella squadra; così le due forme di chiave non si confondono */
function chiaveRiga(regId: string | undefined, nome: string, squadraChiave: string): string {
  if (regId) return `reg:${regId}`;
  return `${normalizza(nome)}\n${squadraChiave}`;
}

/** Il tabellino di un giocatore in una partita giocata, con la sua identità risolta. `nome` e `squadra` sono come sono scritti
 *  nel roster della tappa; `squadraId` è la squadra della scheda in cui sta il tabellino (il lato, non il roster); `regId`
 *  è quello del roster, o quello riconosciuto con l'anagrafe; `chiave` è la chiave della riga di stagione */
export interface Tabellino {
  pid: string; nome: string; squadra: string; squadraId: string; squadraChiave: string; squadraRegId?: string;
  regId?: string; chiave: string; stat: Conteggi; partita: Partita; lato: "a" | "b";
}

/** L'identità di un giocatore del roster: tutto ciò che un suo tabellino porta, tranne partita, statistiche e lato */
type IdentitaRoster = Omit<Tabellino, "pid" | "stat" | "partita" | "lato" | "squadraId">;

/** I tabellini di tutte le partite giocate di una tappa, nell'ordine delle partite (in ognuna prima la squadra A), con l'identità
 *  di ciascun giocatore risolta una sola volta per tappa. Con l'anagrafe una persona è la stessa in tappe diverse: tappe vecchie
 *  senza regId e tappe nuove con regId finiscono nella stessa riga. Senza anagrafe, o con un nome ambiguo, la riga resta per nome.
 *  È la regola delle statistiche dei giocatori: conta ogni partita giocata (`done`), anche se è finita in parità, perché
 *  i punti dei giocatori non dipendono dal vincitore (la classifica invece la ignora: è un'altra regola, in
 *  standings.ts). Una partita non giocata non conta, nemmeno con un tabellino provvisorio: dopo «Annulla risultato» il
 *  tabellino resta come bozza. Si scartano i tabellini di un id che non è nel roster. */
export function risolviTabellini(tappa: Tappa, anagrafe?: Anagrafe): Tabellino[] {
  const squadrePerId = perId(anagrafe?.squadre ?? []);
  const giocatoriPerId = perId(anagrafe?.giocatori ?? []);
  const roster = new Map<string, IdentitaRoster>();
  for (const sq of tappa.squadre) {
    const squadraChiave = identitaSquadra(sq);
    // La squadra dell'anagrafe, se è collegata: da lei si riconoscono i suoi giocatori senza regId
    let squadraAnagrafe: RegSquadra | undefined;
    if (sq.regId) squadraAnagrafe = squadrePerId.get(sq.regId);
    for (const p of sq.giocatori || []) {
      // Il regId scritto nel roster vince; senza, il giocatore si riconosce per nome solo se la regola trova uno solo
      let regId = p.regId;
      if (!regId) regId = risolviGiocatore(p.nome, squadraAnagrafe, giocatoriPerId)?.id;
      roster.set(p.id, {
        nome: p.nome, squadra: sq.nome, squadraChiave, squadraRegId: sq.regId, regId, chiave: chiaveRiga(regId, p.nome, squadraChiave),
      });
    }
  }
  const out: Tabellino[] = [];
  for (const m of tappa.partite) {
    if (!m.done) continue;
    // Ogni scheda sta nel lato della sua squadra: la squadra della scheda è quella del lato, non quella del roster
    for (const { scheda, lato, squadraId } of [{ scheda: m.pa, lato: "a", squadraId: m.a }, { scheda: m.pb, lato: "b", squadraId: m.b }] as const) {
      for (const [pid, raw] of Object.entries(scheda || {})) {
        const info = roster.get(pid);
        if (info) out.push({ pid, ...info, squadraId, stat: conteggi(raw), partita: m, lato });
      }
    }
  }
  return out;
}

/** I tabellini di una tappa senza anagrafe: il riconoscimento per nome e squadra di prima */
export function tabellini(tappa: Tappa): Tabellino[] {
  return risolviTabellini(tappa);
}

/** Una riga della tabella di stagione: un giocatore (nome e squadra) con i totali su tutte le tappe */
export interface StatGiocatore extends Conteggi {
  /** La chiave che identifica la riga (vedi chiaveRiga) */
  chiave: string;
  /** Il nome e la squadra come si mostrano: vedi statGiocatori */
  nome: string;
  squadra: string;
  /** Partite giocate: una per ogni tabellino */
  g: number;
  /** L'id dell'anagrafe della riga, se la riga ce l'ha: la pagina del giocatore la attribuisce a chi ha quell'id */
  regId?: string;
  /** La chiave della squadra (vedi identitaSquadra): due squadre omonime collegate a voci diverse restano distinte */
  squadraChiave: string;
  /** Vero se in una stessa tappa due giocatori del roster (due id diversi) stanno sotto questa riga: due omonimi della stessa
   *  squadra che non si sono potuti distinguere. Le loro gare sono sommate */
  omonimi: boolean;
}

/** Aggrega i tabellini di tutte le tappe in una riga per giocatore. Il giocatore è il suo regId se ce l'ha; altrimenti il nome
 *  con la squadra, normalizzati (vedi normalizza): lo stesso giocatore in più tappe è una sola riga con i totali, due omonimi in
 *  squadre diverse sono due righe. Con l'anagrafe, chi è collegato a una squadra registrata si riconosce anche senza regId
 *  (vedi risolviTabellini), e la stessa persona che cambia squadra collegata resta una riga. Il nome e la squadra mostrati sono
 *  la grafia dell'ultima tappa dell'elenco in cui il giocatore ha un tabellino: le tappe si aggiungono in fondo, quindi è la più
 *  recente. Le righe seguono l'ordine in cui i giocatori compaiono; chi non ha un nome (un posto vuoto del roster) non ha riga. */
export function statGiocatori(tappe: Tappa[], anagrafe?: Anagrafe): StatGiocatore[] {
  const righe = new Map<string, StatGiocatore>();
  // Per ogni riga, i giocatori del roster visti in ogni tappa: due in una stessa tappa vuol dire due omonimi sotto la stessa riga
  const pidPerTappa = new Map<string, Map<number, Set<string>>>();
  for (const [indice, tappa] of tappe.entries()) {
    for (const { pid, chiave, nome, squadra, squadraChiave, regId, stat } of risolviTabellini(tappa, anagrafe)) {
      if (!normalizza(nome)) continue;
      const riga = righe.get(chiave) ?? {
        chiave, nome, squadra, g: 0, pt: 0, rb: 0, as: 0, ru: 0, st: 0, pe: 0, fa: 0, regId, squadraChiave, omonimi: false,
      };
      // La grafia mostrata si aggiorna a ogni tabellino: alla fine resta quella dell'ultima tappa
      riga.nome = nome;
      riga.squadra = squadra;
      riga.g++;
      STAT_KEYS.forEach(([k]) => { riga[k] += stat[k]; });
      const perTappa = pidPerTappa.get(chiave) ?? new Map<number, Set<string>>();
      const pids = perTappa.get(indice) ?? new Set<string>();
      pids.add(pid);
      perTappa.set(indice, pids);
      pidPerTappa.set(chiave, perTappa);
      if (pids.size > 1) riga.omonimi = true;
      righe.set(chiave, riga);
    }
  }
  return [...righe.values()];
}

/** Le tappe su cui calcolare le statistiche: quelle pubblicate nell'Archivio circuito più quelle della lega aperta. Una tappa
 *  pubblicata che è anche nella lega aperta (stesso id) conta una volta sola, nella versione locale: può avere risultati più
 *  recenti della copia pubblica, e sta dopo le altre perché `statGiocatori` mostra la grafia dell'ultima tappa dell'elenco.
 *  Non modifica gli array ricevuti. */
export function unisciTappe(pubblicate: Tappa[], locali: Tappa[]): Tappa[] {
  const idLocali = new Set(locali.map((t) => t.id));
  return [...pubblicate.filter((t) => !idLocali.has(t.id)), ...locali];
}
