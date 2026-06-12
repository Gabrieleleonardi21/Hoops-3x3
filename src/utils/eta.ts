/** Età in anni a partire da una data di nascita ISO, o null se non valida */
export function eta(nascita: string): number | null {
  if (!nascita) return null;
  const d = new Date(nascita);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}
