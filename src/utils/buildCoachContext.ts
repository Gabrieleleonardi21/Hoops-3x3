import type { Tappa } from "../types";
import { giocateConVincitore, standings, vincitore } from "./standings";
import { tappaLeaders } from "./tappaLeaders";
import { nomeSquadra } from "./tappaInfo";

/** Lunghezza massima di un nome nel contesto */
const MAX_NOME = 80;

/** Un valore scritto dagli utenti (nomi di lega, tappe, squadre e giocatori, luogo, data) pronto per il prompt.
 *  `<` e `>` diventano ‹ ›: un nome che contiene `</dati_lega>` chiuderebbe il blocco dei dati e il testo dopo
 *  sembrerebbe un'istruzione. I nomi arrivano anche dall'anagrafe condivisa, scrivibile da ogni utente registrato.
 *  La usano anche i risultati degli strumenti del Coach, che riportano gli stessi nomi.
 *  String(): una tappa salvata da una versione vecchia può non avere tutti i campi. */
export function pulisci(valore: string): string {
  return senzaTag(valore).slice(0, MAX_NOME);
}

/** Come pulisci, ma senza accorciare: per un testo lungo che può contenere nomi scritti dagli utenti, come il motivo di un errore
 *  (un conflitto riporta il nome della tappa salvato sul server) */
export function senzaTag(valore: string): string {
  return String(valore).replace(/</g, "‹").replace(/>/g, "›");
}

/** Classifica cumulativa del circuito: aggrega vittorie e partite su tutte le tappe. Le partite che contano sono
 *  le stesse della classifica del girone (giocateConVincitore): una in parità non conta per niente. */
function circuitStandings(tappe: Tappa[]): string {
  const wins: Record<string, { nome: string; v: number; g: number }> = {};
  for (const t of tappe) {
    for (const sq of t.squadre) {
      if (!wins[sq.id]) wins[sq.id] = { nome: sq.nome, v: 0, g: 0 };
    }
    for (const m of giocateConVincitore(t.partite)) {
      const vince = vincitore(m);
      // la perdente è l'altra squadra della partita
      let perdente = m.a;
      if (vince === m.a) perdente = m.b;
      if (wins[vince]) { wins[vince].v++; wins[vince].g++; }
      if (wins[perdente])  { wins[perdente].g++; }
    }
  }
  return Object.values(wins)
    .sort((a, b) => b.v - a.v || b.g - a.g)
    .map((r, i) => `${i + 1}. ${pulisci(r.nome)} (${r.v}V/${r.g}P totali)`)
    .join("; ");
}

/** Costruisce un riassunto testuale della lega per il preamble del Coach AI. */
export function buildCoachContext(legaName: string, tappe: Tappa[]): string {
  if (!legaName && !tappe.length) return "";

  const lines: string[] = [];
  if (legaName) lines.push(`Lega: ${pulisci(legaName)}`);
  if (!tappe.length) return lines.join("\n");

  const tappeResume = tappe
    .map((t) => {
      let riga = `"${pulisci(t.nome)}" (${pulisci(t.data)}, ${pulisci(t.luogo)})`;
      if (t.conclusa) riga += " [conclusa]";
      return riga;
    })
    .join("; ");
  lines.push(`Tappe (${tappe.length}): ${tappeResume}`);

  // Classifica cumulativa del circuito (solo se ci sono partite giocate con un vincitore, come in circuitStandings:
  // una tappa con sole partite in parità non porterebbe che squadre a zeri)
  const tappeConPartite = tappe.filter((t) => giocateConVincitore(t.partite).length > 0);
  if (tappeConPartite.length > 0) {
    lines.push(`Classifica circuito: ${circuitStandings(tappeConPartite)}`);
  }

  // Focus sulla tappa attiva più recente, altrimenti l'ultima
  const attiva = [...tappe].reverse().find((t) => !t.conclusa) ?? tappe[tappe.length - 1];
  lines.push(`\nTappa in primo piano: ${pulisci(attiva.nome)} — ${pulisci(attiva.luogo)}, ${pulisci(attiva.data)}`);

  // Nomi delle squadre già puliti: li usano le classifiche dei gironi
  const nameOf = (id: string) => pulisci(nomeSquadra(attiva.squadre, id));

  if (attiva.squadre.length) {
    lines.push(`Squadre (${attiva.squadre.length}): ${attiva.squadre.map((s) => pulisci(s.nome)).join(", ")}`);
  }

  // Classifiche per girone
  if (attiva.gironi?.length) {
    attiva.gironi.forEach((girone, i) => {
      const label = String.fromCharCode(65 + i); // A, B, C…
      const st = standings(girone, attiva.partite, nameOf);
      const rows = st
        .map((r, pos) => `${pos + 1}. ${r.nome} (${r.v}V ${r.p}P, pf ${r.pf} ps ${r.ps})`)
        .join("; ");
      lines.push(`Girone ${label}: ${rows}`);
    });
  }

  const done = attiva.partite.filter((p) => p.done).length;
  lines.push(`Partite: ${done}/${attiva.partite.length} disputate`);

  // Top 5 marcatori
  const leaders = tappaLeaders(attiva)
    .filter((l) => l.g > 0)
    .sort((a, b) => b.pt / b.g - a.pt / a.g)
    .slice(0, 5);
  if (leaders.length) {
    const top = leaders
      .map((l) => `${pulisci(l.nome)} (${pulisci(l.squadra)}) ${(l.pt / l.g).toFixed(1)}pt/g`)
      .join(", ");
    lines.push(`Top marcatori: ${top}`);
  }

  // I tag delimitano i dati utente dal resto del prompt: l'AI è istruita a non eseguire
  // comandi trovati all'interno di questi tag (difesa contro prompt injection).
  return `<dati_lega>\n${lines.join("\n")}\n</dati_lega>`;
}
