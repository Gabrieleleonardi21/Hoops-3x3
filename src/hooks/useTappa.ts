import { useEffect, useState } from "react";
import { useAppStore, tappaCorrente } from "../stores/useAppStore";
import { archivioApi } from "../services/archivioApi";
import { ApiError, esitoIgnoto, testoErrore } from "../services/api";
import { anagrafeApi } from "../services/anagrafeApi";
import { useAnagrafeStore } from "../stores/useAnagrafeStore";
import { uid } from "../utils/uid";
import { PERDITA_RIAPERTURA } from "../utils/testi";
import * as ops from "../domain/tappaOps";
import type { Esito, ModoSorteggio } from "../domain/tappaOps";
import type { EventoGara, Partita, RegSquadra, SquadraTappa, StatLine, StatSheet, Tappa } from "../types";

export interface MatchDraft {
  sa: string;
  sb: string;
  pa: Record<string, Partial<Record<keyof StatLine, string>>>;
  pb: Record<string, Partial<Record<keyof StatLine, string>>>;
}

/** scarta i campi vuoti e converte in numeri */
function numify(sheet: MatchDraft["pa"]): StatSheet {
  return Object.fromEntries(
    Object.entries(sheet || {}).map(([pid, st]) => [
      pid,
      Object.fromEntries(
        Object.entries(st || {})
          .filter(([, v]) => v !== "" && v !== null && !isNaN(parseInt(String(v), 10)))
          .map(([key, v]) => [key, parseInt(String(v), 10)])
      ),
    ])
  );
}

/* Letture su una tappa qualsiasi: l'hook le applica alla tappa del render, le operazioni a quella di adesso */
const nomeSquadra = (t: Tappa | null, teamId: string) => t?.squadre.find((s) => s.id === teamId)?.nome || "?";
/** Giocatori con il nome compilato: sono quelli che contano per il roster */
const giocatoriConNome = (t: Tappa | null, teamId: string) =>
  (t?.squadre.find((s) => s.id === teamId)?.giocatori || []).filter((p) => p.nome.trim());
const rosterCompleto = (t: Tappa | null, teamId: string) => giocatoriConNome(t, teamId).length >= 3;

/* Sincronizzazione con l'anagrafe: funzioni pure, che si applicano alla tappa com'è adesso nello store */

/** La voce dell'anagrafe di una squadra: prima per regId (una squadra senza regId non ne trova nessuna), poi per nome */
const voceAnagrafe = (s: SquadraTappa, regs: RegSquadra[]) =>
  regs.find((r) => r.id === s.regId) ?? regs.find((r) => r.nome.toLowerCase() === s.nome.trim().toLowerCase());

/** La tappa con le squadre allineate all'anagrafe `regs`; la stessa tappa se non c'è niente da cambiare. Non tocca le squadre con
 *  nome segnaposto ("Squadra N") né le tappe concluse: una tappa conclusa è pubblicata così com'era, e un'anagrafe cambiata dopo non
 *  la riscrive */
function allineaConAnagrafe(t: Tappa, regs: RegSquadra[]): Tappa {
  if (t.conclusa) return t;
  let changed = false;
  const updated = t.squadre.map((s) => {
    if (ops.eSegnaposto(s.nome)) return s;
    const reg = voceAnagrafe(s, regs);
    if (!reg) return s;
    // Aggiorna solo se qualcosa è cambiato
    if (s.regId === reg.id && s.logo === reg.logo && s.nome === reg.nome
      && String(s.rank) === String(reg.rank) && s.website === reg.website) return s;
    changed = true;
    return { ...s, regId: reg.id, nome: reg.nome, logo: reg.logo, rank: reg.rank, website: reg.website };
  });
  if (!changed) return t;
  return { ...t, squadre: updated };
}

/** Le squadre collegate (regId) a una voce che `regs` non ha: o è stata eliminata, o `regs` non la conosce ancora (una cache
 *  scaricata prima che un altro utente la creasse). Vuoto per una tappa conclusa e per le squadre con nome segnaposto. */
function collegateSenzaVoce(t: Tappa, regs: RegSquadra[]): SquadraTappa[] {
  if (t.conclusa) return [];
  return t.squadre.filter((s) => s.regId && !ops.eSegnaposto(s.nome) && !voceAnagrafe(s, regs));
}

/** La tappa con scollegate le squadre di collegateSenzaVoce: tengono nome, logo e ranking che hanno, ma tornano modificabili e
 *  possono collegarsi a una voce nuova. La stessa tappa se non ce n'è. */
function scollegaSenzaVoce(t: Tappa, regs: RegSquadra[]): Tappa {
  const senzaVoce = collegateSenzaVoce(t, regs);
  if (senzaVoce.length === 0) return t;
  return {
    ...t,
    squadre: t.squadre.map((s) => {
      if (!senzaVoce.includes(s)) return s;
      return { ...s, regId: undefined };
    }),
  };
}

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

export function useTappa(id: string | undefined) {
  const { user, legaName, tappe, updateTappa, replaceTappa, removeTappa, pubblica } = useAppStore();
  const tappa = tappe.find((t) => t.id === id) || null;
  /** Stato della pubblicazione per tappa. Sta qui e non nella sezione «Concludi», che sparisce appena la tappa è conclusa. */
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

  /** Per i campi il cui nuovo valore non dipende dalla tappa (un testo scritto, un valore fisso) */
  const patch = (p: Partial<Tappa>) => tappa && updateTappa(tappa.id, p);
  /** Per il resto: la funzione riceve la tappa com'è adesso nello store, non la copia `tappa` di questo render.
   *  Dopo un'attesa (la risposta del server) o con più modifiche di seguito la copia è vecchia, e riscriverla
   *  cancellerebbe ciò che nel frattempo è stato scritto altrove. */
  const aggiorna = (modifica: (t: Tappa) => Tappa) => tappa && updateTappa(tappa.id, modifica);
  /** `aggiorna` per una squadra: le altre restano come sono */
  const aggiornaSquadra = (teamId: string, cambia: (s: SquadraTappa) => SquadraTappa) =>
    aggiorna((t) => ({
      ...t,
      squadre: t.squadre.map((s) => {
        if (s.id !== teamId) return s;
        return cambia(s);
      }),
    }));
  /** `aggiorna` per una partita: le altre restano come sono */
  const aggiornaPartita = (matchId: string, cambia: (m: Partita) => Partita) =>
    aggiorna((t) => ({
      ...t,
      partite: t.partite.map((m) => {
        if (m.id !== matchId) return m;
        return cambia(m);
      }),
    }));
  /** Applica un'operazione di tappaOps alla tappa com'è adesso nello store e salva il risultato. Se l'operazione è
   *  rifiutata non salva niente e restituisce il messaggio da mostrare; null = fatto. Se restituisce la stessa tappa
   *  (niente da cambiare, per esempio lo stesso numero di gironi) non parte nessun salvataggio. */
  const applica = (operazione: (t: Tappa) => Esito): string | null => {
    const corrente = tappaCorrente(id);
    if (!corrente) return "Tappa non trovata.";
    const esito = operazione(corrente);
    if (!esito.ok) return esito.errore;
    if (esito.tappa !== corrente) replaceTappa(esito.tappa);
    return null;
  };

  /* ── helper di lettura ── */
  const nameOf = (teamId: string) => nomeSquadra(tappa, teamId);
  const playersOf = (teamId: string) => giocatoriConNome(tappa, teamId);
  const playerNameById = (pid: string) => {
    for (const s of tappa?.squadre || []) {
      const p = (s.giocatori || []).find((x) => x.id === pid);
      if (p) return p.nome;
    }
    return null;
  };
  const teamComplete = (teamId: string) => rosterCompleto(tappa, teamId);

  /* ── modifica tappa ── */
  const setInfo = (k: "luogo" | "data", v: string) => patch({ [k]: v });
  /** Il nome passa da tappaOps: un nome vuoto è rifiutato e nello store resta quello di prima */
  const rinomina = (nome: string) => applica((t) => ops.rinominaTappa(t, nome));
  const setRule = (k: keyof Tappa["regole"], v: string) =>
    aggiorna((t) => ({ ...t, regole: { ...t.regole, [k]: Math.max(1, Number(v) || 1) } }));
  /** Il testo di una conferma (le funzioni `perdita…` di tappaOps) per la tappa com'è adesso nello store; null se niente */
  const perdita = (testo: (t: Tappa) => string | null) => {
    const corrente = tappaCorrente(id);
    if (!corrente) return null;
    return testo(corrente);
  };
  /** Che cosa cancellerebbero adesso un nuovo sorteggio o un cambio di struttura */
  const perditaRisultati = () => perdita(ops.perditaRisultati);
  /** Che cosa cancellerebbe «Elimina» */
  const perditaTappa = () => perdita(ops.perditaTappa);
  /** Che cosa cancellerebbe «Rimuovi squadra»; null per una squadra appena aggiunta, che si toglie senza chiedere */
  const perditaSquadra = (teamId: string) => perdita((t) => ops.perditaSquadra(t, teamId));
  /** Che cosa cancellerebbe «Riapri»: la pubblicazione nell'archivio, che solo chi ha un account può avere. Una tappa che non è
   *  in archivio non ha niente da perdere (il testo direbbe il falso); nel dubbio, se la verifica non è riuscita, si avverte. */
  const perditaRiapertura = () => {
    if (!user || user.guest) return null;
    if (statoArchivio.pubblicata === false) return null;
    return PERDITA_RIAPERTURA;
  };
  // Cambi di struttura (regole e limiti in tappaOps): azzerano sorteggio, calendario e tabellone
  const setNGironi = (n: number) => applica((t) => ops.impostaNumeroGironi(t, n));
  const addTeam = () => applica(ops.aggiungiSquadra);
  const removeTeam = (teamId: string) => applica((t) => ops.rimuoviSquadra(t, teamId));
  const renameTeam = (teamId: string, nome: string) => aggiornaSquadra(teamId, (s) => ({ ...s, nome }));
  const setTeamRank = (teamId: string, rank: string) => aggiornaSquadra(teamId, (s) => ({ ...s, rank }));
  const setTeamWebsite = (teamId: string, website: string) => aggiornaSquadra(teamId, (s) => ({ ...s, website }));
  const setTeamLogo = (teamId: string, logo: string) => aggiornaSquadra(teamId, (s) => ({ ...s, logo }));

  /** Collega una squadra tappa alla RegSquadra e ne copia nome, logo, rank, website.
   *  Lo chiama la pagina dopo aver atteso il server: l'elenco squadre si rifà dalla tappa di adesso, così quello che
   *  nel frattempo è stato scritto nelle altre squadre resta. */
  const applyReg = (teamId: string, reg: RegSquadra) =>
    aggiornaSquadra(teamId, (s) => ({
      ...s, regId: reg.id, nome: reg.nome, logo: reg.logo, rank: reg.rank, website: reg.website,
    }));

  /** Sincronizza tutte le squadre della tappa con l'anagrafe `regs`, la cache (usato all'apertura della pagina).
   *  Cerca prima per regId, poi per nome case-insensitive. Non tocca le squadre con nome placeholder ("Squadra N") né le tappe
   *  concluse. Una squadra collegata a una voce che la cache non ha non si scollega subito: la cache non vede le voci create da
   *  altri dopo il suo caricamento. Si chiede al server la lista fresca (una richiesta, solo in questo caso) e si scollega solo
   *  ciò che manca sia lì sia nella cache di adesso (nell'attesa una voce può esservi entrata, e la lista, partita prima, non
   *  contenerla); se il server non risponde non si scollega niente. Le voci trovate sul server entrano in cache: così la
   *  verifica non si ripete a ogni apertura della pagina. */
  const syncFromAnagrafe = async (regs: RegSquadra[]) => {
    if (!tappa) return;
    // Se alla tappa vista non manca niente non si salva: altrimenti ne partirebbe uno a ogni apertura della pagina
    if (allineaConAnagrafe(tappa, regs) !== tappa) aggiorna((t) => allineaConAnagrafe(t, regs));
    const prima = tappaCorrente(id);
    if (!prima) return;
    const senzaVoce = collegateSenzaVoce(prima, regs);
    if (senzaVoce.length === 0) return;
    // La lista parte con il token di adesso: se un accesso o un'uscita svuota la cache durante l'attesa, ha la forma del token di prima
    const epocaAllInizio = useAnagrafeStore.getState().epoca;
    let fresche: RegSquadra[];
    try {
      fresche = await anagrafeApi.listSquadre();
    } catch {
      return;
    }
    // Dopo l'attesa si riparte dalla tappa di adesso (nel frattempo può essere cambiata, o conclusa) e dalla cache di adesso: la
    // lista del server, partita prima, può non avere una voce che nell'attesa è entrata (ricerca, creazione, Coach). Per i dati
    // vale la lista fresca; una voce solo in cache conta come presente.
    const anagrafe = useAnagrafeStore.getState();
    const dopo = tappaCorrente(id);
    if (!dopo) return;
    const soloInCache = (anagrafe.squadre ?? []).filter((c) => !fresche.some((f) => f.id === c.id));
    const conosciute = [...fresche, ...soloInCache];
    // Le voci a cui le squadre sono collegate e che il server ha entrano in cache (senza invalidarla). Non se la cache è stata svuotata
    // nell'attesa (accesso o uscita, anche in un'altra scheda): una voce letta con l'altro token sostituirebbe, per id, quella della
    // cache nuova con la forma sbagliata (pubblica dopo un accesso, completa dopo un'uscita). I dati della tappa si allineano lo stesso:
    // nome, logo, ranking e sito sono uguali nelle due forme
    if (anagrafe.epoca === epocaAllInizio) {
      anagrafe.registraInCache(fresche.filter((voce) => senzaVoce.some((s) => s.regId === voce.id)));
    }
    const sincronizzata = (t: Tappa) => scollegaSenzaVoce(allineaConAnagrafe(t, conosciute), conosciute);
    if (sincronizzata(dopo) === dopo) return;
    updateTappa(dopo.id, sincronizzata);
  };

  /* ── roster ── */
  const addPlayer = (teamId: string) =>
    aggiornaSquadra(teamId, (s) => {
      const giocatori = s.giocatori || [];
      if (giocatori.length >= 4) return s;
      return { ...s, giocatori: [...giocatori, { id: uid(), nome: "" }] };
    });
  const renamePlayer = (teamId: string, pid: string, nome: string) =>
    aggiornaSquadra(teamId, (s) => ({
      ...s,
      giocatori: (s.giocatori || []).map((p) => {
        if (p.id !== pid) return p;
        return { ...p, nome };
      }),
    }));
  const removePlayer = (teamId: string, pid: string) =>
    aggiornaSquadra(teamId, (s) => ({ ...s, giocatori: (s.giocatori || []).filter((p) => p.id !== pid) }));

  /* ── sorteggio: gironi e calendario li costruisce tappaOps ── */
  // Sorteggio, punteggi, conclusione e video leggono la tappa di adesso e la salvano subito, senza attese in mezzo:
  // partono da `corrente`, non dalla copia `tappa` di questo render, che dopo un'attesa o un'altra modifica è vecchia
  const sorteggia = (mode: ModoSorteggio): string | null => {
    const corrente = tappaCorrente(id);
    if (!corrente || !user) return "Tappa non trovata.";
    // Roster e ranking sono obbligatori solo per i registrati: l'ospite fa prove libere
    if (!user.guest) {
      const incomplete = corrente.squadre.filter((s) => !rosterCompleto(corrente, s.id));
      if (incomplete.length)
        return `Non puoi sorteggiare: ogni squadra deve avere almeno 3 giocatori con nome. Roster incompleti: ${incomplete.map((s) => s.nome).join(", ")}.`;
      if (mode === "ranking" && !corrente.squadre.some((s) => Number(s.rank) > 0))
        return "Per il sorteggio per ranking inserisci i punti ranking del circuito nelle card delle squadre.";
    }
    const esito = ops.sorteggia(corrente, mode);
    if (!esito.ok) return esito.errore;
    replaceTappa(esito.tappa);
    return null;
  };

  /* ── punteggi: le regole 3x3 sul punteggio sono in tappaOps, qui i controlli sui roster ── */
  const saveScore = (m: Partita, draft: MatchDraft): string | null => {
    const corrente = tappaCorrente(id);
    if (!corrente || !user) return "Tappa non trovata.";
    const sa = parseInt(draft.sa, 10);
    const sb = parseInt(draft.sb, 10);
    const esito = ops.registraRisultato(corrente, m.id, { sa, sb, pa: numify(draft.pa), pb: numify(draft.pb) });
    if (!esito.ok) return esito.errore;
    // Per i registrati i punti dei giocatori sono obbligatori e devono dare il totale di squadra
    if (!user.guest) {
      const sides: ["pa" | "pb", string, number][] = [["pa", m.a, sa], ["pb", m.b, sb]];
      for (const [side, teamId, total] of sides) {
        const pls = giocatoriConNome(corrente, teamId);
        if (pls.length < 3) return `${nomeSquadra(corrente, teamId)} non ha un roster valido (minimo 3 giocatori).`;
        const vals = pls.map((p) => parseInt(String(draft[side]?.[p.id]?.pt ?? ""), 10));
        if (vals.some((v) => isNaN(v) || v < 0))
          return `Inserisci i punti (PT) di OGNI giocatore di ${nomeSquadra(corrente, teamId)} (anche 0).`;
        const sum = vals.reduce((t, v) => t + v, 0);
        if (sum !== total)
          return `I punti dei giocatori di ${nomeSquadra(corrente, teamId)} sommano ${sum}, ma il totale è ${total}.`;
      }
    }
    replaceTappa(esito.tappa);
    return null;
  };

  /** «Correggi»: la partita torna da giocare (tappaOps la rifiuta se la fase finale è già stata generata) */
  const reopenScore = (matchId: string) => applica((t) => ops.annullaRisultato(t, matchId));

  /* ── eventi di gara ── */
  const addEvent = (matchId: string, ev: Omit<EventoGara, "id">) =>
    aggiornaPartita(matchId, (m) => ({ ...m, eventi: [...(m.eventi || []), { ...ev, id: uid() }] }));
  const removeEvent = (matchId: string, evId: string) =>
    aggiornaPartita(matchId, (m) => ({ ...m, eventi: (m.eventi || []).filter((e) => e.id !== evId) }));

  /* ── video + pubblicazione ── */
  const republish = async (t: Tappa) => {
    if (!t.conclusa || !user || user.guest) return;
    setInCorso((n) => n + 1);
    try {
      // Prima il server riceve la tappa col video, poi la copia pubblica si ricostruisce da lì
      await pubblica(t.id);
      setArchivio(registra(t.id, { pubblicata: true, errore: null }));
    } catch (e) {
      // La copia pubblica resta com'era: se la tappa era in archivio ci resta, ma senza il video, e il motivo compare nella pagina.
      // Un vecchio «non pubblicata» non vale più se l'esito di questa PUT è ignoto: potrebbe aver pubblicato
      setArchivio((tutti) => {
        let pubblicata = (tutti[t.id] ?? SCONOSCIUTO).pubblicata;
        if (pubblicata === false && !nonPubblicataSicuro(e)) pubblicata = null;
        return registra(t.id, { pubblicata, errore: testoErrore(e) })(tutti);
      });
    } finally {
      setInCorso((n) => n - 1);
    }
  };
  const addVideo = (titolo: string, url: string) => {
    const corrente = tappaCorrente(id);
    if (!corrente || !url.trim()) return;
    const t2: Tappa = {
      ...corrente,
      video: [...(corrente.video || []), { id: uid(), titolo: titolo.trim() || `Video ${(corrente.video || []).length + 1}`, url: url.trim() }],
    };
    replaceTappa(t2);
    republish(t2);
  };
  const removeVideo = (vid: string) => {
    const corrente = tappaCorrente(id);
    if (!corrente) return;
    const t2: Tappa = { ...corrente, video: (corrente.video || []).filter((v) => v.id !== vid) };
    replaceTappa(t2);
    republish(t2);
  };

  /* ── conclusione: gironi e fase diretta completi li verifica tappaOps ── */
  const concludi = async (): Promise<string | null> => {
    const corrente = tappaCorrente(id);
    if (!corrente || !user) return "Tappa non trovata.";
    const esito = ops.concludi(corrente);
    if (!esito.ok) return esito.errore;
    if (user.guest) return "La pubblicazione nell'Archivio circuito richiede un account registrato.";
    setInCorso((n) => n + 1); // prima della conclusione: la pagina cambia con «Riapri» già disattivato
    try {
      replaceTappa(esito.tappa);
      // Da qui la pagina è un'altra (la sezione «Concludi» non c'è più): se la pubblicazione non riesce, il messaggio che si
      // restituisce non lo leggerebbe nessuno. L'esito sta nello stato, e la pagina lo mostra accanto alla tappa. La tappa resta
      // conclusa e una tappa conclusa non si conclude di nuovo: per ripubblicare va riaperta. «Non pubblicata» solo se si sa; se
      // l'esito è ignoto (rete assente, tempo scaduto, errore del proxy) lo stato resta «non si sa» e «Riapri» ritira la copia, se c'è
      try {
        await pubblica(esito.tappa.id);
        setArchivio(registra(esito.tappa.id, { pubblicata: true, errore: null }));
      } catch (e) {
        let pubblicata: boolean | null = null;
        if (nonPubblicataSicuro(e)) pubblicata = false;
        setArchivio(registra(esito.tappa.id, { pubblicata, errore: testoErrore(e) }));
      }
    } finally {
      setInCorso((n) => n - 1);
    }
    return null;
  };

  /** «Riapri»: prima la tappa esce dall'archivio, poi si riapre. Se il server non riesce a toglierla, la tappa resta conclusa e
   *  l'errore arriva a chi chiama (la pagina lo mostra): riaprirla lasciando la copia pubblica, e senza più il pulsante per
   *  ritirarla, sarebbe peggio. Il 404 vuol dire che non c'era più: si riapre lo stesso. Una tappa che si sa non pubblicata non ha
   *  niente da togliere, e l'ospite non pubblica: niente chiamata al server. */
  const riapri = async () => {
    if (!tappa) return;
    if (user && !user.guest && statoArchivio.pubblicata !== false) {
      try {
        await archivioApi.rimuovi(tappa.id);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e;
      }
    }
    updateTappa(tappa.id, { conclusa: false });
    setArchivio(registra(tappa.id, SCONOSCIUTO));
  };

  return {
    user, legaName, tappa, statoArchivio, pubblicando: inCorso > 0,
    nameOf, playersOf, playerNameById, teamComplete,
    setInfo, rinomina, perditaRisultati, perditaTappa, perditaSquadra, perditaRiapertura, setNGironi, setRule, addTeam, removeTeam,
    renameTeam, setTeamRank, setTeamWebsite, setTeamLogo, applyReg, syncFromAnagrafe,
    addPlayer, renamePlayer, removePlayer,
    sorteggia, saveScore, reopenScore,
    addEvent, removeEvent,
    addVideo, removeVideo, concludi, riapri,
    removeTappa,
  };
}
