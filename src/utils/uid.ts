/** Genera un UUID v4 (crypto CSPRNG). Il backend accetta solo UUID come id di tappa. */
export const uid = (): string => crypto.randomUUID();

/** true se la stringa è un UUID (gli id delle vecchie versioni erano 8 caratteri hex) */
export const isUuid = (s: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
