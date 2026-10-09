/** Anagrafe condivisa del circuito: lettura pubblica, scrittura con account (autore o ADMIN). */
import { api } from "./api";
import type { RegGiocatore, RegSquadra } from "../types";

/** Campi compilabili (id, autore, autoreId e ts li assegna il server). `versione` resta: la PUT la rimanda per dire su quale versione
 *  si basano le modifiche; se la voce non ce l'ha (server precedente) è undefined e JSON.stringify la lascia fuori */
export type GiocatoreInput = Omit<RegGiocatore, "id" | "autore" | "autoreId" | "ts">;
export type SquadraInput = Omit<RegSquadra, "id" | "autore" | "autoreId" | "ts">;

export const anagrafeApi = {
  listGiocatori: () => api<RegGiocatore[]>("/api/anagrafe/giocatori"),
  createGiocatore: (data: GiocatoreInput) =>
    api<RegGiocatore>("/api/anagrafe/giocatori", { method: "POST", body: data }),
  updateGiocatore: (id: string, data: GiocatoreInput) =>
    api<RegGiocatore>(`/api/anagrafe/giocatori/${id}`, { method: "PUT", body: data }),
  removeGiocatore: (id: string) => api<void>(`/api/anagrafe/giocatori/${id}`, { method: "DELETE" }),

  listSquadre: () => api<RegSquadra[]>("/api/anagrafe/squadre"),
  createSquadra: (data: SquadraInput) =>
    api<RegSquadra>("/api/anagrafe/squadre", { method: "POST", body: data }),
  updateSquadra: (id: string, data: SquadraInput) =>
    api<RegSquadra>(`/api/anagrafe/squadre/${id}`, { method: "PUT", body: data }),
  removeSquadra: (id: string) => api<void>(`/api/anagrafe/squadre/${id}`, { method: "DELETE" }),
};

/** Toglie id/autore/autoreId/ts da un record completo per rimandarlo in modifica */
export function toSquadraInput(s: RegSquadra): SquadraInput {
  const { id: _id, autore: _autore, autoreId: _autoreId, ts: _ts, ...rest } = s;
  return rest;
}

export function toGiocatoreInput(g: RegGiocatore): GiocatoreInput {
  const { id: _id, autore: _autore, autoreId: _autoreId, ts: _ts, ...rest } = g;
  return rest;
}
