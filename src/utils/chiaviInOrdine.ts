/** Il valore con le chiavi degli oggetti in ordine alfabetico: due JSON con le stesse chiavi in un altro ordine danno lo stesso testo */
export function chiaviInOrdine(valore: unknown): unknown {
  if (Array.isArray(valore)) return valore.map(chiaviInOrdine);
  if (valore === null || typeof valore !== "object") return valore;
  const oggetto = valore as Record<string, unknown>;
  return Object.fromEntries(Object.keys(oggetto).sort().map((k) => [k, chiaviInOrdine(oggetto[k])]));
}
