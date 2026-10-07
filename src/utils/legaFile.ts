/** File di una lega: come si scrive nell'export e come si legge, e si controlla, nell'import.
 *  Il file è input non fidato (un backup, un'altra versione dell'app, o scritto a mano): prima di toccare lo store si
 *  verifica con zod che abbia la forma dei tipi di src/types. Una tappa incompleta non deve arrivare né nel browser
 *  dell'ospite, dove farebbe uscire la pagina bianca a ogni ricarica, né al server, che la rifiuterebbe con un 400.
 *  Il file si legge una volta sola: i campi che l'app non conosce si scartano, i campi che possono mancare prendono
 *  il loro valore predefinito e gli id delle tappe sono sempre nuovi.
 *  Gli stessi campi controllano anche la lega che l'ospite ha nel browser (leggiLegaSalvata), ma senza i limiti del server:
 *  è il caso di chi in passato ha importato un file incompleto, prima che l'import lo controllasse. */
import { z } from "zod";
import { DEFAULT_RULES } from "../constants/rules";
import { MAX_GIRONI, erroreTestiTappa } from "../domain/tappaOps";
import { uid } from "./uid";
import type { Lega, Tappa } from "../types";

/** Esito della lettura: la lega pronta da importare, oppure il motivo per cui il file non va (senza il prefisso
 *  «Import non riuscito», che lo aggiunge la pagina) */
export type EsitoLettura = { ok: true; lega: Lega } | { ok: false; errore: string };

const ko = (errore: string): EsitoLettura => ({ ok: false, errore });

/** Limiti del server per l'import (NuovaLegaDTO): nome della lega e numero di tappe. Quelli di nome, luogo e data di
 *  ogni tappa (TappaDTO) sono in tappaOps, gli stessi dei form: il numero sta in un posto solo. */
const MAX_NOME_LEGA = 120;
const MAX_TAPPE = 100;

/* ── Forma del file: uno schema per ogni tipo di src/types ──
 *  Un campo senza valore predefinito è obbligatorio: chi lo perde non ha un valore neutro da mettere al suo posto (gli id
 *  a cui si riferiscono gironi e partite, le squadre di una tappa). */

const stringa = z.string();
const numero = z.number();
const statistica = numero.optional();

const giocatoreSchema = z.object({ id: stringa, nome: stringa });

const squadraSchema = z.object({
  id: stringa,
  nome: stringa,
  giocatori: z.array(giocatoreSchema).default([]),
  rank: z.union([stringa, numero]).default(""),
  regId: stringa.optional(),
  logo: stringa.optional(),
  website: stringa.optional(),
  instagram: stringa.optional(),
});

const statisticheSchema = z.object({
  pt: statistica, rb: statistica, as: statistica, ru: statistica, st: statistica, pe: statistica, fa: statistica,
});

/** Scheda di una squadra in una partita: id del giocatore → statistiche, oppure solo i punti come numero (formato vecchio) */
const schedaSchema = z.record(z.union([numero, statisticheSchema]));

const eventoSchema = z.object({
  id: stringa,
  tipo: stringa,
  teamId: stringa,
  pid: stringa.nullable().default(null),
  min: stringa.default(""),
  nota: stringa.default(""),
});

const partitaSchema = z.object({
  id: stringa,
  g: numero,
  a: stringa,
  b: stringa,
  sa: numero,
  sb: numero,
  done: z.boolean(),
  ts: numero.optional(),
  pa: schedaSchema.optional(),
  pb: schedaSchema.optional(),
  eventi: z.array(eventoSchema).optional(),
});

const matchTabelloneSchema = z.object({
  id: stringa,
  label: stringa,
  squadraA: stringa.nullable(),
  squadraB: stringa.nullable(),
  pA: numero,
  pB: numero,
  done: z.boolean(),
  bye: z.boolean().optional(),
});

const videoSchema = z.object({ id: stringa, titolo: stringa, url: stringa });

/** Una regola di gara: intero da 1 in su come in RegoleDTO (@Min(1)); se manca vale quella predefinita */
const regola = (predefinita: number) =>
  numero.refine((n) => Number.isInteger(n) && n >= 1, "deve essere un numero intero da 1 in su").default(predefinita);

const regoleSchema = z.object({
  target: regola(DEFAULT_RULES.target),
  durata: regola(DEFAULT_RULES.durata),
  ot: regola(DEFAULT_RULES.ot),
  shot: regola(DEFAULT_RULES.shot),
}).default(DEFAULT_RULES);

/** Numero di gironi: intero da 1 a MAX_GIRONI, come `int nGironi` di TappaDTO (@Min(1) @Max(32)); se manca vale 1. Non conta le
 *  squadre: una tappa fatta con le regole delle versioni precedenti può avere più gironi di metà delle squadre e il server la
 *  accetta. Un numero non intero, come il 2.5 che le versioni vecchie lasciavano scrivere (FD-9), non è un intero valido per
 *  il server e tornerebbe a rompere il sorteggio dell'ospite. */
const nGironiSchema = numero
  .refine((n) => Number.isInteger(n) && n >= 1 && n <= MAX_GIRONI, `deve essere un numero intero da 1 a ${MAX_GIRONI}`)
  .default(1);

/** I campi di una tappa senza l'id: la forma che l'app usa, uguale per il file e per il browser dell'ospite. */
const tappaCampi = z.object({
  nome: stringa.trim().min(1, "non può essere vuoto"),
  luogo: stringa.trim().default(""),
  data: stringa.trim().default(""),
  nGironi: nGironiSchema,
  regole: regoleSchema,
  squadre: z.array(squadraSchema),
  gironi: z.array(z.array(stringa)).nullable().default(null),
  partite: z.array(partitaSchema).default([]),
  video: z.array(videoSchema).default([]),
  conclusa: z.boolean().optional(),
  // Il server manda null per una tappa senza fase finale; nell'app, se la fase finale non c'è, il campo è assente
  bracket: z.array(matchTabelloneSchema).nullish().transform((b) => b ?? undefined),
});

/** Tappa di un file, con in più i limiti del server. L'id non c'è: ogni tappa importata ne riceve uno nuovo in leggiFileLega.
 *  Il tipo dichiarato fa fallire la compilazione se in src/types un campo obbligatorio cambia e lo schema no; un campo
 *  facoltativo nuovo invece va aggiunto in tappaCampi a mano, altrimenti l'import lo scarterebbe (il test dell'export
 *  completo in legaFile.test.ts lo segnala). L'unico campo che resta fuori apposta è `versione`: è uno stato del server, non
 *  entra nel file (testoFileLega) e una versione scritta nel file si scarta. */
const tappaSchema: z.ZodType<Omit<Tappa, "id">, z.ZodTypeDef, unknown> = tappaCampi
  .superRefine((t, ctx) => {
    // Solo i limiti dei campi del server (nome, luogo e data, in tappaOps): oltre quelli la tappa sarebbe rifiutata a ogni
    // salvataggio. Non si applicano i limiti di creazione (da 2 a 64 squadre, gironi tra 1 e metà delle squadre): l'import è
    // un ripristino e deve accettare ciò che accetta il server, anche una tappa fatta con le regole delle versioni precedenti
    const motivo = erroreTestiTappa(t);
    if (motivo) ctx.addIssue({ code: z.ZodIssueCode.custom, message: motivo });
  });

/** Tappa nel browser dell'ospite: gli stessi campi, con il loro id e senza i limiti del server. L'ospite non ha un server che
 *  li faccia valere, e una tappa con un valore fuori limite si disegna lo stesso: a scartarla conta solo la forma che la
 *  romperebbe, cioè il tipo sbagliato o un campo che manca. Per questo tre campi di tappaCampi, che portano un limite del
 *  server, qui tengono solo il tipo:
 *  - `nome` può essere vuoto (@NotBlank del server): una tappa senza nome si disegna, e gli avvisi la chiamano per numero;
 *  - `nGironi` può essere non intero o fuori da 1-32 (@Min/@Max di TappaDTO, il caso FD-9 delle versioni vecchie): compare solo
 *    come testo, il sorteggio risponde con un messaggio e si corregge dal pannello «Modifica»;
 *  - le regole possono essere 0 o non intere (@Min(1) di RegoleDTO): si correggono dal pannello «Regole della tappa».
 *  Perderle scartando la tappa vorrebbe dire perdere squadre, roster e risultati di chi ha i dati vecchi. */
const regolaOspite = (predefinita: number) => numero.default(predefinita);

const tappaSalvataSchema: z.ZodType<Tappa, z.ZodTypeDef, unknown> = tappaCampi.extend({
  id: stringa,
  nome: stringa.trim(),
  nGironi: numero.default(1),
  regole: z.object({
    target: regolaOspite(DEFAULT_RULES.target),
    durata: regolaOspite(DEFAULT_RULES.durata),
    ot: regolaOspite(DEFAULT_RULES.ot),
    shot: regolaOspite(DEFAULT_RULES.shot),
  }).default(DEFAULT_RULES),
});

const fileSchema = z.object({
  // Senza un nome valido (assente, null o vuoto) la lega prende quello del file; i limiti si contano senza gli spazi ai lati
  nome: stringa.trim().max(MAX_NOME_LEGA, `il nome della lega può avere al massimo ${MAX_NOME_LEGA} caratteri`).nullish(),
  tappe: z.array(tappaSchema).max(MAX_TAPPE, `un file può avere al massimo ${MAX_TAPPE} tappe`),
});

/* ── Messaggi: dicono dove sta il problema, con le parole dei messaggi del server (tappe[0].squadre) ── */

const TIPI: Record<string, string> = {
  string: "un testo", number: "un numero", boolean: "vero o falso", array: "un elenco", object: "un oggetto",
};

/** Il punto del file come lo scrive il server: tappe[0].squadre[1].id */
function percorso(chiavi: (string | number)[]): string {
  let punto = "";
  for (const chiave of chiavi) {
    if (typeof chiave === "number") {
      punto += `[${chiave}]`;
      continue;
    }
    if (punto) punto += ".";
    punto += chiave;
  }
  return punto;
}

/** Un problema trovato da zod, in italiano e con il punto del file in cui sta */
function descrivi(problema: z.ZodIssue): string {
  const chiavi = problema.path;
  // Senza percorso il problema è il file stesso: non è un oggetto
  if (chiavi.length === 0) return "il file deve contenere un oggetto con i campi «nome» e «tappe»";
  if (problema.code === "invalid_type" && problema.received === "undefined") {
    // Campo mancante: il punto da indicare è l'oggetto che lo dovrebbe contenere
    const manca = `manca il campo «${chiavi[chiavi.length - 1]}»`;
    const dove = percorso(chiavi.slice(0, -1));
    if (!dove) return manca;
    return `${dove}: ${manca}`;
  }
  if (problema.code === "invalid_type") return `${percorso(chiavi)}: deve essere ${TIPI[problema.expected] ?? "del tipo giusto"}`;
  if (problema.code === "invalid_union") return `${percorso(chiavi)}: formato non valido`;
  // Gli altri problemi (limiti, regole, tappa) portano già il loro messaggio, scritto nello schema o in tappaOps
  return `${percorso(chiavi)}: ${problema.message}`;
}

/* ── Lettura e scrittura ── */

/** Legge il testo di un file di lega. Rifiuta ciò che non è una lega dicendo il primo problema trovato; altrimenti
 *  restituisce nome e tappe pronti per importLega, con gli id delle tappe sempre nuovi: gli originali possono essere di una
 *  lega che esiste ancora (il server risponderebbe 409 al ripristino) o ripetuti nel file.
 *  @param nomeFile nome del file scelto: dà il nome alla lega se il file non ne ha uno */
export function leggiFileLega(testo: string, nomeFile: string): EsitoLettura {
  let dati: unknown;
  try {
    dati = JSON.parse(testo);
  } catch {
    return ko("il file non è un JSON valido");
  }
  const letto = fileSchema.safeParse(dati);
  if (!letto.success) return ko(descrivi(letto.error.issues[0]));
  const nome = letto.data.nome || nomeFile.replace(/\.json$/i, "").slice(0, MAX_NOME_LEGA);
  const tappe = letto.data.tappe.map((t) => ({ ...t, id: uid() }));
  return { ok: true, lega: { nome, tappe } };
}

/** Il contenuto del file di export: nome e tappe, rientrati per essere leggibili. Senza la versione delle tappe: è uno stato del
 *  server, che non vale per una lega importata (la POST la fa ripartire da 0), e l'import la scarterebbe comunque */
export const testoFileLega = (nome: string, tappe: Tappa[]): string =>
  JSON.stringify({ nome, tappe: tappe.map(({ versione: _versione, ...t }) => t) }, null, 2);

/** Lega com'è nel browser dell'ospite, controllata: le tappe valide e, se qualcuna non lo era, l'avviso da mostrare */
export interface LegaSalvata {
  lega: Lega;
  avviso: string | null;
}

/** Come si nomina una tappa scartata: «nome» se ne ha uno, altrimenti il suo numero nell'elenco */
function etichettaTappa(tappa: unknown, indice: number): string {
  const nome = (tappa as { nome?: unknown } | null)?.nome;
  if (typeof nome === "string" && nome.trim()) return `«${nome.trim()}»`;
  return `n. ${indice + 1}`;
}

/** Controlla la lega che l'ospite ha nel localStorage prima di darla all'app. Sono dati scritti da questa app, ma anche da
 *  versioni precedenti o da un import che non controllava il file: una tappa incompleta farebbe uscire la pagina bianca a ogni
 *  ricarica. Si controlla una tappa per volta: quelle senza la forma giusta si scartano (l'avviso dice quali e perché) e le
 *  altre restano usabili. Gli id restano quelli che erano: qui non si importa niente di nuovo, a differenza di leggiFileLega.
 *  I dati nel browser non si toccano: la tappa scartata sparisce da lì solo al prossimo salvataggio della lega.
 *  @returns null se i dati non sono una lega (non un oggetto, o senza l'elenco `tappe`) */
export function leggiLegaSalvata(dati: unknown): LegaSalvata | null {
  if (typeof dati !== "object" || dati === null) return null;
  const { nome, tappe } = dati as { nome?: unknown; tappe?: unknown };
  if (!Array.isArray(tappe)) return null;
  const valide: Tappa[] = [];
  const scartate: string[] = [];
  tappe.forEach((dato: unknown, i) => {
    if (typeof dato !== "object" || dato === null) {
      scartate.push(`${etichettaTappa(dato, i)} (non è una tappa)`);
      return;
    }
    const letta = tappaSalvataSchema.safeParse(dato);
    if (letta.success) {
      valide.push(letta.data);
      return;
    }
    scartate.push(`${etichettaTappa(dato, i)} (${descrivi(letta.error.issues[0])})`);
  });
  let nomeLega = "";
  if (typeof nome === "string") nomeLega = nome;
  return { lega: { nome: nomeLega, tappe: valide }, avviso: avvisoScartate(nomeLega, scartate) };
}

/** Il testo per l'utente sulle tappe scartate; null se non ce ne sono */
function avvisoScartate(nomeLega: string, scartate: string[]): string | null {
  if (scartate.length === 0) return null;
  const lega = `La lega «${nomeLega.trim() || "senza nome"}»`;
  const elenco = scartate.join("; ");
  if (scartate.length === 1) return `${lega} ha una tappa non valida, che non è stata caricata: ${elenco}.`;
  return `${lega} ha ${scartate.length} tappe non valide, che non sono state caricate: ${elenco}.`;
}
