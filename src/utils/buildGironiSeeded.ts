/** Sorteggio per ranking: ordina per punti e distribuisce a serpentina
 *  (1ª nel girone A, 2ª nel B, ... poi si torna indietro) per bilanciare i gironi. */
export function buildGironiSeeded(
  teams: { id: string; rank: string | number }[],
  nGironi: number
): string[][] {
  const sorted = [...teams]
    .sort((a, b) => (Number(b.rank) || 0) - (Number(a.rank) || 0))
    .map((t) => t.id);
  const gironi: string[][] = Array.from({ length: nGironi }, () => []);
  sorted.forEach((id, i) => {
    const row = Math.floor(i / nGironi);
    const col = i % nGironi;
    const g = row % 2 === 0 ? col : nGironi - 1 - col;
    gironi[g].push(id);
  });
  return gironi;
}
