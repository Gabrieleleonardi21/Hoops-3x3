/** Genera un UUID v4 (crypto CSPRNG). Il backend accetta solo UUID come id di tappa.
 *  `crypto.randomUUID` esiste solo in un contesto sicuro (https o localhost): aprendo l'app da un telefono in rete locale, su
 *  http, manca e ogni creazione andrebbe in errore. `getRandomValues` invece c'è sempre: da lì si costruisce lo stesso UUID. */
export function uid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const byte = crypto.getRandomValues(new Uint8Array(16));
  byte[6] = (byte[6] & 0x0f) | 0x40; // versione 4
  byte[8] = (byte[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = Array.from(byte, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** true se la stringa è un UUID (gli id delle vecchie versioni erano 8 caratteri hex) */
export const isUuid = (s: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
