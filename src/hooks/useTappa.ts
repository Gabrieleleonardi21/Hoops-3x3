import { useAppStore, tappaCorrente } from "../stores/useAppStore";
import { archivioApi } from "../services/archivioApi";
import { uid } from "../utils/uid";
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

export function useTappa(id: string | undefined) {
  const { user, legaName, tappe, updateTappa, replaceTappa, removeTappa } = useAppStore();
  const tappa = tappe.find((t) => t.id === id) || null;

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
  /** Che cosa cancellerebbe «Riapri»: la pubblicazione nell'archivio, che solo chi ha un account può avere */
  const perditaRiapertura = () => {
    if (!user || user.guest) return null;
    return ops.PERDITA_RIAPERTURA;
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

  /** Sincronizza tutte le squadre della tappa con l'anagrafe (usato all'apertura della pagina).
   *  Cerca prima per regId, poi per nome case-insensitive.
   *  Non tocca le squadre con nome placeholder ("Squadra N") né le tappe concluse. */
  const syncFromAnagrafe = (regs: RegSquadra[]) => {
    if (!tappa) return;
    /** La tappa con le squadre allineate all'anagrafe; la stessa tappa se non c'è niente da cambiare */
    const allinea = (t: Tappa): Tappa => {
      // Una tappa conclusa è pubblicata così com'era: un'anagrafe cambiata dopo non la riscrive
      if (t.conclusa) return t;
      let changed = false;
      const updated = t.squadre.map((s) => {
        if (ops.eSegnaposto(s.nome)) return s; // placeholder, skip
        // Prima per regId (una squadra senza regId non ne trova nessuna), poi per nome
        const reg = regs.find((r) => r.id === s.regId)
          ?? regs.find((r) => r.nome.toLowerCase() === s.nome.trim().toLowerCase());
        if (!reg) return s;
        // Aggiorna solo se qualcosa è cambiato
        if (s.regId === reg.id && s.logo === reg.logo && s.nome === reg.nome
          && String(s.rank) === String(reg.rank) && s.website === reg.website) return s;
        changed = true;
        return { ...s, regId: reg.id, nome: reg.nome, logo: reg.logo, rank: reg.rank, website: reg.website };
      });
      if (!changed) return t;
      return { ...t, squadre: updated };
    };
    // Se alla tappa vista non manca niente non si salva: altrimenti ne partirebbe uno a ogni apertura della pagina
    if (allinea(tappa) === tappa) return;
    aggiorna(allinea);
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
    await archivioApi.pubblica(t, legaName).catch(() => {});
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
    replaceTappa(esito.tappa);
    try {
      await archivioApi.pubblica(esito.tappa, legaName);
      return null;
    } catch {
      // La tappa resta conclusa e una tappa conclusa non si conclude di nuovo: per ripubblicare va riaperta
      return "Tappa conclusa, ma pubblicazione non riuscita: riprova con «Riapri» e poi «Concludi».";
    }
  };

  const riapri = async () => {
    if (!tappa) return;
    updateTappa(tappa.id, { conclusa: false });
    await archivioApi.rimuovi(tappa.id).catch(() => {});
  };

  return {
    user, legaName, tappa,
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
