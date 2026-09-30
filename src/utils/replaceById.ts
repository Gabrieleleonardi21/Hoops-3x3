/** Restituisce la lista con l'elemento di pari id sostituito da quello nuovo (non muta l'originale) */
export function replaceById<T extends { id: string }>(list: T[], item: T): T[] {
  return list.map((x) => {
    if (x.id === item.id) return item;
    return x;
  });
}
