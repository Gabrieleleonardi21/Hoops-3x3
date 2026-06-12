import { shuffle } from "./shuffle";

/** Sorteggio casuale: mescola gli id e li distribuisce nei gironi */
export function buildGironi(teamIds: string[], nGironi: number): string[][] {
  const mixed = shuffle(teamIds);
  const gironi: string[][] = Array.from({ length: nGironi }, () => []);
  mixed.forEach((id, i) => gironi[i % nGironi].push(id));
  return gironi;
}
