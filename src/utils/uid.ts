/** Genera un id casuale a 8 caratteri hex (usa crypto CSPRNG, non Math.random). */
export const uid = (): string => crypto.randomUUID().slice(0, 8);
