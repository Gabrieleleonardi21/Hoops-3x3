/** Versioni delle tappe e corpi mandati senza risposta (T2.7): ciò che serve per salvare con la versione giusta e per capire, dopo
 *  un 409, se il conflitto l'ha causato questo client o un altro dispositivo. Il registro non tocca lo store: lo usa useAppStore,
 *  che decide che cosa mostrare. Qui anche gli errori del server che la coda e i conflitti distinguono. */
import type { Tappa } from "../types";
import { legheApi } from "../services/legheApi";
import { ApiError } from "../services/api";
import { impronta } from "../utils/stessaTappa";

/** Errori temporanei, per cui la coda riprova: rete assente (status 0), guasto del server (5xx) e JWT respinto
 *  senza un rinnovo riuscito (401). Con il 401 la modifica resta in attesa invece di essere scartata: il rinnovo
 *  può essere fallito solo per la rete e, se la sessione è finita davvero, il logout la conta tra quelle perse.
 *  Gli altri rifiuti riguardano i dati: ripetere la stessa richiesta non servirebbe. */
export function riprovabile(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 0 || e.status === 401 || e.status >= 500);
}

/** 409 del server. Sulla PUT e sulla DELETE di una tappa vuol dire che sul server è cambiata («modificata da un altro dispositivo», o
 *  il messaggio generico «I dati sono stati modificati o eliminati…»); sulla POST che esiste già (T1.6). Si distinguono dal metodo */
export const conflitto = (e: unknown): e is ApiError => e instanceof ApiError && e.status === 409;

/** 404 del server: la tappa (o la sua lega) non c'è */
export const nonTrovata = (e: unknown): e is ApiError => e instanceof ApiError && e.status === 404;

/** 400 della PUT senza versione: la tappa è stata caricata da una pagina aperta prima dell'aggiornamento del server (T2.7). Si
 *  riconosce dal messaggio del server, perché gli altri 400 sono dati rifiutati */
export const mancaVersione = (e: unknown): e is ApiError =>
  e instanceof ApiError && e.status === 400 && e.message.startsWith("Manca la versione della tappa");

/** Quanti corpi mandati senza risposta si ricordano per tappa. Bastano per una ripartenza di Render (circa un minuto, qualche
 *  tentativo); oltre si tengono gli ultimi: i più vecchi vengono da una lunga assenza di rete e al server non sono mai arrivati */
const TETTO_SENZA_RISPOSTA = 20;

/** Una tappa riletta dalla lega dopo un conflitto, con il posto che ha nella lega sul server */
export interface TappaLetta {
  tappa: Tappa;
  posizione: number;
}

/** La tappa com'è adesso sul server, riletta dalla lega (non c'è un GET della singola tappa), con il suo posto nella lega; null se
 *  non c'è più. Lancia l'errore della lettura */
export async function tappaSulServer(legaId: string, id: string): Promise<TappaLetta | null> {
  const lega = await legheApi.get(legaId);
  const posizione = lega.tappe.findIndex((x) => x.id === id);
  if (posizione < 0) return null;
  return { tappa: lega.tappe[posizione], posizione };
}

/** true se la tappa del server è uno dei corpi mandati da questo client senza risposta. Il confronto è quello del server
 *  (impronta), versione esclusa; l'impronta della tappa del server si calcola una volta sola */
export function unoDeiNostri(inviate: Tappa[], delServer: Tappa): boolean {
  const daServer = impronta(delServer);
  return inviate.some((x) => impronta(x) === daServer);
}

/** Il registro delle versioni di chi usa l'app: uno per store. Le voci di una tappa eliminata restano fino all'uscita (azzera): non
 *  si leggono più */
export function creaVersioniTappe() {
  /** Per ogni tappa del server, la sua lega e la sua versione come le ha dette l'ultima risposta (GET della lega, POST, PUT,
   *  rilettura dopo un conflitto). È la versione su cui si basano le modifiche locali: la PUT la rimanda così com'è, senza
   *  calcolarla, e non scende mai (versioneDaRicordare). Sta qui e non nella copia della tappa in coda, che può essere stata fatta
   *  prima dell'ultima risposta; la tappa dello store ne tiene una copia (`versione`). undefined = il server non l'ha mandata
   *  (backend precedente a T2.7). La lega serve a rileggere la tappa dopo un conflitto anche se intanto se ne è aperta un'altra. */
  const sulServer = new Map<string, { legaId: string; versione: number | undefined }>();
  /** Corpi di una tappa partiti senza che se ne sia letta la risposta (esitoIgnoto: tempo scaduto, rete caduta, 502-504; keepalive
   *  alla chiusura della pagina), dall'ultima risposta riuscita: il server può averli salvati. Dopo un 409 (sulla PUT, sulla POST o
   *  sulla DELETE) dicono se il conflitto l'ha causato questo client. Si tengono tutti, non solo l'ultimo: quando Render riparte le
   *  richieste trattenute arrivano insieme, la prima salva e le altre ricevono 409, quindi il corpo salvato è il più vecchio di
   *  quelle. Senza doppioni e al massimo TETTO_SENZA_RISPOSTA per tappa (inviataSenzaRisposta). */
  const senzaRisposta = new Map<string, Tappa[]>();
  /** Una per ogni GET di selectLega in corso: le tappe che nel frattempo sono uscite dalla coda o dallo store, perché un conflitto le
   *  ha tolte (vale la tappa del server, o non c'è più) o perché l'utente le ha eliminate qui. La GET le ha lette prima: per loro non
   *  vale la versione in attesa letta prima della GET, e se non sono più nello store non vale nemmeno la tappa letta (conVersioniLocali) */
  const lettureInCorso = new Set<Set<string>>();
  /** Tappe del server messe da un conflitto mentre la loro lega non era aperta (applicaQuellaDelServer): non sono nello store, e una
   *  GET della lega partita prima del conflitto ne avrebbe la versione superata. Le usa la prossima apertura della lega */
  const delServerFuoriLega = new Map<string, Tappa>();

  /** La versione da ricordare per una tappa: quella nuova, ma mai più bassa di una già nota. Sul server le versioni salgono
   *  soltanto: una risposta arrivata fuori ordine (una lettura della lega partita prima di un salvataggio) non la riporta indietro */
  const versioneDaRicordare = (id: string, versione: number | undefined): number | undefined => {
    const nota = sulServer.get(id)?.versione;
    if (nota === undefined) return versione;
    if (versione === undefined || versione < nota) return nota;
    return versione;
  };

  return {
    /** La lega della tappa come l'ha detta il server; undefined se non l'ha mai detta */
    legaNota: (id: string): string | undefined => sulServer.get(id)?.legaId,

    /** Ricorda lega e versione di una tappa dette dal server (mai più bassa di quella nota) e restituisce la versione ricordata */
    ricorda: (legaId: string, id: string, nuova: number | undefined): number | undefined => {
      const versione = versioneDaRicordare(id, nuova);
      sulServer.set(id, { legaId, versione });
      return versione;
    },

    /** Le tappe appena lette dal server, con la loro versione: da qui le loro modifiche si basano su quella */
    ricordaTappe: (legaId: string, tappe: Tappa[]) => {
      for (const t of tappe) sulServer.set(t.id, { legaId, versione: versioneDaRicordare(t.id, t.versione) });
    },

    /** true se la tappa arriva da una lettura più vecchia della versione nota: i suoi dati sono superati da un salvataggio di qui */
    piuVecchiaDellaNota: (t: Tappa): boolean => {
      const nota = sulServer.get(t.id)?.versione;
      return nota !== undefined && t.versione !== undefined && t.versione < nota;
    },

    /** La tappa con la versione nota, non con quella della copia: è il corpo della PUT e la tappa da mettere nello store */
    conVersione: (t: Tappa): Tappa => {
      const nota = sulServer.get(t.id);
      if (!nota) return t;
      return { ...t, versione: nota.versione };
    },

    /** Il corpo è partito ma la risposta non si è letta: il server può averlo salvato. La stessa copia rimandata (nuovi tentativi,
     *  «Riprova ora», chiusura della pagina) si conta una volta; oltre il tetto escono i corpi più vecchi */
    inviataSenzaRisposta: (t: Tappa) => {
      const inviate = senzaRisposta.get(t.id) ?? [];
      if (inviate.includes(t)) return;
      senzaRisposta.set(t.id, [...inviate, t].slice(-TETTO_SENZA_RISPOSTA));
    },

    /** I corpi senza risposta di una tappa, tolti dal registro: chi li prende decide il conflitto, e dopo non servono più */
    prendiSenzaRisposta: (id: string): Tappa[] => {
      const inviate = senzaRisposta.get(id) ?? [];
      senzaRisposta.delete(id);
      return inviate;
    },

    /** I corpi senza risposta della tappa non contano più: il server ha confermato una versione, o la tappa non c'è più */
    dimenticaSenzaRisposta: (id: string) => {
      senzaRisposta.delete(id);
    },

    /** La tappa è uscita dalla coda o dallo store: ogni GET di selectLega in corso lo sa */
    uscitaDuranteLeLetture: (id: string) => {
      for (const uscite of lettureInCorso) uscite.add(id);
    },

    /** La GET di una lega per selectLega, raccogliendo in `uscite` le tappe che escono dalla coda o dallo store mentre è in corso */
    leggiLega: async (id: string, uscite: Set<string>) => {
      lettureInCorso.add(uscite);
      try {
        return await legheApi.get(id);
      } finally {
        lettureInCorso.delete(uscite);
      }
    },

    /** La tappa del server ricordata a lega chiusa (delServerFuoriLega), se c'è */
    copiaFuoriLega: (id: string): Tappa | undefined => delServerFuoriLega.get(id),
    ricordaCopiaFuoriLega: (t: Tappa) => {
      delServerFuoriLega.set(t.id, t);
    },
    dimenticaCopiaFuoriLega: (id: string) => {
      delServerFuoriLega.delete(id);
    },
    /** Le copie ricordate delle tappe di una lega: la lega si è aperta (ora sono nello store) o si è eliminata */
    dimenticaCopieDellaLega: (legaId: string) => {
      for (const id of [...delServerFuoriLega.keys()]) {
        if (sulServer.get(id)?.legaId === legaId) delServerFuoriLega.delete(id);
      }
    },

    /** All'uscita: niente di ciò che si sapeva vale per chi entra dopo */
    azzera: () => {
      sulServer.clear();
      senzaRisposta.clear();
      delServerFuoriLega.clear();
    },
  };
}
