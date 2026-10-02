/** Archivio circuito: snapshot pubblici delle tappe concluse. */
import { api } from "./api";
import type { PubTappa, Tappa } from "../types";

export const archivioApi = {
  list: () => api<PubTappa[]>("/api/archivio"),
  get: (tappaId: string) => api<PubTappa>(`/api/archivio/${tappaId}`),
  /** Pubblica o ripubblica (upsert sull'id della tappa) */
  pubblica: (tappa: Tappa, lega: string) =>
    api<PubTappa>("/api/archivio", { method: "PUT", body: { tappa, lega } }),
  rimuovi: (tappaId: string) => api<void>(`/api/archivio/${tappaId}`, { method: "DELETE" }),
};
