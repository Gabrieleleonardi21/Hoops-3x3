/** Confronto tra due tappe come le confronta il server: serve dopo un 409, per capire se la tappa che il server ha adesso è uno
 *  dei corpi che questo client gli ha mandato senza ricevere risposta (il conflitto è suo) o il lavoro di un altro dispositivo.
 *  Prima si normalizzano tutte e due come le normalizza il server salvando (LegaService.applica nel backend), altrimenti un campo
 *  assente o uno spazio farebbero vedere una differenza che non c'è, e la tappa verrebbe sostituita perdendo i risultati in sospeso. */
import type { Tappa } from "../types";

/** Un testo come lo salva il server: senza spazi ai lati, vuoto se manca */
const testo = (s: unknown): string => {
  if (typeof s !== "string") return "";
  return s.trim();
};

/** I campi della tappa come li salva il server. La versione non c'è: il corpo mandato ha quella vecchia, il server quella salita.
 *  I blocchi di gioco restano come sono (il server li salva così): gli elenchi obbligatori assenti diventano vuoti, quelli
 *  facoltativi (gironi, fase finale) null. Delle regole contano solo le quattro colonne del server. */
function comeSulServer(t: Tappa) {
  const regole: Partial<Tappa["regole"]> = t.regole ?? {};
  return {
    id: t.id,
    nome: testo(t.nome),
    luogo: testo(t.luogo),
    data: testo(t.data),
    nGironi: t.nGironi,
    regole: { target: regole.target, durata: regole.durata, ot: regole.ot, shot: regole.shot },
    squadre: t.squadre ?? [],
    gironi: t.gironi ?? null,
    partite: t.partite ?? [],
    video: t.video ?? [],
    conclusa: t.conclusa === true,
    bracket: t.bracket ?? null,
  };
}

/** Il valore con le chiavi degli oggetti in ordine alfabetico: due JSON con le stesse chiavi in un altro ordine danno lo stesso testo */
function chiaviInOrdine(valore: unknown): unknown {
  if (Array.isArray(valore)) return valore.map(chiaviInOrdine);
  if (valore === null || typeof valore !== "object") return valore;
  const oggetto = valore as Record<string, unknown>;
  return Object.fromEntries(Object.keys(oggetto).sort().map((k) => [k, chiaviInOrdine(oggetto[k])]));
}

/** Il testo con cui si confronta una tappa. Prima passa da JSON, come viaggia verso il server: le chiavi senza valore (undefined)
 *  spariscono, e i blocchi si confrontano come valori, non come testo (ordine delle chiavi e spazi non contano) */
const impronta = (t: Tappa): string => JSON.stringify(chiaviInOrdine(JSON.parse(JSON.stringify(comeSulServer(t)))));

/** true se le due tappe hanno lo stesso contenuto per il server, versione esclusa */
export function stessaTappa(a: Tappa, b: Tappa): boolean {
  return impronta(a) === impronta(b);
}
