/** Che cosa si sa della pubblicazione nell'Archivio circuito delle tappe di una pagina, e le pubblicazioni in corso. Sta nella pagina
 *  della tappa (useTappa) e non nella sezione «Concludi», che sparisce appena la tappa è conclusa. */
import { useEffect, useState } from "react";
import { useAppStore, tappaCorrente } from "../stores/useAppStore";
import { archivioApi } from "../services/archivioApi";
import { ApiError, esitoIgnoto, testoErrore } from "../services/api";
import type { User } from "../types";

/** Che cosa si sa della pubblicazione di una tappa conclusa nell'Archivio circuito: la pagina dice «pubblicata» solo se lo è davvero */
export interface StatoArchivio {
  /** true = è in archivio (l'ultima pubblicazione è riuscita, o la verifica l'ha trovata); false = non c'è; null = non si sa
   *  (la verifica non è ancora finita o non è riuscita, oppure l'ospite, che non pubblica) */
  pubblicata: boolean | null;
  /** Perché l'ultima pubblicazione non è riuscita; null se non ce ne sono state di fallite */
  errore: string | null;
}
const SCONOSCIUTO: StatoArchivio = { pubblicata: null, errore: null };

/** La pubblicazione è fallita e si sa che la copia non c'è: o il server ha risposto con un errore suo, oppure la richiesta non è
 *  nemmeno partita (412 locale: la tappa non era salvata). Non si sa con rete assente o tempo scaduto (status 0), né con un 502, 503 o
 *  504: dietro un proxy (Render) la PUT può essere stata eseguita dal server anche se la risposta è andata persa o il proxy ha
 *  risposto al suo posto. Dire «non pubblicata» farebbe riaprire la tappa lasciando la copia pubblica; nel dubbio «Riapri» ritira
 *  (la PUT è un upsert e la DELETE tollera il 404). L'elenco degli status di esito ignoto sta in api.ts (esitoIgnoto). */
function nonPubblicataSicuro(e: unknown): boolean {
  return e instanceof ApiError && !esitoIgnoto(e);
}

/** Lo stato della pubblicazione di una tappa, per `setArchivio` */
const registra = (tappaId: string, stato: StatoArchivio) =>
  (tutti: Record<string, StatoArchivio>): Record<string, StatoArchivio> => ({ ...tutti, [tappaId]: stato });

/** `id` è la tappa della pagina, `user` chi la guarda */
export function useStatoArchivio(id: string | undefined, user: User | null) {
  const pubblica = useAppStore((s) => s.pubblica);
  /** Stato della pubblicazione per tappa */
  const [archivio, setArchivio] = useState<Record<string, StatoArchivio>>({});
  const statoArchivio = archivio[id ?? ""] ?? SCONOSCIUTO;
  /** Pubblicazioni in corso: finché ce n'è una la pagina non lascia riaprire la tappa (la copia nascerebbe dopo, su una tappa riaperta) */
  const [inCorso, setInCorso] = useState(0);

  // Aprendo una tappa già conclusa si chiede all'archivio se c'è: dopo un ricaricamento, o dopo una pubblicazione non riuscita (anche
  // del Coach), la pagina non può saperlo da sola. Solo il 404 dice che non c'è: rete assente o guasto del server non dicono niente,
  // e lo stato resta «non si sa».
  useEffect(() => {
    if (!id || !user || user.guest || !tappaCorrente(id)?.conclusa) return;
    let attuale = true; // una risposta arrivata dopo che la tappa o l'utente sono cambiati non si applica
    const verifica = async () => {
      let trovata = true;
      try {
        await archivioApi.get(id);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) return;
        trovata = false;
      }
      if (!attuale) return;
      // Se per la tappa c'è già uno stato (riaperta, conclusa di nuovo, pubblicata) la risposta è di una domanda fatta prima: non vale più
      setArchivio((tutti) => {
        if (tutti[id]) return tutti;
        return registra(id, { pubblicata: trovata, errore: null })(tutti);
      });
    };
    void verifica();
    return () => { attuale = false; };
  }, [id, user]);

  /** Ripubblica una tappa conclusa dopo un cambio dei video: prima il server riceve la tappa, poi la copia pubblica si ricostruisce
   *  da lì */
  const ripubblica = async (tappaId: string) => {
    setInCorso((n) => n + 1);
    try {
      await pubblica(tappaId);
      setArchivio(registra(tappaId, { pubblicata: true, errore: null }));
    } catch (e) {
      // La copia pubblica resta com'era: se la tappa era in archivio ci resta, ma senza il video, e il motivo compare nella pagina.
      // Un vecchio «non pubblicata» non vale più se l'esito di questa PUT è ignoto: potrebbe aver pubblicato
      setArchivio((tutti) => {
        let pubblicata = (tutti[tappaId] ?? SCONOSCIUTO).pubblicata;
        if (pubblicata === false && !nonPubblicataSicuro(e)) pubblicata = null;
        return registra(tappaId, { pubblicata, errore: testoErrore(e) })(tutti);
      });
    } finally {
      setInCorso((n) => n - 1);
    }
  };

  /** Conclude la tappa con `concludi` (che la mette conclusa nello store) e la pubblica. La pubblicazione si conta in corso prima della
   *  conclusione: la pagina cambia con «Riapri» già disattivato. L'esito sta nello stato, e la pagina lo mostra accanto alla tappa.
   *  «Non pubblicata» solo se si sa; se l'esito è ignoto (rete assente, tempo scaduto, errore del proxy) lo stato resta «non si sa» e
   *  «Riapri» ritira la copia, se c'è */
  const concludiEPubblica = async (tappaId: string, concludi: () => void) => {
    setInCorso((n) => n + 1);
    try {
      concludi();
      try {
        await pubblica(tappaId);
        setArchivio(registra(tappaId, { pubblicata: true, errore: null }));
      } catch (e) {
        let pubblicata: boolean | null = null;
        if (nonPubblicataSicuro(e)) pubblicata = false;
        setArchivio(registra(tappaId, { pubblicata, errore: testoErrore(e) }));
      }
    } finally {
      setInCorso((n) => n - 1);
    }
  };

  /** true se prima di riaprire la tappa va tolta dall'archivio. Una tappa che si sa non pubblicata non ha niente da togliere, e
   *  l'ospite non pubblica: allora niente chiamata al server, e la riapertura avviene subito */
  const daRitirare = (tappaId: string): boolean =>
    Boolean(user && !user.guest && (archivio[tappaId] ?? SCONOSCIUTO).pubblicata !== false);

  /** Prima di riaprire: la tappa esce dall'archivio. Se il server non riesce a toglierla l'errore arriva a chi chiama, e la tappa non
   *  va riaperta. Il 404 vuol dire che non c'era più */
  const ritira = async (tappaId: string) => {
    try {
      await archivioApi.rimuovi(tappaId);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) throw e;
    }
  };

  /** Dopo la riapertura della tappa non si sa più niente della sua pubblicazione */
  const dimentica = (tappaId: string) => setArchivio(registra(tappaId, SCONOSCIUTO));

  return { statoArchivio, pubblicando: inCorso > 0, ripubblica, concludiEPubblica, daRitirare, ritira, dimentica };
}
