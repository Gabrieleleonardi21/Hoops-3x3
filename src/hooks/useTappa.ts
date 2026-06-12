import { useAppStore } from "../stores/useAppStore";
import { storage } from "../services/storage";
import { uid } from "../utils/uid";
import { buildGironi } from "../utils/buildGironi";
import { buildGironiSeeded } from "../utils/buildGironiSeeded";
import { buildMatches } from "../utils/buildMatches";
import type { EventoGara, Partita, StatLine, StatSheet, Tappa } from "../types";

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

  /* ── sorteggio ── */
  const sorteggia = (mode: "casuale" | "ranking"): string | null => {
    if (!tappa || !user) return "Tappa non trovata.";
    if (!user.guest) {
      const incomplete = tappa.squadre.filter((s) => !teamComplete(s.id));
      if (incomplete.length)
        return `Non puoi sorteggiare: ogni squadra deve avere almeno 3 giocatori con nome. Roster incompleti: ${incomplete.map((s) => s.nome).join(", ")}.`;
      if (mode === "ranking" && !tappa.squadre.some((s) => Number(s.rank) > 0))
        return "Per il sorteggio per ranking inserisci i punti ranking del circuito nelle card delle squadre.";
    }
    const gironi =
      mode === "ranking"
        ? buildGironiSeeded(tappa.squadre, tappa.nGironi)
        : buildGironi(tappa.squadre.map((s) => s.id), tappa.nGironi);
    patch({ gironi, partite: buildMatches(gironi) });
    return null;
  };

  /* ── punteggi: valida secondo le regole 3x3 e salva ── */
  const saveScore = (m: Partita, draft: MatchDraft): string | null => {
    if (!tappa || !user) return "Tappa non trovata.";
    const sa = parseInt(draft.sa, 10);
    const sb = parseInt(draft.sb, 10);
    if (isNaN(sa) || isNaN(sb) || sa < 0 || sb < 0) return "Inserisci entrambi i punteggi.";
    if (sa === sb)
      return `Nel 3x3 non esistono pareggi: si gioca il supplementare (primo a ${tappa.regole.ot} punti).`;
    if (Math.max(sa, sb) > tappa.regole.target + 4)
      return `Punteggio insolito: nel 3x3 la gara finisce a ${tappa.regole.target} punti (o allo scadere dei ${tappa.regole.durata}').`;
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
    patch({
      partite: tappa.partite.map((x) =>
        x.id === m.id ? { ...x, sa, sb, pa: numify(draft.pa), pb: numify(draft.pb), done: true } : x
      ),
    });
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
    await storage
      .set(`pub_${t.id}`, JSON.stringify({ tappa: t, lega: legaName, autore: user.name, ts: Date.now() }), true)
      .catch(() => {});
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

  const concludi = async (): Promise<string | null> => {
    if (!tappa || !user) return "Tappa non trovata.";
    if (!tappa.gironi || !tappa.partite.length) return "Sorteggia i gironi e registra le partite prima di concludere.";
    const left = tappa.partite.filter((m) => !m.done).length;
    if (left > 0) return `Mancano ancora ${left} partite da registrare.`;
    if (user.guest) return "La pubblicazione nell'Archivio circuito richiede un account registrato.";
    const t2: Tappa = { ...tappa, conclusa: true };
    replaceTappa(t2);
    try {
      await storage.set(`pub_${tappa.id}`, JSON.stringify({ tappa: t2, lega: legaName, autore: user.name, ts: Date.now() }), true);
      return null;
    } catch {
      return "Tappa conclusa, ma pubblicazione non riuscita: riprova da 'Concludi'.";
    }
  };

  const riapri = async () => {
    if (!tappa) return;
    updateTappa(tappa.id, { conclusa: false });
    await storage.delete(`pub_${tappa.id}`, true).catch(() => {});
  };

  return {
    user, legaName, tappa,
    nameOf, playersOf, playerNameById, teamComplete,
    setInfo, setNGironi, setRule, addTeam, removeTeam, renameTeam, setTeamRank,
    addPlayer, renamePlayer, removePlayer,
    sorteggia, saveScore, reopenScore,
    addEvent, removeEvent,
    addVideo, removeVideo, concludi, riapri,
    removeTappa,
  };
}
