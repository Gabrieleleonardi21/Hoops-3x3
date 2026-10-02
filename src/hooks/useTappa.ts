import { useAppStore } from "../stores/useAppStore";
import { archivioApi } from "../services/archivioApi";
import { uid } from "../utils/uid";
import * as ops from "../domain/tappaOps";
import type { ModoSorteggio } from "../domain/tappaOps";
import type { EventoGara, Partita, RegSquadra, StatLine, StatSheet, Tappa } from "../types";

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

export function useTappa(id: string | undefined) {
  const { user, legaName, tappe, updateTappa, replaceTappa, removeTappa } = useAppStore();
  const tappa = tappe.find((t) => t.id === id) || null;

  const patch = (p: Partial<Tappa>) => tappa && updateTappa(tappa.id, p);

  /* ── helper di lettura ── */
  const nameOf = (teamId: string) => tappa?.squadre.find((s) => s.id === teamId)?.nome || "?";
  const playersOf = (teamId: string) =>
    (tappa?.squadre.find((s) => s.id === teamId)?.giocatori || []).filter((p) => p.nome.trim());
  const playerNameById = (pid: string) => {
    for (const s of tappa?.squadre || []) {
      const p = (s.giocatori || []).find((x) => x.id === pid);
      if (p) return p.nome;
    }
    return null;
  };
  const teamComplete = (teamId: string) => playersOf(teamId).length >= 3;

  /* ── modifica tappa ── */
  const setInfo = (k: "nome" | "luogo" | "data", v: string) => patch({ [k]: v });
  const setNGironi = (v: string) =>
    patch({ nGironi: Math.max(1, parseInt(v, 10) || 1), gironi: null, partite: [] });
  const setRule = (k: keyof Tappa["regole"], v: string) =>
    tappa && patch({ regole: { ...tappa.regole, [k]: Math.max(1, Number(v) || 1) } });
  const addTeam = () =>
    tappa && tappa.squadre.length < 64 &&
    patch({
      squadre: [...tappa.squadre, { id: uid(), nome: `Squadra ${tappa.squadre.length + 1}`, giocatori: [], rank: "" }],
      gironi: null, partite: [],
    });
  const removeTeam = (teamId: string) =>
    tappa && tappa.squadre.length > 2 &&
    patch({ squadre: tappa.squadre.filter((s) => s.id !== teamId), gironi: null, partite: [] });
  const renameTeam = (teamId: string, nome: string) =>
    tappa && patch({ squadre: tappa.squadre.map((s) => (s.id === teamId ? { ...s, nome } : s)) });
  const setTeamRank = (teamId: string, rank: string) =>
    tappa && patch({ squadre: tappa.squadre.map((s) => (s.id === teamId ? { ...s, rank } : s)) });
  const setTeamWebsite = (teamId: string, website: string) =>
    tappa && patch({ squadre: tappa.squadre.map((s) => (s.id === teamId ? { ...s, website } : s)) });
  const setTeamLogo = (teamId: string, logo: string) =>
    tappa && patch({ squadre: tappa.squadre.map((s) => (s.id === teamId ? { ...s, logo } : s)) });

  /** Collega una squadra tappa alla RegSquadra e ne copia nome, logo, rank, website */
  const applyReg = (teamId: string, reg: RegSquadra) =>
    tappa && patch({
      squadre: tappa.squadre.map((s) =>
        s.id === teamId ? { ...s, regId: reg.id, nome: reg.nome, logo: reg.logo, rank: reg.rank, website: reg.website } : s
      ),
    });

  /** Sincronizza tutte le squadre della tappa con l'anagrafe (usato all'apertura della pagina).
   *  Cerca prima per regId, poi per nome case-insensitive.
   *  Non tocca le squadre con nome placeholder ("Squadra N"). */
  const syncFromAnagrafe = (regs: RegSquadra[]) => {
    if (!tappa) return;
    let changed = false;
    const updated = tappa.squadre.map((s) => {
      if (/^Squadra \d+$/.test(s.nome.trim())) return s; // placeholder, skip
      const reg = (s.regId ? regs.find((r) => r.id === s.regId) : null)
        ?? regs.find((r) => r.nome.toLowerCase() === s.nome.trim().toLowerCase());
      if (!reg) return s;
      // Aggiorna solo se qualcosa è cambiato
      if (s.regId === reg.id && s.logo === reg.logo && s.nome === reg.nome
        && String(s.rank) === String(reg.rank) && s.website === reg.website) return s;
      changed = true;
      return { ...s, regId: reg.id, nome: reg.nome, logo: reg.logo, rank: reg.rank, website: reg.website };
    });
    if (changed) patch({ squadre: updated });
  };

  /* ── roster ── */
  const addPlayer = (teamId: string) =>
    tappa && patch({
      squadre: tappa.squadre.map((s) =>
        s.id === teamId && (s.giocatori || []).length < 4
          ? { ...s, giocatori: [...(s.giocatori || []), { id: uid(), nome: "" }] }
          : s
      ),
    });
  const renamePlayer = (teamId: string, pid: string, nome: string) =>
    tappa && patch({
      squadre: tappa.squadre.map((s) =>
        s.id === teamId
          ? { ...s, giocatori: (s.giocatori || []).map((p) => (p.id === pid ? { ...p, nome } : p)) }
          : s
      ),
    });
  const removePlayer = (teamId: string, pid: string) =>
    tappa && patch({
      squadre: tappa.squadre.map((s) =>
        s.id === teamId ? { ...s, giocatori: (s.giocatori || []).filter((p) => p.id !== pid) } : s
      ),
    });

  /* ── sorteggio: gironi e calendario li costruisce tappaOps ── */
  const sorteggia = (mode: ModoSorteggio): string | null => {
    if (!tappa || !user) return "Tappa non trovata.";
    // Roster e ranking sono obbligatori solo per i registrati: l'ospite fa prove libere
    if (!user.guest) {
      const incomplete = tappa.squadre.filter((s) => !teamComplete(s.id));
      if (incomplete.length)
        return `Non puoi sorteggiare: ogni squadra deve avere almeno 3 giocatori con nome. Roster incompleti: ${incomplete.map((s) => s.nome).join(", ")}.`;
      if (mode === "ranking" && !tappa.squadre.some((s) => Number(s.rank) > 0))
        return "Per il sorteggio per ranking inserisci i punti ranking del circuito nelle card delle squadre.";
    }
    const esito = ops.sorteggia(tappa, mode);
    if (!esito.ok) return esito.errore;
    replaceTappa(esito.tappa);
    return null;
  };

  /* ── punteggi: le regole 3x3 sul punteggio sono in tappaOps, qui i controlli sui roster ── */
  const saveScore = (m: Partita, draft: MatchDraft): string | null => {
    if (!tappa || !user) return "Tappa non trovata.";
    const sa = parseInt(draft.sa, 10);
    const sb = parseInt(draft.sb, 10);
    const esito = ops.registraRisultato(tappa, m.id, { sa, sb, pa: numify(draft.pa), pb: numify(draft.pb) });
    if (!esito.ok) return esito.errore;
    // Per i registrati i punti dei giocatori sono obbligatori e devono dare il totale di squadra
    if (!user.guest) {
      const sides: ["pa" | "pb", string, number][] = [["pa", m.a, sa], ["pb", m.b, sb]];
      for (const [side, teamId, total] of sides) {
        const pls = playersOf(teamId);
        if (pls.length < 3) return `${nameOf(teamId)} non ha un roster valido (minimo 3 giocatori).`;
        const vals = pls.map((p) => parseInt(String(draft[side]?.[p.id]?.pt ?? ""), 10));
        if (vals.some((v) => isNaN(v) || v < 0))
          return `Inserisci i punti (PT) di OGNI giocatore di ${nameOf(teamId)} (anche 0).`;
        const sum = vals.reduce((t, v) => t + v, 0);
        if (sum !== total)
          return `I punti dei giocatori di ${nameOf(teamId)} sommano ${sum}, ma il totale è ${total}.`;
      }
    }
    replaceTappa(esito.tappa);
    return null;
  };

  const reopenScore = (matchId: string) =>
    tappa && patch({ partite: tappa.partite.map((x) => (x.id === matchId ? { ...x, done: false } : x)) });

  /* ── eventi di gara ── */
  const addEvent = (matchId: string, ev: Omit<EventoGara, "id">) =>
    tappa && patch({
      partite: tappa.partite.map((x) =>
        x.id === matchId ? { ...x, eventi: [...(x.eventi || []), { ...ev, id: uid() }] } : x
      ),
    });
  const removeEvent = (matchId: string, evId: string) =>
    tappa && patch({
      partite: tappa.partite.map((x) =>
        x.id === matchId ? { ...x, eventi: (x.eventi || []).filter((e) => e.id !== evId) } : x
      ),
    });

  /* ── video + pubblicazione ── */
  const republish = async (t: Tappa) => {
    if (!t.conclusa || !user || user.guest) return;
    await archivioApi.pubblica(t, legaName).catch(() => {});
  };
  const addVideo = (titolo: string, url: string) => {
    if (!tappa || !url.trim()) return;
    const t2: Tappa = {
      ...tappa,
      video: [...(tappa.video || []), { id: uid(), titolo: titolo.trim() || `Video ${(tappa.video || []).length + 1}`, url: url.trim() }],
    };
    replaceTappa(t2);
    republish(t2);
  };
  const removeVideo = (vid: string) => {
    if (!tappa) return;
    const t2: Tappa = { ...tappa, video: (tappa.video || []).filter((v) => v.id !== vid) };
    replaceTappa(t2);
    republish(t2);
  };

  /* ── conclusione: gironi e fase diretta completi li verifica tappaOps ── */
  const concludi = async (): Promise<string | null> => {
    if (!tappa || !user) return "Tappa non trovata.";
    const esito = ops.concludi(tappa);
    if (!esito.ok) return esito.errore;
    if (user.guest) return "La pubblicazione nell'Archivio circuito richiede un account registrato.";
    replaceTappa(esito.tappa);
    try {
      await archivioApi.pubblica(esito.tappa, legaName);
      return null;
    } catch {
      return "Tappa conclusa, ma pubblicazione non riuscita: riprova da 'Concludi'.";
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
    setInfo, setNGironi, setRule, addTeam, removeTeam, renameTeam, setTeamRank, setTeamWebsite, setTeamLogo, applyReg, syncFromAnagrafe,
    addPlayer, renamePlayer, removePlayer,
    sorteggia, saveScore, reopenScore,
    addEvent, removeEvent,
    addVideo, removeVideo, concludi, riapri,
    removeTappa,
  };
}
