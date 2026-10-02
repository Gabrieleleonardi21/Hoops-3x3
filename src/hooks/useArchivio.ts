import { useEffect, useState } from "react";
import { archivioApi } from "../services/archivioApi";
import type { PubTappa } from "../types";

/** Carica le tappe pubblicate nell'archivio circuito (endpoint pubblico, più recenti prima) */
export function useArchivio() {
  const [pubs, setPubs] = useState<PubTappa[] | null>(null);

  const reload = async () => {
    try {
      setPubs(await archivioApi.list());
    } catch {
      setPubs([]);
    }
  };

  useEffect(() => { reload(); }, []);
  return { pubs, reload };
}
