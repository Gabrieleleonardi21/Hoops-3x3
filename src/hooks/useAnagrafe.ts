/** Hook per l'anagrafe condivisa del circuito (giocatori e squadre) sul backend.
 *  Lettura pubblica (anche ospite); scrittura solo con account: il server assegna
 *  id, autore e timestamp e rifiuta (403) le modifiche di chi non è autore o ADMIN. */
import { useEffect, useState } from "react";
import { anagrafeApi, toGiocatoreInput, toSquadraInput } from "../services/anagrafeApi";
import type { RegGiocatore, RegSquadra } from "../types";

export function useAnagrafe() {
  const [giocatori, setGiocatori] = useState<RegGiocatore[] | null>(null);
  const [squadre, setSquadre] = useState<RegSquadra[] | null>(null);

  useEffect(() => {
    anagrafeApi.listGiocatori().then(setGiocatori).catch(() => setGiocatori([]));
    anagrafeApi.listSquadre().then(setSquadre).catch(() => setSquadre([]));
  }, []);

  const saveGiocatore = async (data: Omit<RegGiocatore, "id" | "autore" | "ts">) => {
    const rec = await anagrafeApi.createGiocatore(data);
    setGiocatori((l) => [rec, ...(l || [])]);
  };

  const saveSquadra = async (data: Omit<RegSquadra, "id" | "autore" | "ts">): Promise<RegSquadra> => {
    const rec = await anagrafeApi.createSquadra(data);
    setSquadre((l) => [rec, ...(l || [])]);
    return rec;
  };

  const removeGiocatore = async (id: string) => {
    await anagrafeApi.removeGiocatore(id);
    setGiocatori((l) => (l || []).filter((x) => x.id !== id));
    // Il server lo toglie anche dai roster: allineo la copia locale delle squadre
    setSquadre((l) => (l || []).map((s) => ({ ...s, roster: s.roster.filter((g) => g !== id) })));
  };

  /** Sovrascrive un giocatore esistente (id e autore restano, il server aggiorna ts) */
  const updateGiocatore = async (updated: RegGiocatore) => {
    const rec = await anagrafeApi.updateGiocatore(updated.id, toGiocatoreInput(updated));
    setGiocatori((l) => (l || []).map((x) => (x.id === rec.id ? rec : x)));
  };

  const removeSquadra = async (id: string) => {
    await anagrafeApi.removeSquadra(id);
    setSquadre((l) => (l || []).filter((x) => x.id !== id));
  };

  /** Sovrascrive una squadra esistente (roster compreso) */
  const updateSquadra = async (updated: RegSquadra) => {
    const rec = await anagrafeApi.updateSquadra(updated.id, toSquadraInput(updated));
    setSquadre((l) => (l || []).map((x) => (x.id === rec.id ? rec : x)));
  };

  return { giocatori, squadre, saveGiocatore, saveSquadra, removeGiocatore, removeSquadra, updateSquadra, updateGiocatore };
}
