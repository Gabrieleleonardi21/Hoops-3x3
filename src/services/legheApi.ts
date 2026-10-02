/** Chiamate REST per leghe e tappe dell'utente registrato (l'ospite usa localStorage). */
import { api } from "./api";
import type { LegaMeta, Tappa } from "../types";

export interface LegaDettaglio {
  id: string;
  nome: string;
  tappe: Tappa[];
}

export const legheApi = {
  list: () => api<LegaMeta[]>("/api/leghe"),
  /** `tappe` solo per l'import da file JSON */
  create: (nome: string, tappe?: Tappa[]) =>
    api<LegaMeta>("/api/leghe", { method: "POST", body: { nome, tappe } }),
  get: (id: string) => api<LegaDettaglio>(`/api/leghe/${id}`),
  rename: (id: string, nome: string) =>
    api<LegaMeta>(`/api/leghe/${id}`, { method: "PATCH", body: { nome } }),
  remove: (id: string) => api<void>(`/api/leghe/${id}`, { method: "DELETE" }),

  /** keepalive per il flush in chiusura pagina di una tappa non ancora creata sul server */
  addTappa: (legaId: string, t: Tappa, keepalive = false) =>
    api<Tappa>(`/api/leghe/${legaId}/tappe`, { method: "POST", body: t, keepalive }),
  /** Sostituzione completa; keepalive per il flush in chiusura pagina */
  putTappa: (t: Tappa, keepalive = false) =>
    api<Tappa>(`/api/tappe/${t.id}`, { method: "PUT", body: t, keepalive }),
  removeTappa: (id: string) => api<void>(`/api/tappe/${id}`, { method: "DELETE" }),
};
