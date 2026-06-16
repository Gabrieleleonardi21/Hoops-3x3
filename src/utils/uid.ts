/** Genera un id casuale a 7 caratteri base-36 (sufficiente per dati locali,
 *  non adatto come id univoco globale in un database condiviso) */
export const uid = (): string => Math.random().toString(36).slice(2, 9);
