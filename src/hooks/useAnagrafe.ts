/** Hook per la gestione dell'anagrafe condivisa: giocatori (reg_g_*) e squadre (reg_s_*)
 *  sono salvati nello storage "shared" (namespace hoop3x3_shared_) e visibili a tutti. */
import { useEffect, useState } from "react";
import { storage } from "../services/storage";
import { uid } from "../utils/uid";
import type { RegGiocatore, RegSquadra, User } from "../types";

/** Carica tutte le voci con un dato prefisso dallo storage condiviso, più recenti prima */
async function fetchList<T>(prefix: string): Promise<T[]> {
  try {
    const r = await storage.list(prefix, true);
    const out: T[] = [];
    for (const key of r.keys) {
      try {
        const item = await storage.get(key, true);
        out.push(JSON.parse(item.value));
      } catch { /* skip */ }
    }
    return out.sort((a: any, b: any) => (b.ts || 0) - (a.ts || 0));
  } catch {
    return [];
  }
}

export function useAnagrafe(user: User) {
  const [giocatori, setGiocatori] = useState<RegGiocatore[] | null>(null);
  const [squadre, setSquadre] = useState<RegSquadra[] | null>(null);

  useEffect(() => {
    fetchList<RegGiocatore>("reg_g_").then(setGiocatori);
    fetchList<RegSquadra>("reg_s_").then(setSquadre);
  }, []);

  const saveGiocatore = async (data: Omit<RegGiocatore, "id" | "autore" | "ts">) => {
    const rec: RegGiocatore = { ...data, id: uid(), autore: user.name, ts: Date.now() };
    await storage.set(`reg_g_${rec.id}`, JSON.stringify(rec), true);
    setGiocatori((l) => [rec, ...(l || [])]);
  };

  const saveSquadra = async (data: Omit<RegSquadra, "id" | "autore" | "ts">) => {
    const rec: RegSquadra = { ...data, id: uid(), autore: user.name, ts: Date.now() };
    await storage.set(`reg_s_${rec.id}`, JSON.stringify(rec), true);
    setSquadre((l) => [rec, ...(l || [])]);
  };

  const removeGiocatore = async (id: string) => {
    await storage.delete(`reg_g_${id}`, true).catch(() => {});
    setGiocatori((l) => (l || []).filter((x) => x.id !== id));
  };

  const removeSquadra = async (id: string) => {
    await storage.delete(`reg_s_${id}`, true).catch(() => {});
    setSquadre((l) => (l || []).filter((x) => x.id !== id));
  };

  return { giocatori, squadre, saveGiocatore, saveSquadra, removeGiocatore, removeSquadra };
}
