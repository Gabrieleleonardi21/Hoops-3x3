import { useEffect, useState } from "react";
import { storage } from "../services/storage";
import type { PubTappa } from "../types";

/** Carica le tappe pubblicate dall'archivio condiviso */
export function useArchivio() {
  const [pubs, setPubs] = useState<PubTappa[] | null>(null);

  const reload = async () => {
    try {
      const r = await storage.list("pub_", true);
      const out: PubTappa[] = [];
      for (const key of r.keys) {
        try {
          const item = await storage.get(key, true);
          out.push(JSON.parse(item.value));
        } catch { /* voce corrotta: la saltiamo */ }
      }
      out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setPubs(out);
    } catch {
      setPubs([]);
    }
  };

  useEffect(() => { reload(); }, []);
  return { pubs, reload };
}
