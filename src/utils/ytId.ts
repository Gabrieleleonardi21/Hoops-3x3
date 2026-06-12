/** Estrae l'id di un video YouTube da un link (watch, youtu.be, shorts, embed) */
export function ytId(url: string): string | null {
  const m = String(url).match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}
