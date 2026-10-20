/** La ricerca per nome di tappe e squadre del Coach, con una regola sola: il nome esatto; poi il nome con un dettaglio tra parentesi
 *  («Roma Open (26/06/2026)», «Roma (girone B)», «Roma (Torino)»); poi una parte del nome, se corrisponde a un elemento solo.
 *  Il modulo è puro: lo usano il Coach (strumentiComuni, toolHandlers) e il dominio (simulazione), e per questo importa solo
 *  normalizza (identita) e pulisci (buildCoachContext), che non dipendono né dallo store né dal Coach. */
import { normalizza } from "./identita";
import { pulisci } from "./buildCoachContext";

/** Come si distingue un elemento dalle sue omonime: `descrittori` sono i valori con cui un dettaglio tra parentesi può
 *  corrispondere (data, luogo, girone…), `descrivi` è la frase che li elenca quando la scelta è ambigua. Le parti che
 *  descrivi mette nella frase devono passare da pulisci: è testo scritto dagli utenti */
export interface Dettagli<T> {
  descrittori: (e: T) => string[];
  descrivi: (e: T) => string;
}

/** Il nome con il dettaglio tra parentesi in fondo («Roma Open (26/06/2026)»): la parte prima e il dettaglio. Senza parentesi, o con
 *  parentesi vuote, il dettaglio è null e il nome resta intero (un nome può contenere parentesi, come «Roma (Torino)» in anagrafe) */
export function separaDettaglio(nome: string): { base: string; dettaglio: string | null } {
  // Solo l'ultimo gruppo di parentesi, senza parentesi dentro, e in fondo al nome
  const m = /^(.*\S)\s*\(([^()]+)\)\s*$/.exec(nome);
  if (!m || !m[2].trim()) return { base: nome, dettaglio: null };
  return { base: m[1], dettaglio: m[2].trim() };
}

/** L'errore quando più elementi hanno lo stesso nome esatto: li elenca e dice come scegliere. `esempio` è il nome con un dettaglio
 *  vero, se c'è; senza, si chiede di rinominarne una */
function erroreOmonimi(descrizioni: string[], nome: string, plurale: string, esempio: string | null): Error {
  let suggerimento = "Rinomina una delle due dalla pagina della tappa.";
  if (esempio) suggerimento = `Scrivi il nome con un dettaglio tra parentesi, per esempio "${esempio}".`;
  return new Error(`Più ${plurale} si chiamano "${pulisci(nome)}": ${descrizioni.join("; ")}. ${suggerimento}`);
}

/** L'errore quando il dettaglio tra parentesi non sceglie una sola voce: «piu» dice se nessuna o più d'una corrisponde */
function erroreDettaglio(base: string, dettaglio: string, elenco: string[], piu: boolean): Error {
  const opzioni = elenco.join("; ");
  if (piu) return new Error(`Più "${pulisci(base)}" corrispondono a "(${pulisci(dettaglio)})": ${opzioni}. Scrivi un dettaglio più preciso.`);
  return new Error(`Nessuna "${pulisci(base)}" corrisponde a "(${pulisci(dettaglio)})": le opzioni sono ${opzioni}.`);
}

/** Trova un elemento per nome con la regola del Coach (vedi in testa). `plurale` completa le frasi d'errore («Più tappe…»).
 *  Con più elementi che la regola non distingue lancia un errore che li elenca: scegliere il primo metterebbe un risultato
 *  sulla tappa sbagliata, o una modifica sulla squadra sbagliata dell'anagrafe condivisa, senza che nessuno se ne accorga */
export function trovaPerNome<T>(
  elementi: T[], nome: string, nomeDi: (e: T) => string, plurale: string, dettagli?: Dettagli<T>,
): T | null {
  // Senza dettagli si elencano i soli nomi, tra virgolette
  const descrivi = (e: T) => {
    if (dettagli) return dettagli.descrivi(e);
    return `"${pulisci(nomeDi(e))}"`;
  };
  const cercato = normalizza(nome);

  // 1) Il nome esatto, per intero: vince anche se il nome contiene parentesi («Roma (Torino)»)
  const esatti = elementi.filter((e) => normalizza(nomeDi(e)) === cercato);
  if (esatti.length === 1) return esatti[0];
  if (esatti.length > 1) {
    // L'esempio usa il primo descrittore del primo elemento, così il suggerimento è un nome che funziona davvero
    const primo = dettagli?.descrittori(esatti[0]).find((d) => d.trim());
    let esempio: string | null = null;
    if (primo) esempio = `${nome} (${pulisci(primo)})`;
    throw erroreOmonimi(esatti.map(descrivi), nome, plurale, esempio);
  }

  // 2) Il nome senza il dettaglio tra parentesi, e il dettaglio che sceglie fra le sue omonime
  const { base, dettaglio } = separaDettaglio(nome);
  if (dettaglio !== null) {
    const candidati = elementi.filter((e) => normalizza(nomeDi(e)) === normalizza(base));
    if (candidati.length > 0) {
      // «includes»: «girone B» sta in «girone B», «26/06/2026» in una data, «Milano» in un luogo; senza maiuscole né accenti
      const cercatoDettaglio = normalizza(dettaglio);
      const scelti = candidati.filter((e) => (dettagli?.descrittori(e) ?? []).some((d) => normalizza(d).includes(cercatoDettaglio)));
      if (scelti.length === 1) return scelti[0];
      if (scelti.length === 0) throw erroreDettaglio(base, dettaglio, candidati.map(descrivi), false);
      throw erroreDettaglio(base, dettaglio, scelti.map(descrivi), true);
    }
  }

  // 3) Una parte del nome, se corrisponde a un elemento solo
  const simili = elementi.filter((e) => normalizza(nomeDi(e)).includes(cercato));
  if (simili.length > 1) {
    const nomi = simili.map((e) => `"${pulisci(nomeDi(e))}"`).join(", ");
    throw new Error(`Più ${plurale} corrispondono a "${pulisci(nome)}": ${nomi}. Indica il nome completo.`);
  }
  return simili[0] ?? null;
}
