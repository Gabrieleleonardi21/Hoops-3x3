/** Dalle bozze lette sulle foto dei fogli (POST /api/coach/foglio) al file di una lega: lo stesso JSON di «Esporta JSON», che la
 *  pagina importa dalla stessa strada di un file (leggiFileLega → importLega). Così una foto non ha regole sue: ciò che l'import
 *  accetta da un file vale anche qui, e la tappa nasce come qualunque altra.
 *  La bozza è una lettura, non un dato sicuro: ogni cosa che non torna (una squadra ripetuta, un punteggio impossibile, gironi che
 *  non coincidono con l'elenco) non blocca l'import ma diventa un dubbio, che la finestra dopo l'import mostra e il Coach può
 *  correggere. Si rifiuta il foglio solo quando non ne può nascere una tappa (meno di 2 squadre o più di 64). */
import { DEFAULT_RULES, MAX_NOME_LEGA, MAX_ROSTER, MAX_SQUADRE, MIN_SQUADRE } from "../constants/rules";
import { MAX_LUOGO, MAX_NOME_TAPPA, registraRisultato } from "../domain/tappaOps";
import { buildMatches } from "./buildMatches";
import { letteraGirone } from "./formato";
import { normalizza } from "./statGiocatori";
import { LETTURA_FALLITA } from "./testi";
import { uid } from "./uid";
import type { BozzaFoglio, SquadraTappa, Tappa } from "../types";

/** Il file pronto per leggiFileLega e, per ogni tappa nell'ordine dei fogli, i dubbi da mostrare; oppure il motivo per cui un
 *  foglio non diventa una tappa (con il nome della sua foto) */
export type EsitoFogli = { ok: true; testo: string; dubbi: string[][] } | { ok: false; errore: string };

const GIRONE_UNICO = "Gironi non letti: tutte le squadre in un girone unico.";
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Una tappa com'è nel file: senza id (l'import ne dà uno nuovo) e senza regole (l'import mette le predefinite) */
type TappaFile = Omit<Tappa, "id" | "regole">;

/** Le squadre del foglio per nome normalizzato: il lettore può scrivere «ALFA» nel calendario e «Alfa» nell'elenco */
type PerNome = Map<string, SquadraTappa>;

/** L'elenco delle squadre: senza nomi vuoti né doppioni (vale la prima), con al massimo MAX_ROSTER giocatori ciascuna (i primi:
 *  il server ne lascia passare 6, la tappa ne tiene 4) */
function squadreLette(bozza: BozzaFoglio, perNome: PerNome, dubbi: string[]): SquadraTappa[] {
  const squadre: SquadraTappa[] = [];
  for (const letta of bozza.squadre) {
    const nome = letta.nome.trim();
    if (!nome) continue;
    if (perNome.has(normalizza(nome))) {
      dubbi.push(`Squadra «${nome}» ripetuta sul foglio: tenuta una volta sola.`);
      continue;
    }
    const nomi = letta.giocatori.map((g) => g.trim()).filter(Boolean);
    if (nomi.length > MAX_ROSTER) dubbi.push(`Squadra «${nome}»: letti ${nomi.length} giocatori, tenuti i primi ${MAX_ROSTER}.`);
    const giocatori = nomi.slice(0, MAX_ROSTER).map((g) => ({ id: uid(), nome: g }));
    const squadra: SquadraTappa = { id: uid(), nome, giocatori, rank: "" };
    perNome.set(normalizza(nome), squadra);
    squadre.push(squadra);
  }
  return squadre;
}

/** I gironi letti, con gli id. Una squadra che il lettore ha visto solo nei gironi è una squadra vera (il nome l'ha letto lì):
 *  entra nell'elenco senza giocatori. Una squadra in due gironi resta nel primo; una dell'elenco che non è in nessun girone va
 *  nel girone più piccolo, così ogni squadra gioca. null se il foglio non ha gironi leggibili. */
function gironiLetti(bozza: BozzaFoglio, squadre: SquadraTappa[], perNome: PerNome, dubbi: string[]): string[][] | null {
  const letti = (bozza.gironi ?? []).filter((g) => g.some((nome) => nome.trim()));
  if (letti.length === 0) return null;
  const gironeDi = new Map<string, number>();
  const gironi = letti.map((girone, gi) => {
    const ids: string[] = [];
    for (const scritto of girone) {
      const nome = scritto.trim();
      if (!nome) continue;
      let squadra = perNome.get(normalizza(nome));
      if (!squadra) {
        squadra = { id: uid(), nome, giocatori: [], rank: "" };
        perNome.set(normalizza(nome), squadra);
        squadre.push(squadra);
        dubbi.push(`Squadra «${nome}» letta solo nei gironi: aggiunta senza giocatori.`);
      }
      const gia = gironeDi.get(squadra.id);
      if (gia === undefined) {
        gironeDi.set(squadra.id, gi);
        ids.push(squadra.id);
      } else if (gia !== gi) {
        dubbi.push(`Squadra «${squadra.nome}» in più gironi: tenuta nel girone ${letteraGirone(gia)}.`);
      }
    }
    return ids;
  });
  for (const squadra of squadre) {
    if (gironeDi.has(squadra.id)) continue;
    let minimo = 0;
    gironi.forEach((g, i) => {
      if (g.length < gironi[minimo].length) minimo = i;
    });
    gironi[minimo].push(squadra.id);
    dubbi.push(`Squadra «${squadra.nome}» non era in nessun girone: messa nel girone ${letteraGirone(minimo)}.`);
  }
  return gironi;
}

/** Copia i risultati letti nelle partite del calendario. Ogni risultato passa da registraRisultato, con le sue regole (interi,
 *  niente pareggi, al massimo target + 4): uno che non le rispetta lascia la partita da giocare, con il dubbio, invece di
 *  entrare in classifica. Una partita senza nessun punteggio è solo da giocare; una coppia scritta due volte vale la prima. */
function risultatiLetti(tappa: Tappa, bozza: BozzaFoglio, perNome: PerNome, dubbi: string[]): Tappa {
  const viste = new Set<string>();
  let esito = tappa;
  for (const p of bozza.partite) {
    if (p.puntiA === null && p.puntiB === null) continue;
    const titolo = `Partita ${p.a.trim()}-${p.b.trim()}`;
    const a = perNome.get(normalizza(p.a));
    const b = perNome.get(normalizza(p.b));
    if (!a || !b) {
      let ignota = p.b;
      if (!a) ignota = p.a;
      dubbi.push(`${titolo} non registrata: la squadra «${ignota.trim()}» non è nell'elenco.`);
      continue;
    }
    const partita = esito.partite.find((m) => (m.a === a.id && m.b === b.id) || (m.a === b.id && m.b === a.id));
    if (!partita) {
      dubbi.push(`${titolo} non registrata: le due squadre non si incontrano nei gironi.`);
      continue;
    }
    if (viste.has(partita.id)) {
      dubbi.push(`${titolo} ripetuta sul foglio: vale la prima.`);
      continue;
    }
    viste.add(partita.id);
    if (p.puntiA === null || p.puntiB === null) {
      dubbi.push(`${titolo} non registrata: manca un punteggio.`);
      continue;
    }
    // Il calendario può avere le squadre al rovescio rispetto al foglio: i punti seguono la squadra
    let punteggio = { sa: p.puntiA, sb: p.puntiB };
    if (partita.a !== a.id) punteggio = { sa: p.puntiB, sb: p.puntiA };
    const registrata = registraRisultato(esito, partita.id, punteggio);
    if (!registrata.ok) {
      dubbi.push(`${titolo} ${p.puntiA}-${p.puntiB} non registrata: ${registrata.errore}`);
      continue;
    }
    esito = registrata.tappa;
  }
  return esito;
}

/** Una tappa del file da una bozza (`n` = numero del foglio, da 1, per il nome di riserva), con i suoi dubbi */
function tappaDaFoglio(bozza: BozzaFoglio, n: number):
  { ok: true; tappa: TappaFile; dubbi: string[] } | { ok: false; errore: string } {
  const dubbi = [...bozza.dubbi];
  const nome = (bozza.nome ?? "").trim().slice(0, MAX_NOME_TAPPA) || `Tappa da foglio ${n}`;
  let data = bozza.data ?? "";
  if (data && !DATA_ISO.test(data)) {
    // Il server manda null una data che non è aaaa-mm-gg (con il suo dubbio): qui si copre il caso in cui arrivi lo stesso
    dubbi.push(`Data non valida sul foglio: ${data}`);
    data = "";
  }
  const perNome: PerNome = new Map();
  const squadre = squadreLette(bozza, perNome, dubbi);
  let gironi = gironiLetti(bozza, squadre, perNome, dubbi);
  if (squadre.length < MIN_SQUADRE) return { ok: false, errore: "Il foglio ha meno di 2 squadre leggibili." };
  if (squadre.length > MAX_SQUADRE) {
    return { ok: false, errore: `Il foglio ha ${squadre.length} squadre: una tappa ne ha al massimo ${MAX_SQUADRE}.` };
  }
  // Risultati senza gironi: tutte le squadre in un girone unico, dove ogni coppia si incontra e nessun risultato si perde.
  // Dalla chat si può sorteggiare di nuovo (perdendo i risultati, con la conferma) o correggere
  if (!gironi && bozza.partite.length > 0) {
    gironi = [squadre.map((s) => s.id)];
    dubbi.push(GIRONE_UNICO);
  }
  // Senza gironi né partite la tappa resta da sorteggiare, con il numero di gironi che proporrebbe il modulo
  let nGironi = 1;
  if (gironi) nGironi = gironi.length;
  else if (squadre.length >= 4) nGironi = 2;
  let partite: Tappa["partite"] = [];
  if (gironi) partite = buildMatches(gironi);
  const base: Tappa = {
    id: uid(), nome, luogo: (bozza.luogo ?? "").trim().slice(0, MAX_LUOGO), data, nGironi,
    regole: { ...DEFAULT_RULES }, squadre, gironi, partite, video: [],
  };
  // Id e regole servono solo a registraRisultato: nel file non vanno (l'import dà id nuovi e le regole predefinite)
  const { id: _id, regole: _regole, ...tappa } = risultatiLetti(base, bozza, perNome, dubbi);
  return { ok: true, tappa, dubbi };
}

/** Il file di una lega nuova con una tappa per foglio, nell'ordine delle foto, e i dubbi di ciascuna. Il nome della lega è quello
 *  della prima tappa (si rinomina dopo). `etichette` sono i nomi delle foto: nominano il foglio rifiutato e, con più foto, aprono
 *  ogni dubbio, così si sa da quale foglio viene. */
export function fileDaFogli(bozze: BozzaFoglio[], etichette: string[]): EsitoFogli {
  const tappe: TappaFile[] = [];
  const dubbi: string[][] = [];
  for (const [i, bozza] of bozze.entries()) {
    const esito = tappaDaFoglio(bozza, i + 1);
    if (!esito.ok) return { ok: false, errore: LETTURA_FALLITA(etichette[i], esito.errore) };
    tappe.push(esito.tappa);
    let suoi = esito.dubbi;
    if (bozze.length > 1) suoi = suoi.map((d) => `${etichette[i]}: ${d}`);
    dubbi.push(suoi);
  }
  const nome = (tappe[0]?.nome ?? "").slice(0, MAX_NOME_LEGA);
  return { ok: true, testo: JSON.stringify({ nome, tappe }), dubbi };
}
