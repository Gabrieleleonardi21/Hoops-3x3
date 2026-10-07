/** Archivio circuito: snapshot pubblici delle tappe concluse. */
import { api } from "./api";
import type { PubTappa } from "../types";

export const archivioApi = {
  list: () => api<PubTappa[]>("/api/archivio"),
  get: (tappaId: string) => api<PubTappa>(`/api/archivio/${tappaId}`),
  /** Pubblica o ripubblica (upsert sull'id della tappa). Senza corpo: la copia la costruisce il server dalla tappa che ha
   *  salvato, che deve essere già conclusa. Chi chiama deve prima aver salvato tutto: lo fa `pubblica` dello store. */
  pubblica: (tappaId: string) => api<PubTappa>(`/api/archivio/${tappaId}`, { method: "PUT" }),
  rimuovi: (tappaId: string) => api<void>(`/api/archivio/${tappaId}`, { method: "DELETE" }),
};
