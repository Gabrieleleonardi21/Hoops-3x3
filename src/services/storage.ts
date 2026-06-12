/** Wrapper di persistenza con la stessa API di window.storage degli artifact
 *  di claude.ai, implementata su localStorage. I dati "shared" (anagrafe,
 *  archivio) sono in un namespace separato: senza un backend restano locali
 *  al browser. Per condivisione reale, sostituire con chiamate a un'API. */
const NS = "hoop3x3_";
const NS_SHARED = "hoop3x3_shared_";

const k = (key: string, shared?: boolean) => (shared ? NS_SHARED : NS) + key;

export const storage = {
  async get(key: string, shared?: boolean): Promise<{ key: string; value: string }> {
    const v = localStorage.getItem(k(key, shared));
    if (v === null) throw new Error("chiave non trovata: " + key);
    return { key, value: v };
  },
  async set(key: string, value: string, shared?: boolean): Promise<void> {
    localStorage.setItem(k(key, shared), value);
  },
  async delete(key: string, shared?: boolean): Promise<void> {
    localStorage.removeItem(k(key, shared));
  },
  async list(prefix: string, shared?: boolean): Promise<{ keys: string[] }> {
    const ns = shared ? NS_SHARED : NS;
    const base = ns + (prefix || "");
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(base)) keys.push(key.slice(ns.length));
    }
    return { keys };
  },
};
