/** Formatta un voto/media con virgola italiana (es. 7.5 → "7,5") */
export const fmtVote = (v: number): string => v.toString().replace(".", ",");
